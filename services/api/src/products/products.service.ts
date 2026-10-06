import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import {DatabaseService} from "../database/database.service";
import {ImageDeliveryService} from "../media/image-delivery.service";

@Injectable()
export class ProductsService{
  constructor(
    private readonly db:DatabaseService,
    private readonly delivery:ImageDeliveryService,
  ){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 order by created_at limit 1",[domain]);
    if(result.rowCount) return result.rows[0].id;
    const fallback=await this.db.query<{id:string}>("select id from stores order by created_at limit 1");
    if(!fallback.rowCount) throw new NotFoundException("Store is not configured");
    return fallback.rows[0].id;
  }

  async listAdmin(){
    const storeId=await this.storeId();
    const sql="select p.*, (select v.sku from product_variants v where v.product_id=p.id order by v.created_at limit 1) as primary_sku, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory, (select count(*)::int from product_variants v where v.product_id=p.id) as variant_count, (select count(*)::int from product_media_sets ms where ms.product_id=p.id) as media_set_count from products p where p.store_id=$1 order by p.created_at asc";
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

    const options=await this.db.query<any>(
      "select o.id,o.name,o.position,o.is_visual, coalesce(json_agg(json_build_object('id',ov.id,'value',ov.value,'position',ov.position,'swatchColor',ov.swatch_color) order by ov.position) filter(where ov.id is not null),'[]') as values from product_options o left join product_option_values ov on ov.option_id=o.id where o.product_id=$1 group by o.id order by o.position",
      [product.id]
    );

    const variants=await this.db.query<any>(
      "select v.*, coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options from product_variants v where v.product_id=$1 order by v.created_at",
      [product.id]
    );

    const mediaSets=await this.db.query<any>(
      "select ms.* from product_media_sets ms where ms.product_id=$1 order by ms.is_default desc,ms.created_at",
      [product.id]
    );

    const media=await this.db.query<any>(
      "select pm.*, coalesce((select json_agg(json_build_object('preset',mr.preset,'format',mr.format,'objectKey',mr.object_key,'width',mr.width,'height',mr.height,'status',mr.status) order by mr.preset,mr.format) from media_renditions mr where mr.media_id=pm.id and mr.status='ready'),'[]') as stored_renditions from product_media pm where pm.product_id=$1 order by pm.position,pm.created_at",
      [product.id]
    );

    const normalizedMedia=media.rows.map((m:any)=>{
      const sourceUrl=this.delivery.sourceUrl(m);
      const responsive=this.delivery.responsiveSet(m);
      const stored=(m.stored_renditions||[]).map((r:any)=>({
        ...r,
        url:r.objectKey&&process.env.R2_PUBLIC_BASE_URL
          ?process.env.R2_PUBLIC_BASE_URL.replace(/\/$/,"")+"/"+r.objectKey
          :null,
      }));
      return {
        id:m.id,
        mediaSetId:m.media_set_id,
        sourceUrl,
        url:sourceUrl,
        role:m.role,
        position:m.position,
        altText:m.alt_text,
        width:m.width,
        height:m.height,
        focalX:Number(m.focal_x??0.5),
        focalY:Number(m.focal_y??0.5),
        responsive,
        renditions:this.delivery.dynamicTransformsEnabled()?[]:stored,
      };
    });

    return {
      product,
      options:options.rows,
      variants:variants.rows,
      mediaSets:mediaSets.rows,
      media:normalizedMedia,
    };
  }

  async listStorefront(){
    const storeId=await this.storeId();
    const products=await this.db.query<any>(
      "select p.*, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price_amount, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory from products p where p.store_id=$1 and p.status='active' order by p.created_at",
      [storeId]
    );

    const media=await this.db.query<any>(
      "select pm.* from product_media pm join products p on p.id=pm.product_id where p.store_id=$1 order by pm.product_id, case when pm.role='primary' then 0 else 1 end,pm.position,pm.created_at",
      [storeId]
    );
    const byProduct=new Map<string,any[]>();
    for(const item of media.rows){
      const list=byProduct.get(item.product_id)||[];
      list.push(item);
      byProduct.set(item.product_id,list);
    }

    return products.rows.map((p:any)=>{
      const productMedia=byProduct.get(p.id)||[];
      const primary=productMedia[0];
      const secondary=productMedia[1]||primary;
      const primaryUrl=primary?this.delivery.url(primary,"card_desktop"):null;
      const secondaryUrl=secondary?this.delivery.url(secondary,"card_desktop"):primaryUrl;
      return {
        id:p.id,
        slug:p.handle,
        name:p.title,
        price:"Rs. "+Number(p.price_amount).toLocaleString("en-PK"),
        priceAmount:Number(p.price_amount),
        currency:"PKR",
        tag:p.tag||"",
        image:primaryUrl||this.delivery.sourceUrl(primary||{})||"",
        secondaryImage:secondaryUrl||this.delivery.sourceUrl(secondary||{})||primaryUrl||"",
        category:p.category||"Jewelry",
        story:p.description||"",
        material:p.material||"",
        sku:null,
        availability:Number(p.inventory)>0?"InStock":"OutOfStock",
        featured:p.featured,
      };
    });
  }

  async createProduct(body:any){
    const storeId=await this.storeId();
    if(!body?.handle||!body?.title) throw new BadRequestException("handle and title are required");
    const productId=randomUUID();

    await this.db.transaction(async client=>{
      await client.query(
        "insert into products(id,store_id,handle,title,description,status,category,material,tag,featured) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [productId,storeId,body.handle,body.title,body.description??null,body.status??"draft",body.category??null,body.material??null,body.tag??null,Boolean(body.featured)]
      );
      if(body.price!==undefined){
        const sku=body.sku||("JS-"+body.handle.toUpperCase().replace(/[^A-Z0-9]+/g,"-"));
        await client.query(
          "insert into product_variants(product_id,sku,price,inventory,status) values($1,$2,$3,$4,'active')",
          [productId,sku,Number(body.price),Number(body.inventory||0)]
        );
      }
    });

    return this.getAdminDetail(productId);
  }

  async updateProduct(id:string,body:any){
    const allowed=["handle","title","description","status","category","material","tag","featured"] as const;
    const sets:string[]=[];
    const params:any[]=[];
    for(const key of allowed){
      if(body[key]!==undefined){
        params.push(body[key]);
        sets.push(key+"=$"+params.length);
      }
    }
    if(!sets.length) return this.getAdminDetail(id);
    params.push(id);
    await this.db.query("update products set "+sets.join(",")+",updated_at=now() where id=$"+params.length,params);
    return this.getAdminDetail(id);
  }

  async createOption(productId:string,body:any){
    if(!body?.name||!Array.isArray(body.values)||!body.values.length){
      throw new BadRequestException("name and values are required");
    }

    await this.db.transaction(async client=>{
      const option=await client.query<{id:string}>(
        "insert into product_options(product_id,name,position,is_visual) values($1,$2,$3,$4) returning id",
        [productId,body.name,Number(body.position||0),Boolean(body.isVisual)]
      );
      let index=0;
      for(const raw of body.values){
        const value=typeof raw==="string"?raw:raw.value;
        const swatch=typeof raw==="string"?null:(raw.swatchColor??null);
        await client.query(
          "insert into product_option_values(option_id,value,position,swatch_color) values($1,$2,$3,$4)",
          [option.rows[0].id,value,index++,swatch]
        );
      }
    });

    return this.getAdminDetail(productId);
  }

  async createVariant(productId:string,body:any){
    if(!body?.sku||body.price===undefined||!body?.selectedOptions){
      throw new BadRequestException("sku, price and selectedOptions are required");
    }

    const variantId=randomUUID();
    await this.db.transaction(async client=>{
      await client.query(
        "insert into product_variants(id,product_id,sku,price,compare_at_price,inventory,status,media_set_id) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [variantId,productId,body.sku,Number(body.price),body.compareAtPrice??null,Number(body.inventory||0),body.status??"active",body.mediaSetId??null]
      );

      for(const [name,value] of Object.entries(body.selectedOptions as Record<string,string>)){
        const found=await client.query<{id:string}>(
          "select ov.id from product_option_values ov join product_options o on o.id=ov.option_id where o.product_id=$1 and o.name=$2 and ov.value=$3 limit 1",
          [productId,name,value]
        );
        if(!found.rowCount) throw new BadRequestException("Unknown option value: "+name+"="+value);
        await client.query(
          "insert into variant_option_values(variant_id,option_value_id) values($1,$2)",
          [variantId,found.rows[0].id]
        );
      }
    });

    return this.getAdminDetail(productId);
  }

  async createMediaSet(productId:string,body:any){
    if(!body?.name||!body?.matchOptions){
      throw new BadRequestException("name and matchOptions are required");
    }
    const result=await this.db.query<any>(
      "insert into product_media_sets(product_id,name,match_options,is_default) values($1,$2,$3::jsonb,$4) returning *",
      [productId,body.name,JSON.stringify(body.matchOptions),Boolean(body.isDefault)]
    );
    return result.rows[0];
  }

  async archiveProduct(id:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("update products set status='archived',updated_at=now() where id=$1 and store_id=$2 returning id,status",[id,storeId]);
    if(!result.rowCount) throw new NotFoundException("Product not found");
    return result.rows[0];
  }

  async updateOption(productId:string,optionId:string,body:any){
    const current=await this.db.query<any>("select * from product_options where id=$1 and product_id=$2 limit 1",[optionId,productId]);
    if(!current.rowCount) throw new NotFoundException("Option not found");
    const name=body?.name!==undefined?String(body.name).trim():current.rows[0].name;
    const isVisual=body?.isVisual!==undefined?Boolean(body.isVisual):Boolean(current.rows[0].is_visual);
    const position=body?.position!==undefined?Number(body.position):Number(current.rows[0].position);
    if(!name) throw new BadRequestException("Option name is required");

    await this.db.transaction(async client=>{
      await client.query("update product_options set name=$1,is_visual=$2,position=$3 where id=$4",[name,isVisual,position,optionId]);
      if(Array.isArray(body?.values)){
        const desired=body.values.map((raw:any)=>typeof raw==="string"?{value:raw,swatchColor:null}:{value:String(raw.value||"").trim(),swatchColor:raw.swatchColor??null}).filter((v:any)=>v.value);
        const existing=await client.query<any>("select id,value from product_option_values where option_id=$1 order by position",[optionId]);
        const desiredValues=new Set(desired.map((v:any)=>v.value));
        for(const value of existing.rows){
          if(!desiredValues.has(value.value)){
            const used=await client.query("select 1 from variant_option_values where option_value_id=$1 limit 1",[value.id]);
            if(used.rowCount) throw new BadRequestException("Cannot remove option value used by an existing variant: "+value.value);
            await client.query("delete from product_option_values where id=$1",[value.id]);
          }
        }
        let index=0;
        for(const value of desired){
          const found=existing.rows.find((x:any)=>x.value===value.value);
          if(found){
            await client.query("update product_option_values set position=$1,swatch_color=$2 where id=$3",[index++,value.swatchColor,found.id]);
          }else{
            await client.query("insert into product_option_values(option_id,value,position,swatch_color) values($1,$2,$3,$4)",[optionId,value.value,index++,value.swatchColor]);
          }
        }
      }
    });
    return this.getAdminDetail(productId);
  }

  async deleteOption(productId:string,optionId:string){
    const used=await this.db.query<any>("select count(*)::int as count from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id where ov.option_id=$1",[optionId]);
    if(Number(used.rows[0]?.count||0)>0) throw new BadRequestException("Remove or replace variants using this option before deleting it");
    const result=await this.db.query<any>("delete from product_options where id=$1 and product_id=$2 returning id",[optionId,productId]);
    if(!result.rowCount) throw new NotFoundException("Option not found");
    return {ok:true,id:optionId};
  }

  async updateVariant(productId:string,variantId:string,body:any){
    const found=await this.db.query<any>("select * from product_variants where id=$1 and product_id=$2 limit 1",[variantId,productId]);
    if(!found.rowCount) throw new NotFoundException("Variant not found");
    const current=found.rows[0];
    const sku=body?.sku!==undefined?String(body.sku).trim():current.sku;
    const price=body?.price!==undefined?Number(body.price):Number(current.price);
    const compareAt=body?.compareAtPrice!==undefined?(body.compareAtPrice===null?null:Number(body.compareAtPrice)):current.compare_at_price;
    const inventory=body?.inventory!==undefined?Number(body.inventory):Number(current.inventory);
    const status=body?.status!==undefined?String(body.status):current.status;
    const mediaSetId=body?.mediaSetId!==undefined?(body.mediaSetId||null):current.media_set_id;
    if(!sku||price<0||inventory<0) throw new BadRequestException("Invalid variant values");
    await this.db.query("update product_variants set sku=$1,price=$2,compare_at_price=$3,inventory=$4,status=$5,media_set_id=$6,updated_at=now() where id=$7",[sku,price,compareAt,inventory,status,mediaSetId,variantId]);
    return this.getAdminDetail(productId);
  }

  async archiveVariant(productId:string,variantId:string){
    const result=await this.db.query<any>("update product_variants set status='draft',updated_at=now() where id=$1 and product_id=$2 returning id,status",[variantId,productId]);
    if(!result.rowCount) throw new NotFoundException("Variant not found");
    return result.rows[0];
  }

  async generateVariants(productId:string,body:any){
    const detail=await this.getAdminDetail(productId);
    if(!detail.options.length) throw new BadRequestException("Add product options before generating variants");
    const basePrice=Number(body?.price);
    const inventory=Number(body?.inventory??0);
    if(!Number.isFinite(basePrice)||basePrice<0||inventory<0) throw new BadRequestException("Valid price and inventory are required");

    const combinations:Record<string,string>[]=[];
    const walk=(index:number,current:Record<string,string>)=>{
      if(index>=detail.options.length){combinations.push({...current});return;}
      const option=detail.options[index];
      for(const value of option.values){
        current[option.name]=value.value;
        walk(index+1,current);
      }
      delete current[option.name];
    };
    walk(0,{});

    if(combinations.length>500) throw new BadRequestException("Variant generation is limited to 500 combinations");

    const existing=new Set((detail.variants||[]).map((variant:any)=>JSON.stringify(Object.entries(variant.selected_options||{}).sort())));
    const baseSku=String(body?.baseSku||detail.product.handle||"VAR").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"");

    for(const combo of combinations){
      const key=JSON.stringify(Object.entries(combo).sort());
      if(existing.has(key)) continue;
      const visualEntries=detail.options.filter((option:any)=>option.is_visual).map((option:any)=>[option.name,combo[option.name]]);
      const mediaSet=(detail.mediaSets||[]).find((set:any)=>Object.entries(set.match_options||{}).every(([name,value])=>combo[name]===value));
      const suffix=Object.values(combo).map(value=>String(value).toUpperCase().replace(/[^A-Z0-9]+/g,"").slice(0,4)).join("-");
      await this.createVariant(productId,{
        sku:baseSku+"-"+suffix,
        price:basePrice,
        inventory,
        status:"active",
        mediaSetId:mediaSet?.id??null,
        selectedOptions:combo,
        visualOptions:Object.fromEntries(visualEntries as any),
      });
    }

    return this.getAdminDetail(productId);
  }

}
