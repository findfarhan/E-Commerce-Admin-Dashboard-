import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {CollectionsService} from "../collections/collections.service";
import {ProductsService} from "../products/products.service";
import {SeoService} from "../seo/seo.service";
import {RedirectsService} from "../redirects/redirects.service";
import {DatabaseService} from "../database/database.service";
import sanitizeHtml from "sanitize-html";

@Injectable()
export class StorefrontService{
  constructor(
    private readonly productsService:ProductsService,
    private readonly collectionsService:CollectionsService,
    private readonly seoService:SeoService,
    private readonly redirectsService:RedirectsService,
    private readonly db:DatabaseService,
  ){}

  private descriptionText(value:any){
    return sanitizeHtml(String(value||""),{allowedTags:[],allowedAttributes:{}})
      .replace(/\s+/g," ")
      .trim();
  }

  async products(filters:any={}){
    let products=await this.productsService.listStorefront();
    const q=String(filters?.q||"").trim().toLowerCase();
    const category=String(filters?.category||"").trim().toLowerCase();
    const material=String(filters?.material||filters?.metal||"").trim().toLowerCase();
    const vendor=String(filters?.vendor||"").trim().toLowerCase();
    const productType=String(filters?.productType||"").trim().toLowerCase();
    const availability=String(filters?.availability||"").trim();
    const tag=String(filters?.tag||"").trim().toLowerCase();
    const minPrice=filters?.minPrice!==undefined?Number(filters.minPrice):null;
    const maxPrice=filters?.maxPrice!==undefined?Number(filters.maxPrice):null;

    if(q) products=products.filter((product:any)=>[
      product.name,product.category,product.material,product.vendor,product.productType,product.story,
      ...(product.tags||[]),JSON.stringify(product.searchAttributes||{})
    ].some(value=>String(value||"").toLowerCase().includes(q)));
    if(category) products=products.filter((product:any)=>String(product.category||"").toLowerCase()===category);
    if(material) products=products.filter((product:any)=>String(product.material||"").toLowerCase().includes(material));
    if(vendor) products=products.filter((product:any)=>String(product.vendor||"").toLowerCase()===vendor);
    if(productType) products=products.filter((product:any)=>String(product.productType||"").toLowerCase()===productType);
    if(tag) products=products.filter((product:any)=>(product.tags||[]).some((value:string)=>value.toLowerCase()===tag)||String(product.tag||"").toLowerCase()===tag);
    if(availability) products=products.filter((product:any)=>product.availability===availability);
    if(minPrice!==null&&Number.isFinite(minPrice)) products=products.filter((product:any)=>Number(product.priceAmount)>=minPrice);
    if(maxPrice!==null&&Number.isFinite(maxPrice)) products=products.filter((product:any)=>Number(product.priceAmount)<=maxPrice);

    if(filters?.collection){
      const collection=await this.collectionsService.storefrontDetail(String(filters.collection));
      const wanted=new Set(collection.productHandles||[]);
      products=products.filter((product:any)=>wanted.has(product.slug));
    }

    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const storeResult=await this.db.query<any>("select id from stores where domain=$1 limit 1",[domain]);
    const storeId=storeResult.rows[0]?.id;
    if(storeId&&filters?.size){
      const matched=await this.db.query<any>(
        `select distinct p.id from products p join product_variants v on v.product_id=p.id
         join variant_option_values vv on vv.variant_id=v.id join product_option_values ov on ov.id=vv.option_value_id
         join product_options o on o.id=ov.option_id
         where p.store_id=$1 and lower(o.name)='size' and lower(ov.value)=lower($2)`,
        [storeId,String(filters.size)]
      );
      const ids=new Set(matched.rows.map((row:any)=>row.id));
      products=products.filter((product:any)=>ids.has(product.id));
    }

    const rawMetafields:any[]=[];
    const mf=filters?.metafield;
    if(Array.isArray(mf)) rawMetafields.push(...mf);
    else if(mf) rawMetafields.push(mf);
    if(filters?.stone) rawMetafields.push("custom.stone_type:"+String(filters.stone));
    if(filters?.gender) rawMetafields.push("custom.gender:"+String(filters.gender));

    for(const raw of rawMetafields){
      const text=String(raw);
      const colon=text.indexOf(":");
      const dot=text.indexOf(".");
      if(!storeId||colon<1||dot<1||dot>colon) continue;
      const namespace=text.slice(0,dot);
      const key=text.slice(dot+1,colon);
      const value=text.slice(colon+1);
      const matched=await this.db.query<any>(
        `select distinct mv.owner_id as product_id from metafield_values mv join metafield_definitions md on md.id=mv.definition_id
         where mv.store_id=$1 and mv.owner_type='product' and md.namespace=$2 and md.key=$3 and lower(trim(both '"' from mv.value::text))=lower($4)`,
        [storeId,namespace,key,value]
      );
      const ids=new Set(matched.rows.map((row:any)=>row.product_id));
      products=products.filter((product:any)=>ids.has(product.id));
    }

    const limit=Math.min(100,Math.max(1,Number(filters?.limit||100)));
    return products.slice(0,limit);
  }

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
      category:p.category||"Jewelry",story:this.descriptionText(p.description),descriptionHtml:p.description||"",material:p.material||"",
      vendor:p.vendor||"",productType:p.product_type||"",tags:p.tags||[],searchAttributes:p.search_attributes||{},
      taxable:p.taxable!==false,weightGrams:p.weight_grams===null?null:Number(p.weight_grams),
      availability:Number(p.inventory)>0?"InStock":"OutOfStock",featured:p.featured,
      options:(detail.options||[]).map((o:any)=>({id:o.id,name:o.name,isVisual:o.is_visual,values:o.values})),
      variants,
      mediaSets:(detail.mediaSets||[]).map((m:any)=>({id:m.id,name:m.name,matchOptions:m.match_options,isDefault:m.is_default})),
      media,
      metafields:detail.metafields||[],
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

  async search(filters:any){
    const q=String(filters?.q||"").trim();
    if(q.length<2) return {query:q,items:[]};
    const items=await this.products({...filters,q,limit:Math.min(50,Number(filters?.limit||24))});
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
    if(!number||!email||!email.includes("@")||phone.length<10) throw new BadRequestException("Order number, email and a valid phone number are required");

    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>(
      "select o.id,o.order_number,o.status,o.payment_status,o.fulfillment_status,o.currency,o.total,o.shipping_method,o.tracking_carrier,o.tracking_number,o.tracking_url,o.fulfilled_at,o.created_at,c.email,c.phone from orders o join stores s on s.id=o.store_id left join customers c on c.id=o.customer_id where s.domain=$1 and upper(o.order_number)=$2 and lower(coalesce(c.email,''))=$3 limit 1",
      [domain,number,email]
    );

    if(!result.rowCount) throw new NotFoundException("Order not found");
    const order=result.rows[0];
    const storedPhone=String(order.phone||"").replace(/\D/g,"");
    if(storedPhone.length<10||storedPhone.slice(-10)!==phone.slice(-10)) throw new NotFoundException("Order not found");

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
      fulfilledAt:order.fulfilled_at,
      tracking:order.tracking_number||order.tracking_url?{
        carrier:order.tracking_carrier||null,
        number:order.tracking_number||null,
        url:order.tracking_url||null,
      }:null,
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

  async config(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const storeResult=await this.db.query<any>("select id,name,currency,prices_include_tax from stores where domain=$1 limit 1",[domain]);
    const store=storeResult.rows[0];
    const rates=store?await this.db.query<any>(
      "select distinct r.name,r.carrier,r.service_code from shipping_rates r join shipping_zones z on z.id=r.zone_id where z.store_id=$1 and z.active=true and r.active=true order by r.name",
      [store.id]
    ):{rows:[]};
    return {
      store:{name:store?.name||"Jewelry Store",currency:store?.currency||"PKR",locale:"en-PK",pricesIncludeTax:Boolean(store?.prices_include_tax)},
      checkout:{paymentMethods:["cod"],shippingMethods:rates.rows.length?rates.rows:[{name:"Standard",carrier:null,service_code:null}]},
      features:{variants:true,responsiveMedia:true,seo:true,multichannel:true,metafields:true,smartCollections:true,discounts:true,tax:true,multiLocationInventory:true,mediaProvider:process.env.MEDIA_STORAGE_PROVIDER||"source-url",dynamicImageTransforms:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL)},
    };
  }
}
