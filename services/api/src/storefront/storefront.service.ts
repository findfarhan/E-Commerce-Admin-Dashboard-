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

  // Keep product editorial copy rich but prevent stored markup from executing.
  private descriptionHtml(value:any){
    return sanitizeHtml(String(value||""),{
      allowedTags:["p","br","strong","b","em","i","ul","ol","li","a"],
      allowedAttributes:{a:["href","title"]},
      allowedSchemes:["https","http","mailto"],
      disallowedTagsMode:"discard",
    });
  }

  private descriptionText(value:any){
    return sanitizeHtml(String(value||""),{allowedTags:[],allowedAttributes:{}})
      .replace(/\s+/g," ")
      .trim();
  }

  async products(filters:any={}){
    const items=await this.productsService.listStorefront();
    const ids=items.map((x:any)=>x.id);
    let metafields=new Map<string,Record<string,any>>();
    if(ids.length){
      const r=await this.db.query<any>("select resource_id,namespace,key,value from resource_metafields where resource_type='product' and resource_id=any($1::uuid[])",[ids]);
      metafields=new Map();
      for(const row of r.rows){
        const current=metafields.get(row.resource_id)||{};
        current[row.namespace+"."+row.key]=row.value;
        metafields.set(row.resource_id,current);
      }
    }
    let collectionHandles:Set<string>|null=null;
    if(filters.collection){
      try{
        const collection=await this.collectionsService.storefrontDetail(String(filters.collection));
        collectionHandles=new Set(collection.productHandles||[]);
      }catch{collectionHandles=new Set();}
    }
    const min=filters.minPrice!==undefined?Number(filters.minPrice):null;
    const max=filters.maxPrice!==undefined?Number(filters.maxPrice):null;
    const q=String(filters.q||"").trim().toLowerCase();
    let sizeProducts:Set<string>|null=null;
    if(filters.size&&ids.length){
      const sr=await this.db.query<any>("select distinct p.id from products p join product_variants v on v.product_id=p.id join variant_option_values vv on vv.variant_id=v.id join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where p.id=any($1::uuid[]) and lower(o.name)='size' and lower(ov.value)=lower($2)",[ids,String(filters.size)]);
      sizeProducts=new Set(sr.rows.map((x:any)=>String(x.id)));
    }
    const filtered=items.filter((p:any)=>{
      const mf=metafields.get(p.id)||{};
      if(filters.category&&String(p.category||"").toLowerCase()!==String(filters.category).toLowerCase()) return false;
      const materialFilter=filters.material||filters.metal;
      if(materialFilter&&!String(p.material||"").toLowerCase().includes(String(materialFilter).toLowerCase())) return false;
      if(filters.stone){const v=mf["custom.stone_type"];if(!String(Array.isArray(v)?v.join(","):v??"").toLowerCase().includes(String(filters.stone).toLowerCase())) return false;}
      if(filters.gender){const v=mf["custom.gender"];if(!String(Array.isArray(v)?v.join(","):v??"").toLowerCase().includes(String(filters.gender).toLowerCase())) return false;}
      if(sizeProducts&&!sizeProducts.has(String(p.id))) return false;
      if(filters.availability==="in_stock"&&p.availability!=="InStock") return false;
      if(filters.availability==="out_of_stock"&&p.availability!=="OutOfStock") return false;
      if(min!==null&&Number.isFinite(min)&&Number(p.priceAmount)<min) return false;
      if(max!==null&&Number.isFinite(max)&&Number(p.priceAmount)>max) return false;
      if(collectionHandles&&!collectionHandles.has(p.slug)) return false;
      if(filters.metafield){
        const parts=String(filters.metafield).split(":");const key=parts.shift()||"";const expected=parts.join(":").toLowerCase();
        const actual=mf[key];const valueText=Array.isArray(actual)?actual.join(","):typeof actual==="object"?JSON.stringify(actual):String(actual??"");
        if(!valueText.toLowerCase().includes(expected)) return false;
      }
      if(q){const hay=[p.name,p.category,p.material,p.tag,p.story,...(p.tags||[]),...Object.values(mf)].map(v=>typeof v==="object"?JSON.stringify(v):String(v||""));if(!hay.some(v=>v.toLowerCase().includes(q))) return false;}
      return true;
    });
    return filtered.map((p:any)=>({...p,metafields:metafields.get(p.id)||{}}));
  }

  async product(handle:string){
    const detail=await this.productsService.getStorefrontDetailByHandle(handle);
    const p=detail.product;
    const media=detail.media||[];
    const primary=media[0]?.renditions?.find((r:any)=>r.preset==="pdp_desktop"&&r.format==="webp"&&r.url)?.url||media[0]?.responsive?.pdp_desktop||media[0]?.url||"";
    const secondary=media[1]?.renditions?.find((r:any)=>r.preset==="pdp_desktop"&&r.format==="webp"&&r.url)?.url||media[1]?.responsive?.pdp_desktop||media[1]?.url||primary;
    const variants=(detail.variants||[]).filter((v:any)=>v.status==="active").map((v:any)=>({
      id:v.id,sku:v.sku,title:v.title,price:Number(v.price),compareAtPrice:v.compare_at_price?Number(v.compare_at_price):null,
      inventory:Number(v.inventory),status:v.status,mediaSetId:v.media_set_id,selectedOptions:v.selected_options||{},
    }));
    const seo=await this.seoService.storefront("product",p.id);
    const mf=await this.db.query<any>("select namespace,key,value,value_type from resource_metafields where store_id=$1 and resource_type='product' and resource_id=$2 order by namespace,key",[p.store_id,p.id]);

    return {
      id:p.id,slug:p.handle,name:p.title,price:"Rs. "+Number(p.price_amount).toLocaleString("en-PK"),
      priceAmount:Number(p.price_amount),inventory:Number(p.inventory||0),currency:"PKR",tag:p.tag||"",image:primary,secondaryImage:secondary,
      category:p.category||"Jewelry",story:this.descriptionText(p.description),descriptionHtml:this.descriptionHtml(p.description),material:p.material||"",
      availability:Number(p.inventory)>0?"InStock":"OutOfStock",featured:p.featured,productType:p.product_type||"",tags:detail.product.tags||[],
      options:(detail.options||[]).map((o:any)=>({id:o.id,name:o.name,isVisual:o.is_visual,values:o.values})),
      variants,
      mediaSets:(detail.mediaSets||[]).map((m:any)=>({id:m.id,name:m.name,matchOptions:m.match_options,isDefault:m.is_default})),
      media,
      metafields:Object.fromEntries(mf.rows.map((x:any)=>[x.namespace+"."+x.key,x.value])),
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
    const products=await this.products({});
    const order=collection.productHandles||[];
    const bySlug=new Map(products.map((product:any)=>[product.slug,product]));
    const orderedProducts=order.map((slug:string)=>bySlug.get(slug)).filter(Boolean);
    const seo=await this.seoService.storefront("collection",collection.id);
    return {
      ...collection,
      products:orderedProducts,
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
    const q=String(raw||"").trim();
    if(q.length<2) return {query:q.toLowerCase(),items:[]};
    const items=(await this.products({q})).slice(0,24);
    return {query:q.toLowerCase(),items};
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

  config(){
    return {
      store:{name:"Jewelry Store",currency:"PKR",locale:"en-PK"},
      checkout:{paymentMethods:["cod"],shippingMethods:["standard"]},
      features:{variants:true,responsiveMedia:true,seo:true,multichannel:true,mediaProvider:process.env.MEDIA_STORAGE_PROVIDER||"source-url",dynamicImageTransforms:Boolean(process.env.CLOUDFLARE_IMAGE_RESIZING_BASE_URL)},
    };
  }
}
