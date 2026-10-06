import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {CollectionsService} from "../collections/collections.service";
import {ProductsService} from "../products/products.service";
import {SeoService} from "../seo/seo.service";
import {RedirectsService} from "../redirects/redirects.service";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class StorefrontService{
  constructor(
    private readonly productsService:ProductsService,
    private readonly collectionsService:CollectionsService,
    private readonly seoService:SeoService,
    private readonly redirectsService:RedirectsService,
    private readonly db:DatabaseService,
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

  async orderLookup(body:any){
    const number=String(body?.orderNumber||"").trim().toUpperCase();
    const email=String(body?.email||"").trim().toLowerCase();
    const phone=String(body?.phone||"").replace(/\D/g,"");
    if(!number||!email||!email.includes("@")||phone.length<4) throw new BadRequestException("Order number, email and phone are required");

    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>(
      "select o.id,o.order_number,o.status,o.payment_status,o.fulfillment_status,o.currency,o.total,o.shipping_method,o.created_at,c.email,c.phone from orders o join stores s on s.id=o.store_id left join customers c on c.id=o.customer_id where s.domain=$1 and upper(o.order_number)=$2 and lower(coalesce(c.email,''))=$3 limit 1",
      [domain,number,email]
    );

    if(!result.rowCount) throw new NotFoundException("Order not found");
    const order=result.rows[0];
    const storedPhone=String(order.phone||"").replace(/\D/g,"");
    if(!storedPhone.endsWith(phone.slice(-4))) throw new NotFoundException("Order not found");

    const items=await this.db.query<any>(
      "select title,sku,selected_options,quantity,unit_price,line_total from order_items where order_id=$1 order by id",
      [order.id]
    );

    return {
      orderNumber:order.order_number,
      status:order.status,
      paymentStatus:order.payment_status,
      fulfillmentStatus:order.fulfillment_status,
      currency:order.currency,
      total:Number(order.total||0),
      shippingMethod:order.shipping_method,
      createdAt:order.created_at,
      items:items.rows.map((item:any)=>({
        title:item.title,
        sku:item.sku,
        selectedOptions:item.selected_options||{},
        quantity:Number(item.quantity),
        unitPrice:Number(item.unit_price),
        lineTotal:Number(item.line_total),
      })),
    };
  }

  config(){
    return {
      store:{name:"Jewelry Store",currency:"PKR",locale:"en-PK"},
      checkout:{paymentMethods:["cod"],shippingMethods:["standard"]},
      features:{variants:true,responsiveMedia:true,seo:true,multichannel:true,mediaProvider:process.env.R2_BUCKET_NAME?"cloudflare-r2":"deferred",dynamicImageTransforms:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL)},
    };
  }
}
