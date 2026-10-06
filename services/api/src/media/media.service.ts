import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import {DatabaseService} from "../database/database.service";
import {R2Service} from "./r2.service";

const presets=[
  {key:"admin_thumb",width:160,height:160,fit:"cover",formats:["webp"]},
  {key:"store_thumb",width:320,height:320,fit:"cover",formats:["webp","avif"]},
  {key:"card_mobile",width:640,height:800,fit:"cover",formats:["webp","avif"]},
  {key:"card_desktop",width:900,height:1125,fit:"cover",formats:["webp","avif"]},
  {key:"pdp_mobile",width:900,height:1125,fit:"cover",formats:["webp","avif"]},
  {key:"pdp_desktop",width:1200,height:1500,fit:"cover",formats:["webp","avif"]},
  {key:"zoom",width:2000,height:2500,fit:"inside",formats:["webp"]},
  {key:"hero_mobile",width:1080,height:1350,fit:"cover",formats:["webp","avif"]},
  {key:"hero_desktop",width:1920,height:1080,fit:"cover",formats:["webp","avif"]},
  {key:"social_og",width:1200,height:630,fit:"cover",formats:["webp"]},
] as const;

@Injectable()
export class MediaService{
  constructor(private readonly db:DatabaseService,private readonly r2:R2Service){}

  async createUpload(productId:string,body:any){
    const filename=String(body?.filename||"master.jpg");
    const contentType=String(body?.contentType||"image/jpeg");
    if(!contentType.startsWith("image/")) throw new BadRequestException("Only image uploads are supported");
    const product=await this.db.query<any>("select p.id,p.store_id from products p where p.id=$1",[productId]);
    if(!product.rowCount) throw new NotFoundException("Product not found");
    const mediaId=randomUUID();
    const extension=(path.extname(filename).replace(".","").toLowerCase()||"jpg").replace(/[^a-z0-9]/g,"");
    const key=["masters",product.rows[0].store_id,"products",productId,mediaId,"original."+extension].join("/");
    await this.db.query("insert into product_media(id,product_id,media_set_id,master_object_key,mime_type,focal_x,focal_y,alt_text,position,role) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[mediaId,productId,body.mediaSetId??null,key,contentType,Number(body.focalX??0.5),Number(body.focalY??0.5),body.altText??null,Number(body.position??0),body.role??"gallery"]);
    const uploadUrl=await this.r2.signedPut(key,contentType);
    return {mediaId,key,uploadUrl,expiresIn:Number(process.env.R2_UPLOAD_URL_TTL_SECONDS||900)};
  }

  async finalize(mediaId:string){
    const media=await this.db.query<any>("select * from product_media where id=$1",[mediaId]);
    if(!media.rowCount) throw new NotFoundException("Media not found");
    await this.r2.head(media.rows[0].master_object_key);
    await this.db.query("insert into jobs(store_id,kind,idempotency_key,payload,status) select p.store_id,'image.renditions.generate',$1,$2::jsonb,'queued' from product_media pm join products p on p.id=pm.product_id where pm.id=$3 on conflict(idempotency_key) do update set status='queued',available_at=now(),last_error=null",["image-renditions:"+mediaId,JSON.stringify({mediaId}),mediaId]);
    return {ok:true,mediaId,status:"queued",presets:presets.map(p=>p.key)};
  }

  async renditions(mediaId:string){
    const result=await this.db.query<any>("select preset,format,object_key,width,height,bytes,status from media_renditions where media_id=$1 order by preset,format",[mediaId]);
    const base=(process.env.R2_PUBLIC_BASE_URL||"").replace(/\/$/,"");
    return result.rows.map(r=>({...r,url:base?base+"/"+r.object_key:null}));
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
    const result=await this.db.query<any>("select pm.*,p.store_id from product_media pm join products p on p.id=pm.product_id where pm.id=$1",[mediaId]);
    if(!result.rowCount) throw new NotFoundException("Media not found");
    const media=result.rows[0];
    if(!media.master_object_key) throw new BadRequestException("Media has no R2 master object");
    const input=await this.r2.getBuffer(media.master_object_key);
    const meta=await sharp(input).metadata();
    await this.db.query("update product_media set width=$1,height=$2 where id=$3",[meta.width??null,meta.height??null,mediaId]);

    for(const preset of presets){
      for(const format of preset.formats){
        let pipeline=preset.fit==="cover"
          ? await this.cropFromFocal(input,preset.width,preset.height,Number(media.focal_x),Number(media.focal_y))
          : sharp(input).resize(preset.width,preset.height,{fit:"inside",withoutEnlargement:true});
        pipeline=format==="avif"?pipeline.avif({quality:72}):pipeline.webp({quality:82});
        const output=await pipeline.toBuffer({resolveWithObject:true});
        const key=["renditions",media.store_id,"products",media.product_id,mediaId,preset.key+"."+format].join("/");
        await this.r2.put(key,output.data,"image/"+format);
        await this.db.query("insert into media_renditions(media_id,preset,format,object_key,width,height,bytes,status) values($1,$2,$3,$4,$5,$6,$7,'ready') on conflict(media_id,preset,format) do update set object_key=excluded.object_key,width=excluded.width,height=excluded.height,bytes=excluded.bytes,status='ready'",[mediaId,preset.key,format,key,output.info.width,output.info.height,output.info.size]);
      }
    }
    return {ok:true,mediaId};
  }
}
