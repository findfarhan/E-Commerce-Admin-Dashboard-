import {Injectable} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {ProductsService} from "../products/products.service";

@Injectable()
export class StorefrontService{
  constructor(
    private readonly db:DatabaseService,
    private readonly productsService:ProductsService,
  ){}

  products(){return this.productsService.listStorefront();}

  async product(handle:string){
    const detail=await this.productsService.getStorefrontDetailByHandle(handle);
    const p=detail.product;
    const media=detail.media||[];

    const primary=media[0]?.responsive?.pdp_desktop
      ||media[0]?.renditions?.find((r:any)=>r.preset==="pdp_desktop"&&r.format==="webp")?.url
      ||media[0]?.url
      ||"";

    const secondary=media[1]?.responsive?.pdp_desktop
      ||media[1]?.renditions?.find((r:any)=>r.preset==="pdp_desktop"&&r.format==="webp")?.url
      ||media[1]?.url
      ||primary;

    const variants=(detail.variants||[]).map((v:any)=>({
      id:v.id,
      sku:v.sku,
      title:v.title,
      price:Number(v.price),
      compareAtPrice:v.compare_at_price?Number(v.compare_at_price):null,
      inventory:Number(v.inventory),
      status:v.status,
      mediaSetId:v.media_set_id,
      selectedOptions:v.selected_options||{},
    }));

    return {
      id:p.id,
      slug:p.handle,
      name:p.title,
      price:"Rs. "+Number(p.price_amount).toLocaleString("en-PK"),
      priceAmount:Number(p.price_amount),
      currency:"PKR",
      tag:p.tag||"",
      image:primary,
      secondaryImage:secondary,
      category:p.category||"Jewelry",
      story:p.description||"",
      material:p.material||"",
      availability:Number(p.inventory)>0?"InStock":"OutOfStock",
      featured:p.featured,
      options:(detail.options||[]).map((o:any)=>({
        id:o.id,
        name:o.name,
        isVisual:o.is_visual,
        values:o.values,
      })),
      variants,
      mediaSets:(detail.mediaSets||[]).map((m:any)=>({
        id:m.id,
        name:m.name,
        matchOptions:m.match_options,
        isDefault:m.is_default,
      })),
      media,
    };
  }

  async collections(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>(
      "select c.id,c.handle,c.title,c.subtitle,c.description,c.image_url as image,c.position from collections c join stores s on s.id=c.store_id where s.domain=$1 and c.status='active' order by c.position",
      [domain]
    );
    return result.rows;
  }

  config(){
    return {
      store:{name:"Jewelry Store",currency:"PKR",locale:"en-PK"},
      features:{
        variants:true,
        responsiveMedia:true,
        seo:true,
        multichannel:true,
        mediaProvider:"cloudflare",
        dynamicImageTransforms:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL),
      },
    };
  }
}
