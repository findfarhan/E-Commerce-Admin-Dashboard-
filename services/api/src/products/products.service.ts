import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {randomUUID} from "node:crypto";
import sanitizeHtml from "sanitize-html";
import {DatabaseService} from "../database/database.service";
import {ImageDeliveryService} from "../media/image-delivery.service";

@Injectable()
export class ProductsService{
  constructor(
    private readonly db:DatabaseService,
    private readonly delivery:ImageDeliveryService,
  ){}

  private async auditProduct(storeId:string,action:string,resourceId:string,before:any,after:any,metadata:any={}){
    await this.db.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state,metadata) values($1,'admin',$2,'product',$3,$4::jsonb,$5::jsonb,$6::jsonb)",[storeId,action,resourceId,JSON.stringify(before||null),JSON.stringify(after||null),JSON.stringify(metadata||{})]);
  }

  private sanitizeDescription(value:any){
    if(value===null||value===undefined) return null;
    const clean=sanitizeHtml(String(value),{
      allowedTags:["p","br","strong","b","em","i","h2","h3","ul","ol","li","blockquote","a"],
      allowedAttributes:{a:["href"]},
      allowedSchemes:["http","https","mailto"],
      disallowedTagsMode:"discard",
    }).trim();
    return clean||null;
  }

  private descriptionText(value:any){
    return sanitizeHtml(String(value||""),{allowedTags:[],allowedAttributes:{}})
      .replace(/\s+/g," ")
      .trim();
  }

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured for "+domain);
    return result.rows[0].id;
  }

  async listAdmin(filters:any={}){
    const storeId=await this.storeId();
    const where:string[]=["p.store_id=$1"];const params:any[]=[storeId];let i=2;
    const add=(sql:string,value:any)=>{params.push(value);where.push(sql.replace("?", "$"+i++));};
    if(filters.status)add("p.status=?",String(filters.status));
    if(filters.category)add("lower(coalesce(p.category,''))=lower(?)",String(filters.category));
    if(filters.vendor)add("lower(coalesce(p.vendor,'')) like lower('%'||?||'%')",String(filters.vendor));
    if(filters.productType)add("lower(coalesce(p.product_type,'')) like lower('%'||?||'%')",String(filters.productType));
    if(filters.q){
      const n="$"+i++;params.push("%"+String(filters.q).trim()+"%");
      where.push("(p.title ilike "+n+" or p.handle ilike "+n+" or coalesce(p.category,'') ilike "+n+" or coalesce(p.material,'') ilike "+n+" or coalesce(p.vendor,'') ilike "+n+" or exists(select 1 from product_variants vx where vx.product_id=p.id and vx.sku ilike "+n+") or exists(select 1 from product_tags pt where pt.product_id=p.id and pt.tag ilike "+n+"))");
    }
    if(filters.stock==="low") where.push("exists(select 1 from product_variants vx where vx.product_id=p.id and vx.status='active' and vx.inventory<=3)");
    if(filters.stock==="out") where.push("not exists(select 1 from product_variants vx where vx.product_id=p.id and vx.status='active' and vx.inventory>0)");
    if(filters.metafield){
      const raw=String(filters.metafield);const colon=raw.indexOf(":");if(colon>0){const full=raw.slice(0,colon),value=raw.slice(colon+1);const dot=full.indexOf(".");if(dot>0){const ns=full.slice(0,dot),key=full.slice(dot+1);const p1="$"+i++,p2="$"+i++,p3="$"+i++;params.push(ns,key,"%"+value+"%");where.push("exists(select 1 from resource_metafields rm where rm.store_id=p.store_id and rm.resource_type='product' and rm.resource_id=p.id and rm.namespace="+p1+" and rm.key="+p2+" and (rm.value #>> '{}') ilike "+p3+")");}}}
    const sql="select p.*, (select v.sku from product_variants v where v.product_id=p.id order by v.created_at limit 1) as primary_sku, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory, (select count(*)::int from product_variants v where v.product_id=p.id) as variant_count, (select count(*)::int from product_media_sets ms where ms.product_id=p.id) as media_set_count from products p where "+where.join(" and ")+" order by p.created_at desc limit 1000";
    const result=await this.db.query<any>(sql,params);
    return {items:result.rows};
  }

  async getAdminDetail(id:string){return this.getDetailBy("id",id,false);}
  async getStorefrontDetailByHandle(handle:string){return this.getDetailBy("handle",handle,true);}

  private async getDetailBy(field:"id"|"handle",value:string,storefront:boolean){
    const storeId=await this.storeId();
    const sql="select p.*, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price_amount, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory from products p where p.store_id=$1 and p."+field+"=$2 "+(storefront?"and p.status='active' and (p.published_at is null or p.published_at<=now()) ":"")+"limit 1";
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
        url:r.objectKey?this.delivery.renditionPublicUrl(r.objectKey):null,
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

    const tags=await this.db.query<any>("select tag from product_tags where product_id=$1 order by tag",[product.id]);
    return {
      product:{...product,tags:tags.rows.map((x:any)=>x.tag)},
      options:options.rows,
      variants:variants.rows,
      mediaSets:mediaSets.rows,
      media:normalizedMedia,
    };
  }

  async listStorefront(){
    const storeId=await this.storeId();
    const products=await this.db.query<any>(
      "select p.*, coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) as price_amount, coalesce((select sum(v.inventory) from product_variants v where v.product_id=p.id and v.status='active'),0) as inventory, coalesce((select array_agg(pt.tag order by pt.tag) from product_tags pt where pt.product_id=p.id),'{}'::text[]) as tags from products p where p.store_id=$1 and p.status='active' and (p.published_at is null or p.published_at<=now()) order by p.created_at",
      [storeId]
    );

    const media=await this.db.query<any>(
      "select pm.* from product_media pm join products p on p.id=pm.product_id where p.store_id=$1 order by pm.product_id, case when pm.role='primary' then 0 else 1 end,pm.position,pm.created_at",
      [storeId]
    );
    // Pre-generated WebP card assets avoid shipping full-size originals when
    // Cloudflare dynamic Image Resizing is not configured.
    const mediaIds=media.rows.map((m:any)=>m.id);
    const prepared=new Map<string,string>();
    if(mediaIds.length&&!this.delivery.dynamicTransformsEnabled()){
      const renditions=await this.db.query<any>(
        "select distinct on (media_id) media_id,object_key from media_renditions where media_id=any($1::uuid[]) and status='ready' and preset='card_desktop' and format='webp' order by media_id",
        [mediaIds]
      );
      for(const item of renditions.rows) {
        if(item.object_key) prepared.set(String(item.media_id),this.delivery.renditionPublicUrl(String(item.object_key)));
      }
    }
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
      const primaryUrl=primary?(prepared.get(String(primary.id))||this.delivery.url(primary,"card_desktop")):null;
      const secondaryUrl=secondary?(prepared.get(String(secondary.id))||this.delivery.url(secondary,"card_desktop")):primaryUrl;
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
        story:this.descriptionText(p.description),
        material:p.material||"",
        sku:null,
        availability:Number(p.inventory)>0?"InStock":"OutOfStock",
        featured:p.featured,
        productType:p.product_type||"",
        vendor:p.vendor||"",
        tags:p.tags||[],
      };
    });
  }

  async createProduct(body:any){
    const storeId=await this.storeId();
    const handle=String(body?.handle||"").trim().toLowerCase();
    const title=String(body?.title||"").trim();
    const status=String(body?.status||"draft");
    if(!handle||!title) throw new BadRequestException("handle and title are required");
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) throw new BadRequestException("Handle must use lowercase letters, numbers and single hyphens");
    if(!["draft","active","archived"].includes(status)) throw new BadRequestException("Invalid product status");

    const hasOpeningVariant=body.price!==undefined;
    const price=hasOpeningVariant?Number(body.price):0;
    const inventory=Number(body?.inventory??0);
    if(hasOpeningVariant&&(!Number.isFinite(price)||price<0)) throw new BadRequestException("A valid non-negative price is required");
    if(!Number.isInteger(inventory)||inventory<0) throw new BadRequestException("Opening inventory must be a non-negative whole number");

    const productId=randomUUID();
    await this.db.transaction(async client=>{
      await client.query(
        "insert into products(id,store_id,handle,title,description,status,category,material,tag,featured,product_type,vendor,published_at,taxable,weight_grams) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        [productId,storeId,handle,title,this.sanitizeDescription(body.description),status,body.category??null,body.material??null,body.tag??null,Boolean(body.featured),body.productType??null,body.vendor??null,body.publishedAt??null,body.taxable!==false,body.weightGrams===null||body.weightGrams===undefined?null:Number(body.weightGrams)]
      );
      if(hasOpeningVariant){
        const sku=String(body.sku||("JS-"+handle.toUpperCase().replace(/[^A-Z0-9]+/g,"-"))).trim();
        if(!sku) throw new BadRequestException("SKU is required");
        const insertedVariant=await client.query<any>(
          "insert into product_variants(product_id,sku,price,inventory,status,cost_price,weight_grams) values($1,$2,$3,$4,'active',$5,$6) returning id",
          [productId,sku,price,inventory,body.costPrice===undefined||body.costPrice===null?null:Number(body.costPrice),body.variantWeightGrams===undefined||body.variantWeightGrams===null?null:Number(body.variantWeightGrams)]
        );
        const defaultLocation=await client.query<any>("select id from locations where store_id=$1 and active=true order by is_default desc,created_at limit 1",[storeId]);
        if(defaultLocation.rowCount) await client.query("insert into inventory_levels(location_id,variant_id,on_hand,reserved) values($1,$2,$3,0) on conflict(location_id,variant_id) do nothing",[defaultLocation.rows[0].id,insertedVariant.rows[0].id,inventory]);
      }
      const tags=Array.isArray(body.tags)?body.tags.map((x:any)=>String(x).trim()).filter(Boolean):[];
      for(const tag of [...new Set(tags)]){
        await client.query("insert into product_tags(product_id,tag) values($1,$2) on conflict do nothing",[productId,tag]);
      }
    });

    const created=await this.getAdminDetail(productId);
    await this.auditProduct(storeId,"product.created",productId,null,created.product);
    return created;
  }

  async updateProduct(id:string,body:any){
    const storeId=await this.storeId();
    const current=await this.db.query<any>("select * from products where id=$1 and store_id=$2 limit 1",[id,storeId]);
    if(!current.rowCount) throw new NotFoundException("Product not found");

    if(body.handle!==undefined){
      body.handle=String(body.handle).trim().toLowerCase();
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.handle)) throw new BadRequestException("Handle must use lowercase letters, numbers and single hyphens");
    }
    if(body.title!==undefined&&!String(body.title).trim()) throw new BadRequestException("Product title is required");
    if(body.status!==undefined&&!["draft","active","archived"].includes(String(body.status))) throw new BadRequestException("Invalid product status");

    if(body.status==="active"){
      const activeVariants=await this.db.query<{count:number}>("select count(*)::int as count from product_variants where product_id=$1 and status='active'",[id]);
      if(Number(activeVariants.rows[0]?.count||0)<1) throw new BadRequestException("Add at least one active variant before publishing the product");
    }

    if(body.productType!==undefined) body.product_type=body.productType;
    if(body.publishedAt!==undefined) body.published_at=body.publishedAt||null;
    if(body.weightGrams!==undefined) body.weight_grams=body.weightGrams===null?null:Number(body.weightGrams);
    const allowed=["handle","title","description","status","category","material","tag","featured","product_type","vendor","published_at","taxable","weight_grams"] as const;
    const sets:string[]=[];
    const params:any[]=[];
    for(const key of allowed){
      if(body[key]!==undefined){
        params.push(key==="title"?String(body[key]).trim():key==="description"?this.sanitizeDescription(body[key]):body[key]);
        sets.push(key+"=$"+params.length);
      }
    }
    if(!sets.length) return this.getAdminDetail(id);
    params.push(id,storeId);
    const result=await this.db.query<any>(
      "update products set "+sets.join(",")+",updated_at=now() where id=$"+(params.length-1)+" and store_id=$"+params.length+" returning id",
      params
    );
    if(!result.rowCount) throw new NotFoundException("Product not found");
    if(Array.isArray(body.tags)){
      await this.db.transaction(async client=>{
        await client.query("delete from product_tags where product_id=$1",[id]);
        for(const tag of [...new Set(body.tags.map((x:any)=>String(x).trim()).filter(Boolean))] as string[]){
          await client.query("insert into product_tags(product_id,tag) values($1,$2) on conflict do nothing",[id,tag]);
        }
      });
    }
    const updatedDetail=await this.getAdminDetail(id);
    await this.auditProduct(storeId,"product.updated",id,current.rows[0],updatedDetail.product);
    return updatedDetail;
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
    const price=Number(body.price);
    const inventory=Number(body.inventory??0);
    const compareAt=body.compareAtPrice===null||body.compareAtPrice===undefined?null:Number(body.compareAtPrice);
    const status=String(body.status||"active");
    if(!Number.isFinite(price)||price<0) throw new BadRequestException("Variant price must be a non-negative number");
    if(!Number.isInteger(inventory)||inventory<0) throw new BadRequestException("Variant inventory must be a non-negative whole number");
    if(compareAt!==null&&(!Number.isFinite(compareAt)||compareAt<0)) throw new BadRequestException("Compare-at price must be non-negative");
    if(!["active","draft"].includes(status)) throw new BadRequestException("Invalid variant status");

    const variantId=randomUUID();
    await this.db.transaction(async client=>{
      await client.query(
        "insert into product_variants(id,product_id,sku,price,compare_at_price,inventory,status,media_set_id,cost_price,weight_grams) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [variantId,productId,String(body.sku).trim(),price,compareAt,inventory,status,body.mediaSetId??null,body.costPrice===undefined||body.costPrice===null?null:Number(body.costPrice),body.weightGrams===undefined||body.weightGrams===null?null:Number(body.weightGrams)]
      );
      const productStore=await client.query<any>("select store_id from products where id=$1 limit 1",[productId]);
      if(productStore.rowCount){
        const defaultLocation=await client.query<any>("select id from locations where store_id=$1 and active=true order by is_default desc,created_at limit 1",[productStore.rows[0].store_id]);
        if(defaultLocation.rowCount) await client.query("insert into inventory_levels(location_id,variant_id,on_hand,reserved) values($1,$2,$3,0) on conflict(location_id,variant_id) do nothing",[defaultLocation.rows[0].id,variantId,inventory]);
      }

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

  async duplicateProduct(id:string){
    const storeId=await this.storeId();
    const newProductId=randomUUID();

    await this.db.transaction(async client=>{
      const sourceResult=await client.query<any>("select * from products where id=$1 and store_id=$2 limit 1",[id,storeId]);
      if(!sourceResult.rowCount) throw new NotFoundException("Product not found");
      const source=sourceResult.rows[0];

      const baseHandle=(String(source.handle||"product")+"-copy").replace(/-+/g,"-");
      let handle=baseHandle;
      let suffix=2;
      while((await client.query("select 1 from products where store_id=$1 and handle=$2 limit 1",[storeId,handle])).rowCount){
        handle=baseHandle+"-"+suffix++;
        if(suffix>1000) throw new BadRequestException("Could not generate a unique duplicate handle");
      }

      await client.query(
        "insert into products(id,store_id,handle,title,description,status,category,material,tag,featured) values($1,$2,$3,$4,$5,'draft',$6,$7,$8,false)",
        [newProductId,storeId,handle,String(source.title)+" Copy",source.description,source.category,source.material,source.tag]
      );

      const valueMap=new Map<string,string>();
      const options=await client.query<any>("select * from product_options where product_id=$1 order by position",[id]);
      for(const option of options.rows){
        const optionInsert=await client.query<any>(
          "insert into product_options(product_id,name,position,is_visual) values($1,$2,$3,$4) returning id",
          [newProductId,option.name,option.position,option.is_visual]
        );
        const values=await client.query<any>("select * from product_option_values where option_id=$1 order by position",[option.id]);
        for(const value of values.rows){
          const inserted=await client.query<any>(
            "insert into product_option_values(option_id,value,position,swatch_color) values($1,$2,$3,$4) returning id",
            [optionInsert.rows[0].id,value.value,value.position,value.swatch_color]
          );
          valueMap.set(value.id,inserted.rows[0].id);
        }
      }

      const mediaSetMap=new Map<string,string>();
      const mediaSets=await client.query<any>("select * from product_media_sets where product_id=$1 order by created_at",[id]);
      for(const set of mediaSets.rows){
        const inserted=await client.query<any>(
          "insert into product_media_sets(product_id,name,match_options,is_default) values($1,$2,$3::jsonb,$4) returning id",
          [newProductId,set.name,JSON.stringify(set.match_options||{}),set.is_default]
        );
        mediaSetMap.set(set.id,inserted.rows[0].id);
      }

      const variants=await client.query<any>("select * from product_variants where product_id=$1 order by created_at",[id]);
      const skuToken=newProductId.slice(0,6).toUpperCase();
      for(const variant of variants.rows){
        const newVariantId=randomUUID();
        await client.query(
          "insert into product_variants(id,product_id,sku,price,compare_at_price,inventory,status,media_set_id,cost_price,weight_grams) values($1,$2,$3,$4,$5,0,'draft',$6,$7,$8)",
          [newVariantId,newProductId,String(variant.sku)+"-COPY-"+skuToken,variant.price,variant.compare_at_price,variant.media_set_id?mediaSetMap.get(variant.media_set_id)||null:null,variant.cost_price,variant.weight_grams]
        );
        const defaultLocation=await client.query<any>("select id from locations where store_id=$1 and active=true order by is_default desc,created_at limit 1",[storeId]);
        if(defaultLocation.rowCount) await client.query("insert into inventory_levels(location_id,variant_id,on_hand,reserved) values($1,$2,0,0) on conflict(location_id,variant_id) do nothing",[defaultLocation.rows[0].id,newVariantId]);
        const selected=await client.query<any>("select option_value_id from variant_option_values where variant_id=$1",[variant.id]);
        for(const selectedValue of selected.rows){
          const newValueId=valueMap.get(selectedValue.option_value_id);
          if(newValueId) await client.query("insert into variant_option_values(variant_id,option_value_id) values($1,$2)",[newVariantId,newValueId]);
        }
      }

      const media=await client.query<any>("select * from product_media where product_id=$1 order by position,created_at",[id]);
      for(const item of media.rows){
        await client.query(
          "insert into product_media(product_id,media_set_id,master_object_key,mime_type,width,height,focal_x,focal_y,alt_text,position,source_url,role,storage_provider,storage_bucket,external_asset_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
          [newProductId,item.media_set_id?mediaSetMap.get(item.media_set_id)||null:null,item.master_object_key,item.mime_type,item.width,item.height,item.focal_x,item.focal_y,item.alt_text,item.position,item.source_url,item.role,item.storage_provider,item.storage_bucket,item.external_asset_id]
        );
      }
    });

    return this.getAdminDetail(newProductId);
  }

  async archiveProduct(id:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("update products set status='archived',updated_at=now() where id=$1 and store_id=$2 returning id,status",[id,storeId]);
    if(!result.rowCount) throw new NotFoundException("Product not found");
    await this.auditProduct(storeId,"product.archived",id,null,result.rows[0]);
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
    const status=body?.status!==undefined?String(body.status):current.status;
    const mediaSetId=body?.mediaSetId!==undefined?(body.mediaSetId||null):current.media_set_id;
    const costPrice=body?.costPrice!==undefined?(body.costPrice===null?null:Number(body.costPrice)):current.cost_price;
    const weightGrams=body?.weightGrams!==undefined?(body.weightGrams===null?null:Number(body.weightGrams)):current.weight_grams;
    if(!sku||!Number.isFinite(price)||price<0) throw new BadRequestException("Invalid variant values");
    if(compareAt!==null&&(!Number.isFinite(Number(compareAt))||Number(compareAt)<0)) throw new BadRequestException("Invalid compare-at price");
    if(!["active","draft"].includes(status)) throw new BadRequestException("Invalid variant status");
    await this.db.query("update product_variants set sku=$1,price=$2,compare_at_price=$3,status=$4,media_set_id=$5,cost_price=$6,weight_grams=$7,updated_at=now() where id=$8",[sku,price,compareAt,status,mediaSetId,costPrice,weightGrams,variantId]);
    const detail=await this.getAdminDetail(productId);
    const afterVariant=detail.variants.find((v:any)=>v.id===variantId);
    const storeId=await this.storeId();
    await this.auditProduct(storeId,"variant.updated",productId,current,afterVariant,{variantId});
    return detail;
  }

  async archiveVariant(productId:string,variantId:string){
    const storeId=await this.storeId();
    return this.db.transaction(async client=>{
      const product=await client.query<any>("select id,status from products where id=$1 and store_id=$2 for update",[productId,storeId]);
      if(!product.rowCount) throw new NotFoundException("Product not found");

      const result=await client.query<any>("update product_variants set status='draft',updated_at=now() where id=$1 and product_id=$2 returning id,status",[variantId,productId]);
      if(!result.rowCount) throw new NotFoundException("Variant not found");

      if(product.rows[0].status==="active"){
        const remaining=await client.query<{count:number}>("select count(*)::int as count from product_variants where product_id=$1 and status='active'",[productId]);
        if(Number(remaining.rows[0]?.count||0)===0){
          await client.query("update products set status='draft',updated_at=now() where id=$1",[productId]);
        }
      }
      return result.rows[0];
    });
  }

  async generateVariants(productId:string,body:any){
    const detail=await this.getAdminDetail(productId);
    if(!detail.options.length) throw new BadRequestException("Add product options before generating variants");
    const basePrice=Number(body?.price);
    const inventory=Number(body?.inventory??0);
    if(!Number.isFinite(basePrice)||basePrice<0||!Number.isInteger(inventory)||inventory<0) throw new BadRequestException("Valid price and whole-number inventory are required");

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
