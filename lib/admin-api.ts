import type {Customer,Order,Product,ProductMediaSet,ProductOption,ProductVariant} from "./types";

const apiBase=(process.env.NEXT_PUBLIC_API_URL||"https://e-commerce-admin-dashboard-ptgs.onrender.com").replace(/\/$/,"");
const adminKey=process.env.ADMIN_API_KEY||"";

export async function adminRequest<T>(path:string,_revalidate=0):Promise<T|null>{
  if(!adminKey){
    if(process.env.NODE_ENV==="production") throw new Error("ADMIN_API_KEY is not configured.");
    return null;
  }
  try{
    const response=await fetch(apiBase+path,{
      headers:{Accept:"application/json","X-Admin-Key":adminKey},
      cache:"no-store",
      signal:AbortSignal.timeout(20000),
    });
    if(!response.ok){
      const body=await response.text();
      throw new Error("Admin API "+response.status+": "+(body||response.statusText));
    }
    return await response.json() as T;
  }catch(error){
    if(process.env.NODE_ENV==="production") throw error;
    return null;
  }
}

export async function getAdminProducts(filters:Record<string,string|undefined|null>={}):Promise<Product[]>{
  const query=new URLSearchParams();for(const [key,value] of Object.entries(filters)){if(value)query.set(key,value);}
  const response=await adminRequest<{items:any[]}>("/v1/admin/products"+(query.size?"?"+query.toString():""));
  if(!response) return [];
  return response.items.map((p:any)=>({
    id:p.id,storeId:p.store_id,sku:p.primary_sku||"—",name:p.title,
    inventory:Number(p.inventory||0),price:Number(p.price||0),status:p.status,sales30d:0,
    variantCount:Number(p.variant_count||0),mediaSetCount:Number(p.media_set_count||0),
    handle:p.handle,description:p.description||"",category:p.category||"",material:p.material||"",
    tag:p.tag||"",featured:Boolean(p.featured),productType:p.product_type||"",vendor:p.vendor||"",publishedAt:p.published_at||null,taxable:p.taxable!==false,weightGrams:p.weight_grams===null?null:Number(p.weight_grams),
  }));
}

export async function getAdminProductDetail(id:string){
  const response=await adminRequest<any>("/v1/admin/products/"+encodeURIComponent(id));
  if(!response) return null;

  const product:Product={
    id:response.product.id,storeId:response.product.store_id,sku:response.variants?.[0]?.sku||"—",
    name:response.product.title,inventory:Number(response.product.inventory||0),price:Number(response.product.price_amount||0),
    status:response.product.status,sales30d:0,variantCount:response.variants?.length||0,mediaSetCount:response.mediaSets?.length||0,
    handle:response.product.handle,description:response.product.description||"",category:response.product.category||"",
    material:response.product.material||"",tag:response.product.tag||"",featured:Boolean(response.product.featured),productType:response.product.product_type||"",vendor:response.product.vendor||"",tags:response.product.tags||[],publishedAt:response.product.published_at||null,taxable:response.product.taxable!==false,weightGrams:response.product.weight_grams===null?null:Number(response.product.weight_grams),
  };

  const options:ProductOption[]=(response.options||[]).map((o:any)=>({
    id:o.id,name:o.name,isVisual:Boolean(o.is_visual),
    values:(o.values||[]).map((v:any)=>({id:v.id,value:v.value,swatchColor:v.swatchColor||undefined})),
  }));

  const variants:ProductVariant[]=(response.variants||[]).map((v:any)=>{
    const selectedOptions=v.selected_options||{};
    return {
      id:v.id,productId:v.product_id,sku:v.sku,title:v.title||Object.values(selectedOptions).join(" / "),
      price:Number(v.price||0),inventory:Number(v.inventory||0),selectedOptions,status:v.status==="draft"?"draft":"active",mediaSetId:v.media_set_id||null,costPrice:v.cost_price===null?null:Number(v.cost_price),weightGrams:v.weight_grams===null?null:Number(v.weight_grams),
    };
  });

  const media=response.media||[];
  const mediaSets:ProductMediaSet[]=(response.mediaSets||[]).map((m:any)=>({
    id:m.id,productId:m.product_id,name:m.name,matchOptions:m.match_options||{},
    imageUrls:media.filter((x:any)=>x.mediaSetId===m.id).map((x:any)=>x.responsive?.card_desktop||x.url).filter(Boolean),
    isDefault:Boolean(m.is_default),
  }));

  return {product,options,variants,mediaSets,media,source:"api" as const};
}

export async function getAdminOrders():Promise<Order[]>{
  const response=await adminRequest<{items:any[]}>("/v1/admin/orders",10);
  if(!response) return [];
  return response.items.map((o:any)=>({
    id:o.id,storeId:"",number:o.order_number,customer:o.customer_name||"Guest",email:o.customer_email||"",
    total:Number(o.total||0),status:o.status,paymentStatus:o.payment_status,items:Number(o.item_count||0),
    createdAt:o.created_at?new Date(o.created_at).toLocaleString("en-PK"):"",
  }));
}

export async function getAdminOrderDetail(id:string){
  return adminRequest<any>("/v1/admin/orders/"+encodeURIComponent(id),5);
}

export async function getAdminCustomers():Promise<Customer[]>{
  const response=await adminRequest<{items:any[]}>("/v1/admin/customers",15);
  if(!response) return [];
  return response.items.map((c:any)=>({
    id:c.id,storeId:"",name:c.name||"Guest",email:c.email||"",segment:c.attributes?.segment||"customer",
    orders:Number(c.orders_count||0),lifetimeValue:Number(c.lifetime_value||0),
    lastOrderAt:c.last_order_at?new Date(c.last_order_at).toLocaleDateString("en-PK"):"—",
  }));
}

export async function getAdminCustomerDetail(id:string){
  return adminRequest<any>("/v1/admin/customers/"+encodeURIComponent(id),10);
}

export async function getAdminCollections(){
  const response=await adminRequest<{items:any[]}>("/v1/admin/collections",15);
  return response?.items||[];
}

export async function getAdminCollectionDetail(id:string){
  return adminRequest<any>("/v1/admin/collections/"+encodeURIComponent(id),10);
}

export async function getAdminSeo(resourceType:string,resourceId:string){
  return adminRequest<any>("/v1/admin/seo/"+encodeURIComponent(resourceType)+"/"+encodeURIComponent(resourceId),15);
}

export async function getAdminDashboard(){
  const response=await adminRequest<any>("/v1/admin/dashboard",10);
  if(!response){
    return {
      id:"",name:"Jewelry Store",domain:"",currency:"PKR",timezone:"Asia/Karachi",
      products:0,customers:0,orders_today:0,revenue_today:0,queued_jobs:0,low_stock_variants:0,
      new_commissions:0,subscribers:0,open_checkouts:0,recent_activity:[],source:"unconfigured" as const,
    };
  }
  return {...response,source:"api" as const};
}
