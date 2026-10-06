import {Injectable} from "@nestjs/common";
import {CollectionsService} from "../collections/collections.service";
import {ProductsService} from "../products/products.service";
import {SeoService} from "../seo/seo.service";
import {RedirectsService} from "../redirects/redirects.service";

@Injectable()
export class StorefrontService{
  constructor(
    private readonly productsService:ProductsService,
    private readonly collectionsService:CollectionsService,
    private readonly seoService:SeoService,
    private readonly redirectsService:RedirectsService,
  ){}

  products(){return this.productsService.listStorefront();}

  async product(handle:string){
    const detail=await this.productsService.getStorefrontDetailByHandle(handle);
    const p=detail.product;
    const media=detail.media||[];
    const primary=media[0]?.responsive?.pdp_desktop||media[0]?.renditions?.find((r:any)=>r.preset==="pdp_desktop"&&r.format==="webp")?.url||media[0]?.url||"";
    const secondary=media[1]?.responsive?.pdp_desktop||media[1]?.renditions?.find((r:any)=>r.preset==="pdp_desktop"&&r.format==="webp")?.url||media[1]?.url||primary;
    const variants=(detail.variants||[]).filter((v:any)=>v.status==="active").map((v:any)=>({
      id:v.id,sku:v.sku,title:v.title,price:Number(v.price),compareAtPrice:v.compare_at_price?Number(v.compare_at_price):null,
      inventory:Number(v.inventory),status:v.status,mediaSetId:v.media_set_id,selectedOptions:v.selected_options||{},
    }));
    const seo=await this.seoService.storefront("product",p.id);

    return {
      id:p.id,slug:p.handle,name:p.title,price:"Rs. "+Number(p.price_amount).toLocaleString("en-PK"),
      priceAmount:Number(p.price_amount),currency:"PKR",tag:p.tag||"",image:primary,secondaryImage:secondary,
      category:p.category||"Jewelry",story:p.description||"",material:p.material||"",
      availability:Number(p.inventory)>0?"InStock":"OutOfStock",featured:p.featured,
      options:(detail.options||[]).map((o:any)=>({id:o.id,name:o.name,isVisual:o.is_visual,values:o.values})),
      variants,
      mediaSets:(detail.mediaSets||[]).map((m:any)=>({id:m.id,name:m.name,matchOptions:m.match_options,isDefault:m.is_default})),
      media,
      seo:seo?{
        title:seo.title||undefined,
        description:seo.meta_description||undefined,
        canonicalPath:seo.canonical_path,
        noindex:seo.robots_index===false,
        schemaType:seo.schema_type,
      }:undefined,
    };
  }

  collections(){return this.collectionsService.storefrontList();}

  async collection(handle:string){
    const collection=await this.collectionsService.storefrontDetail(handle);
    const products=await this.productsService.listStorefront();
    const wanted=new Set(collection.productHandles||[]);
    const seo=await this.seoService.storefront("collection",collection.id);
    return {
      ...collection,
      products:products.filter((product:any)=>wanted.has(product.slug)),
      seo:seo?{
        title:seo.title||undefined,
        description:seo.meta_description||undefined,
        canonicalPath:seo.canonical_path,
        noindex:seo.robots_index===false,
        schemaType:seo.schema_type,
      }:undefined,
    };
  }

  async search(raw:string){
    const q=String(raw||"").trim().toLowerCase();
    if(q.length<2) return {query:q,items:[]};
    const products=await this.productsService.listStorefront();
    const items=products.filter((product:any)=>[product.name,product.category,product.material,product.tag,product.story].some(value=>String(value||"").toLowerCase().includes(q))).slice(0,24);
    return {query:q,items};
  }

  async redirect(path:string){
    const normalized=String(path||"").trim();
    if(!normalized.startsWith("/")||normalized.startsWith("//")) return null;
    return this.redirectsService.resolve(normalized);
  }

  config(){
    return {
      store:{name:"Jewelry Store",currency:"PKR",locale:"en-PK"},
      checkout:{paymentMethods:["cod"],shippingMethods:["standard"]},
      features:{variants:true,responsiveMedia:true,seo:true,multichannel:true,mediaProvider:"cloudflare",dynamicImageTransforms:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL)},
    };
  }
}
