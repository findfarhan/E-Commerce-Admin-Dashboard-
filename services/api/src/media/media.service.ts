import {BadRequestException,Inject,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import {DatabaseService} from "../database/database.service";
import {OBJECT_STORAGE,type ObjectStorage} from "../storage/storage.port";
import {IMAGE_PRESETS,ImageDeliveryService} from "./image-delivery.service";

@Injectable()
export class MediaService{
  constructor(
    private readonly db:DatabaseService,
    private readonly delivery:ImageDeliveryService,
    @Inject(OBJECT_STORAGE) private readonly storage:ObjectStorage,
  ){}

  async createSource(productId:string,body:any){
    const raw=String(body?.sourceUrl||"").trim();
    let sourceUrl:string;
    try{
      const parsed=new URL(raw);
      if(parsed.protocol!=="https:") throw new Error("https required");
      sourceUrl=parsed.toString();
    }catch{
      throw new BadRequestException("A valid HTTPS image URL is required");
    }

    const role=String(body?.role||"gallery");
    const position=Number(body?.position??0);
    const altText=String(body?.altText||"").trim()||null;
    const mediaSetId=body?.mediaSetId?String(body.mediaSetId):null;
    if(!["primary","gallery"].includes(role)) throw new BadRequestException("Invalid media role");
    if(!Number.isInteger(position)||position<0) throw new BadRequestException("Media position must be a non-negative whole number");

    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    return this.db.transaction(async client=>{
      const product=await client.query(
        "select p.id from products p join stores s on s.id=p.store_id where p.id=$1 and s.domain=$2 limit 1",
        [productId,domain]
      );
      if(!product.rowCount) throw new NotFoundException("Product not found");

      if(mediaSetId){
        const mediaSet=await client.query("select id from product_media_sets where id=$1 and product_id=$2 limit 1",[mediaSetId,productId]);
        if(!mediaSet.rowCount) throw new BadRequestException("Media set does not belong to this product");
      }

      if(role==="primary"){
        await client.query("update product_media set role='gallery' where product_id=$1 and role='primary'",[productId]);
      }

      const result=await client.query<any>(
        "insert into product_media(product_id,media_set_id,source_url,alt_text,position,role,storage_provider) values($1,$2,$3,$4,$5,$6,'source-url') returning *",
        [productId,mediaSetId,sourceUrl,altText,position,role]
      );
      return result.rows[0];
    });
  }

  async createUpload(productId:string,body:any){
    const filename=String(body?.filename||"master.jpg");
    const contentType=String(body?.contentType||"image/jpeg");
    if(!contentType.startsWith("image/")) throw new BadRequestException("Only image uploads are supported");

    const product=await this.db.query<any>("select p.id,p.store_id from products p where p.id=$1",[productId]);
    if(!product.rowCount) throw new NotFoundException("Product not found");

    const mediaId=randomUUID();
    const extension=(path.extname(filename).replace(".","").toLowerCase()||"jpg").replace(/[^a-z0-9]/g,"");
    const key=["masters",product.rows[0].store_id,"products",productId,mediaId,"original."+extension].join("/");

    await this.db.query(
      "insert into product_media(id,product_id,media_set_id,master_object_key,mime_type,focal_x,focal_y,alt_text,position,role) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [mediaId,productId,body.mediaSetId??null,key,contentType,Number(body.focalX??0.5),Number(body.focalY??0.5),body.altText??null,Number(body.position??0),body.role??"gallery"]
    );

    const expiresIn=Number(process.env.R2_UPLOAD_URL_TTL_SECONDS||900);
    const uploadUrl=await this.storage.createSignedUploadUrl(key,contentType,expiresIn);

    return {
      provider:this.storage.provider,
      mediaId,
      key,
      uploadUrl,
      expiresIn,
      directUpload:true,
    };
  }

  async finalize(mediaId:string){
    const result=await this.db.query<any>(
      "select pm.*,p.store_id from product_media pm join products p on p.id=pm.product_id where pm.id=$1",
      [mediaId]
    );
    if(!result.rowCount) throw new NotFoundException("Media not found");
    const media=result.rows[0];
    if(!media.master_object_key) throw new BadRequestException("Media has no master object key");

    const head=await this.storage.head(media.master_object_key);

    if(this.delivery.dynamicTransformsEnabled()){
      return {
        ok:true,
        mediaId,
        status:"ready",
        provider:this.storage.provider,
        delivery:"cloudflare-image-resizing",
        bytes:head.contentLength??null,
        sourceUrl:this.delivery.sourceUrl(media),
        renditions:this.delivery.responsiveSet(media),
      };
    }

    await this.db.query(
      "insert into jobs(store_id,kind,idempotency_key,payload,status) values($1,'image.renditions.generate',$2,$3::jsonb,'queued') on conflict(idempotency_key) do update set status='queued',available_at=now(),last_error=null",
      [media.store_id,"image-renditions:"+mediaId,JSON.stringify({mediaId})]
    );

    return {
      ok:true,
      mediaId,
      status:"queued",
      provider:this.storage.provider,
      delivery:"pre-generated-renditions",
      presets:Object.keys(IMAGE_PRESETS),
    };
  }

  async update(mediaId:string,body:any){
    const current=await this.db.query<any>("select pm.*,p.store_id from product_media pm join products p on p.id=pm.product_id where pm.id=$1",[mediaId]);
    if(!current.rowCount) throw new NotFoundException("Media not found");
    const row=current.rows[0];
    const role=body?.role!==undefined?String(body.role):row.role;
    const position=body?.position!==undefined?Number(body.position):Number(row.position||0);
    const focalX=body?.focalX!==undefined?Number(body.focalX):Number(row.focal_x??0.5);
    const focalY=body?.focalY!==undefined?Number(body.focalY):Number(row.focal_y??0.5);
    const altText=body?.altText!==undefined?(String(body.altText).trim()||null):row.alt_text;
    const mediaSetId=body?.mediaSetId!==undefined?(body.mediaSetId||null):row.media_set_id;
    if(!["primary","gallery"].includes(role)) throw new BadRequestException("Invalid media role");
    if(!Number.isInteger(position)||position<0) throw new BadRequestException("Invalid media position");
    if(focalX<0||focalX>1||focalY<0||focalY>1) throw new BadRequestException("Focal point must be between 0 and 1");
    let sourceUrl=row.source_url;
    if(body?.sourceUrl!==undefined){
      const raw=String(body.sourceUrl||"").trim();
      if(raw){
        try{const u=new URL(raw);if(u.protocol!=="https:")throw new Error();sourceUrl=u.toString();}catch{throw new BadRequestException("Source URL must be HTTPS");}
      }else sourceUrl=null;
    }
    return this.db.transaction(async client=>{
      if(mediaSetId){
        const set=await client.query("select id from product_media_sets where id=$1 and product_id=$2",[mediaSetId,row.product_id]);
        if(!set.rowCount) throw new BadRequestException("Media set does not belong to product");
      }
      if(role==="primary") await client.query("update product_media set role='gallery' where product_id=$1 and id<>$2 and role='primary'",[row.product_id,mediaId]);
      const r=await client.query<any>("update product_media set media_set_id=$1,source_url=$2,alt_text=$3,position=$4,role=$5,focal_x=$6,focal_y=$7 where id=$8 returning *",[mediaSetId,sourceUrl,altText,position,role,focalX,focalY,mediaId]);
      if(row.master_object_key&&(focalX!==Number(row.focal_x)||focalY!==Number(row.focal_y))){
        await client.query("delete from media_renditions where media_id=$1",[mediaId]);
        await client.query("insert into jobs(store_id,kind,idempotency_key,payload,status) values($1,'image.renditions.generate',$2,$3::jsonb,'queued') on conflict(idempotency_key) do update set status='queued',available_at=now(),last_error=null",[row.store_id,"image-renditions:"+mediaId,JSON.stringify({mediaId})]);
      }
      return r.rows[0];
    });
  }

  async delete(mediaId:string){
    const r=await this.db.query<any>("select pm.*,p.store_id from product_media pm join products p on p.id=pm.product_id where pm.id=$1",[mediaId]);
    if(!r.rowCount) throw new NotFoundException("Media not found");
    const media=r.rows[0];
    const renditions=await this.db.query<any>("select object_key from media_renditions where media_id=$1",[mediaId]);
    const objectKeys=[media.master_object_key,...renditions.rows.map((x:any)=>x.object_key)].filter(Boolean);
    if(objectKeys.length){
      if(this.storage.provider!=="cloudflare-r2") throw new BadRequestException("R2 storage must be configured before deleting managed objects");
      for(const key of objectKeys) await this.storage.delete(key);
    }
    await this.db.query("delete from product_media where id=$1",[mediaId]);
    return {ok:true,id:mediaId};
  }

  async renditions(mediaId:string){
    const mediaResult=await this.db.query<any>("select * from product_media where id=$1",[mediaId]);
    if(!mediaResult.rowCount) throw new NotFoundException("Media not found");
    const media=mediaResult.rows[0];

    if(this.delivery.dynamicTransformsEnabled()){
      return Object.entries(this.delivery.responsiveSet(media)).map(([preset,url])=>({
        preset,
        format:"auto",
        status:"dynamic",
        url,
      }));
    }

    const result=await this.db.query<any>(
      "select preset,format,object_key,width,height,bytes,status from media_renditions where media_id=$1 order by preset,format",
      [mediaId]
    );
    return result.rows.map(row=>({...row,url:this.storage.publicUrl(row.object_key)}));
  }

  private async cropFromFocal(input:Buffer,width:number,height:number,focalX:number,focalY:number){
    const meta=await sharp(input).metadata();
    if(!meta.width||!meta.height) return sharp(input).resize(width,height,{fit:"cover",position:"attention"});
    const scale=Math.max(width/meta.width,height/meta.height);
    const rw=Math.max(width,Math.round(meta.width*scale));
    const rh=Math.max(height,Math.round(meta.height*scale));
    const left=Math.max(0,Math.min(rw-width,Math.round(focalX*rw-width/2)));
    const top=Math.max(0,Math.min(rh-height,Math.round(focalY*rh-height/2)));
    return sharp(input).resize(rw,rh,{fit:"fill"}).extract({left,top,width,height});
  }

  async processRenditions(mediaId:string){
    if(this.delivery.dynamicTransformsEnabled()){
      return {ok:true,mediaId,skipped:true,reason:"Cloudflare dynamic image resizing enabled"};
    }

    const result=await this.db.query<any>(
      "select pm.*,p.store_id from product_media pm join products p on p.id=pm.product_id where pm.id=$1",
      [mediaId]
    );
    if(!result.rowCount) throw new NotFoundException("Media not found");

    const media=result.rows[0];
    if(!media.master_object_key) throw new BadRequestException("Media has no master object");

    const input=await this.storage.getBuffer(media.master_object_key);
    const meta=await sharp(input).metadata();
    await this.db.query("update product_media set width=$1,height=$2 where id=$3",[meta.width??null,meta.height??null,mediaId]);

    for(const [key,preset] of Object.entries(IMAGE_PRESETS)){
      const formats=key==="admin_thumb"||key==="zoom"||key==="social_og"?["webp"]:["webp","avif"];
      for(const format of formats){
        let pipeline=preset.fit==="cover"
          ? await this.cropFromFocal(input,preset.width,preset.height,Number(media.focal_x),Number(media.focal_y))
          : sharp(input).resize(preset.width,preset.height,{fit:"inside",withoutEnlargement:true});

        pipeline=format==="avif"?pipeline.avif({quality:72}):pipeline.webp({quality:preset.quality});
        const output=await pipeline.toBuffer({resolveWithObject:true});
        const objectKey=["renditions",media.store_id,"products",media.product_id,mediaId,key+"."+format].join("/");

        await this.storage.put(objectKey,output.data,"image/"+format);
        await this.db.query(
          "insert into media_renditions(media_id,preset,format,object_key,width,height,bytes,status) values($1,$2,$3,$4,$5,$6,$7,'ready') on conflict(media_id,preset,format) do update set object_key=excluded.object_key,width=excluded.width,height=excluded.height,bytes=excluded.bytes,status='ready'",
          [mediaId,key,format,objectKey,output.info.width,output.info.height,output.info.size]
        );
      }
    }
    return {ok:true,mediaId};
  }
}
