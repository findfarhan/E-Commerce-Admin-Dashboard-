import {Inject,Injectable} from "@nestjs/common";
import {OBJECT_STORAGE,type ObjectStorage} from "../storage/storage.port";

export const IMAGE_PRESETS={
  admin_thumb:{width:160,height:160,fit:"cover",quality:78},
  store_thumb:{width:320,height:320,fit:"cover",quality:80},
  card_mobile:{width:640,height:800,fit:"cover",quality:82},
  card_desktop:{width:900,height:1125,fit:"cover",quality:82},
  pdp_mobile:{width:900,height:1125,fit:"cover",quality:84},
  pdp_desktop:{width:1200,height:1500,fit:"cover",quality:84},
  zoom:{width:2000,height:2500,fit:"scale-down",quality:88},
  hero_mobile:{width:1080,height:1350,fit:"cover",quality:84},
  hero_desktop:{width:1920,height:1080,fit:"cover",quality:84},
  social_og:{width:1200,height:630,fit:"cover",quality:84},
} as const;

export type ImagePresetKey=keyof typeof IMAGE_PRESETS;

@Injectable()
export class ImageDeliveryService{
  constructor(@Inject(OBJECT_STORAGE) private readonly storage:ObjectStorage){}

  dynamicTransformsEnabled(){
    return Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL);
  }

  // Render stored, already optimized R2 files without a Vercel image proxy.
  renditionPublicUrl(objectKey:string){return this.storage.publicUrl(objectKey);}

  sourceUrl(media:{source_url?:string|null;master_object_key?:string|null}){
    if(media.source_url) return media.source_url;
    if(media.master_object_key) return this.storage.publicUrl(media.master_object_key);
    return null;
  }

  url(
    media:{source_url?:string|null;master_object_key?:string|null;focal_x?:number|string|null;focal_y?:number|string|null},
    preset:ImagePresetKey,
  ){
    const source=this.sourceUrl(media);
    if(!source) return null;
    const base=(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL||"").replace(/\/$/,"");
    if(!base) return source;

    const p=IMAGE_PRESETS[preset];
    const focalX=this.clamp(media.focal_x,0.5);
    const focalY=this.clamp(media.focal_y,0.5);
    const options=[
      "width="+p.width,
      "height="+p.height,
      "fit="+p.fit,
      "quality="+p.quality,
      "format=auto",
      ...(p.fit==="cover"?["gravity="+focalX+"x"+focalY]:[]),
      "metadata=none",
    ].join(",");

    const normalizedSource=this.sourceForCloudflare(base,source);
    return base+"/cdn-cgi/image/"+options+"/"+normalizedSource;
  }

  responsiveSet(media:{source_url?:string|null;master_object_key?:string|null;focal_x?:number|string|null;focal_y?:number|string|null}){
    return Object.fromEntries(
      (Object.keys(IMAGE_PRESETS) as ImagePresetKey[]).map(key=>[key,this.url(media,key)])
    );
  }

  private sourceForCloudflare(base:string,source:string){
    try{
      const baseUrl=new URL(base);
      const sourceUrl=new URL(source);
      if(baseUrl.origin===sourceUrl.origin){
        return sourceUrl.pathname.replace(/^\//,"")+sourceUrl.search;
      }
      return source;
    }catch{
      return source.replace(/^\//,"");
    }
  }

  private clamp(raw:number|string|null|undefined,fallback:number){
    const value=Number(raw);
    if(!Number.isFinite(value)) return fallback;
    return Math.max(0,Math.min(1,value));
  }
}
