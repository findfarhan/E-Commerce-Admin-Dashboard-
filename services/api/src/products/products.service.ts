import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class ProductsService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 order by created_at limit 1",[domain]);
    if(result.rowCount) return result.rows[0].id;
    const fallback=await this.db.query<{id:string}>("select id from stores order by created_at limit 1");
    if(!fallback.rowCount) throw new NotFoundException("Store is not configured");
    return fallback.rows[0].id;
  }

  private mediaUrl(sourceUrl:string|null,objectKey:string|null){
    if(objectKey&&process.env.R2_PUBLIC_BASE_URL) return process.env.R2_PUBLIC_BASE_URL.replace(/\/$/,"")+"/"+objectKey;
    return sourceUrl;
  }

  async listAdmin(){
    const storeId=await this.storeId();
    const sql="select p.*, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory, (select count(*)::int from product_variants v where v.product_id=p.id) as variant_count, (select count(*)::int from product_media_sets ms where ms.product_id=p.id) as media_set_count from products p where p.store_id=$1 order by p.created_at asc";
    const result=await this.db.query<any>(sql,[storeId]);
    return {items:result.rows};
  }

  async getAdminDetail(id:string){return this.getDetailBy("id",id,false);}
  async getStorefrontDetailByHandle(handle:string){return this.getDetailBy("handle",handle,true);}

  private async getDetailBy(field:"id"|"handle",value:string,storefront:boolean){
    const storeId=await this.storeId();
    const sql="select p.*, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price_amount, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory from products p where p.store_id=$1 and p."+field+"=$2 "+(storefront?"and p.status='active' ":"")+"limit 1";
    const productResult=await this.db.query<any>(sql,[storeId,value]);
    if(!productResult.rowCount) throw new NotFoundException("Product not found");
    const product=productResult.rows[0];

    const options=await this.db.query<any>("select o.id,o.name,o.position,o.is_visual, coalesce(json_agg(json_build_object('id',ov.id,'value',ov.value,'position',ov.position,'swatchColor',ov.swatch_color) order by ov.position) filter(where ov.id is not null),'[]') as values from product_options o left join product_option_values ov on ov.option_id=o.id where o.product_id=$1 group by o.id order by o.position",[product.id]);

    const variants=await this.db.query<any>("select v.*, coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options from product_variants v where v.product_id=$1 order by v.created_at",[product.id]);

    const mediaSets=await this.db.query<any>("select ms.* from product_media_sets ms where ms.product_id=$1 order by ms.is_default desc,ms.created_at",[product.id]);

    const media=await this.db.query<any>("select pm.*, coalesce((select json_agg(json_build_object('preset',mr.preset,'format',mr.format,'objectKey',mr.object_key,'width',mr.width,'height',mr.height,'status',mr.status) order by mr.preset,mr.format) from media_renditions mr where mr.media_id=pm.id and mr.status='ready'),'[]') as renditions from product_media pm where pm.product_id=$1 order by pm.position,pm.created_at",[product.id]);

    const normalizedMedia=media.rows.map((m:any)=>({
      ...m,
      url:this.mediaUrl(m.source_url,null),
      renditions:(m.renditions||[]).map((r:any)=>({...r,url:this.mediaUrl(null,r.objectKey)})),
    }));

    return {product,options:options.rows,variants:variants.rows,mediaSets:mediaSets.rows,media:normalizedMedia};
  }

  async listStorefront(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select p.*, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price_amount, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory, (select pm.source_url from product_media pm where pm.product_id=p.id order by case when pm.role='primary' then 0 else 1 end,pm.position limit 1) as image, (select pm.source_url from product_media pm where pm.product_id=p.id order by pm.position offset 1 limit 1) as secondary_image from products p where p.store_id=$1 and p.status='active' order by p.created_at",[storeId]);
    return result.rows.map((p:any)=>({
      id:p.id,slug:p.handle,name:p.title,
      price:"Rs. "+Number(p.price_amount).toLocaleString("en-PK"),
      priceAmount:Number(p.price_amount),currency:"PKR",tag:p.tag||"",
      image:p.image||"",secondaryImage:p.secondary_image||p.image||"",
      category:p.category||"Jewelry",story:p.description||"",material:p.material||"",
      sku:null,availability:Number(p.inventory)>0?"InStock":"OutOfStock",featured:p.featured,
    }));
  }

  async createProduct(body:any){
    const storeId=await this.storeId();
    if(!body?.handle||!body?.title) throw new BadRequestException("handle and title are required");
    const productId=randomUUID();
    await this.db.transaction(async client=>{
      await client.query("insert into products(id,store_id,handle,title,description,status,category,material,tag,featured) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[productId,storeId,body.handle,body.title,body.description??null,body.status??"draft",body.category??null,body.material??null,body.tag??null,Boolean(body.featured)]);
      if(body.price!==undefined){
        const sku=body.sku||("JS-"+body.handle.toUpperCase().replace(/[^A-Z0-9]+/g,"-"));
        await client.query("insert into product_variants(product_id,sku,price,inventory,status) values($1,$2,$3,$4,'active')",[productId,sku,Number(body.price),Number(body.inventory||0)]);
      }
    });
    return this.getAdminDetail(productId);
  }

  async updateProduct(id:string,body:any){
    const allowed=["handle","title","description","status","category","material","tag","featured"] as const;
    const sets:string[]=[];const params:any[]=[];
    for(const key of allowed){
      if(body[key]!==undefined){params.push(body[key]);sets.push(key+"=$"+params.length);}
    }
    if(!sets.length) return this.getAdminDetail(id);
    params.push(id);
    await this.db.query("update products set "+sets.join(",")+",updated_at=now() where id=$"+params.length,params);
    return this.getAdminDetail(id);
  }

  async createOption(productId:string,body:any){
    if(!body?.name||!Array.isArray(body.values)||!body.values.length) throw new BadRequestException("name and values are required");
    await this.db.transaction(async client=>{
      const option=await client.query<{id:string}>("insert into product_options(product_id,name,position,is_visual) values($1,$2,$3,$4) returning id",[productId,body.name,Number(body.position||0),Boolean(body.isVisual)]);
      let index=0;
      for(const raw of body.values){
        const value=typeof raw==="string"?raw:raw.value;
        const swatch=typeof raw==="string"?null:(raw.swatchColor??null);
        await client.query("insert into product_option_values(option_id,value,position,swatch_color) values($1,$2,$3,$4)",[option.rows[0].id,value,index++,swatch]);
      }
    });
    return this.getAdminDetail(productId);
  }

  async createVariant(productId:string,body:any){
    if(!body?.sku||body.price===undefined||!body?.selectedOptions) throw new BadRequestException("sku, price and selectedOptions are required");
    const variantId=randomUUID();
    await this.db.transaction(async client=>{
      await client.query("insert into product_variants(id,product_id,sku,price,compare_at_price,inventory,status,media_set_id) values($1,$2,$3,$4,$5,$6,$7,$8)",[variantId,productId,body.sku,Number(body.price),body.compareAtPrice??null,Number(body.inventory||0),body.status??"active",body.mediaSetId??null]);
      for(const [name,value] of Object.entries(body.selectedOptions as Record<string,string>)){
        const found=await client.query<{id:string}>("select ov.id from product_option_values ov join product_options o on o.id=ov.option_id where o.product_id=$1 and o.name=$2 and ov.value=$3 limit 1",[productId,name,value]);
        if(!found.rowCount) throw new BadRequestException("Unknown option value: "+name+"="+value);
        await client.query("insert into variant_option_values(variant_id,option_value_id) values($1,$2)",[variantId,found.rows[0].id]);
      }
    });
    return this.getAdminDetail(productId);
  }

  async createMediaSet(productId:string,body:any){
    if(!body?.name||!body?.matchOptions) throw new BadRequestException("name and matchOptions are required");
    const result=await this.db.query<any>("insert into product_media_sets(product_id,name,match_options,is_default) values($1,$2,$3::jsonb,$4) returning *",[productId,body.name,JSON.stringify(body.matchOptions),Boolean(body.isDefault)]);
    return result.rows[0];
  }
}
