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
