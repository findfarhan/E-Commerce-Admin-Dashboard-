import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class CollectionsService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }

  private async smartProductHandles(collection:any){
    const storeId=collection.store_id||await this.storeId();
    const rules=Array.isArray(collection.rules)?collection.rules:[];
    if(!rules.length) return [];
    const clauses:string[]=[];const params:any[]=[storeId];let i=2;
    const fieldMap:Record<string,string>={category:"p.category",material:"p.material",vendor:"p.vendor",product_type:"p.product_type",tag:"p.tag",status:"p.status",featured:"p.featured::text"};
    for(const rule of rules){
      const field=String(rule?.field||""),op=String(rule?.operator||"equals"),value=String(rule?.value??"");
      let expr="";
      if(field.startsWith("metafield:")){
        const [namespace,key]=field.slice(10).split(".");if(!namespace||!key) continue;
        const pn="$"+i++,pk="$"+i++,pv="$"+i++;params.push(namespace,key,value);
        const cmp=op==="contains"?"(rm.value #>> '{}') ilike '%'||"+pv+"||'%'":op==="not_equals"?"(rm.value #>> '{}')<>"+pv:"(rm.value #>> '{}')="+pv;
        expr="exists(select 1 from resource_metafields rm where rm.store_id=p.store_id and rm.resource_type='product' and rm.resource_id=p.id and rm.namespace="+pn+" and rm.key="+pk+" and "+cmp+")";
      }else{
        const col=fieldMap[field];if(!col) continue;const pv="$"+i++;params.push(value);
        expr=op==="contains"?"coalesce("+col+",'') ilike '%'||"+pv+"||'%'":op==="not_equals"?"coalesce("+col+",'')<>"+pv:"coalesce("+col+",'')="+pv;
      }
      clauses.push(expr);
    }
    if(!clauses.length) return [];
    const join=collection.match_type==="any"?" or ":" and ";
    const sort=String(collection.merchandising?.sort||"newest");
    const order=sort==="title"?"p.title asc":sort==="price_asc"?"coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) asc":sort==="price_desc"?"coalesce((select min(v.price) from product_variants v where v.product_id=p.id and v.status='active'),0) desc":"p.created_at desc";
    const r=await this.db.query<any>("select p.handle from products p where p.store_id=$1 and p.status='active' and (p.published_at is null or p.published_at<=now()) and ("+clauses.join(join)+") order by "+order,params);
    return r.rows.map((x:any)=>x.handle);
  }

  async list(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select c.*,(select count(*)::int from collection_products cp where cp.collection_id=c.id) as manual_product_count from collections c where c.store_id=$1 order by c.position,c.created_at",[storeId]);
    const items=[] as any[];
    for(const row of result.rows){
      const count=row.collection_type==="smart"?(await this.smartProductHandles(row)).length:Number(row.manual_product_count||0);
      items.push({...row,product_count:count});
    }
    return {items};
  }

  async detail(id:string){
    const storeId=await this.storeId();
    const collection=await this.db.query<any>("select * from collections where id=$1 and store_id=$2 limit 1",[id,storeId]);
    if(!collection.rowCount) throw new NotFoundException("Collection not found");
    let products:any[]=[];
    if(collection.rows[0].collection_type==="smart"){
      const handles=await this.smartProductHandles(collection.rows[0]);
      if(handles.length){const p=await this.db.query<any>("select id,handle,title,status,0 position from products where store_id=$1 and handle=any($2::text[]) order by title",[storeId,handles]);products=p.rows;}
    }else{
      const p=await this.db.query<any>("select p.id,p.handle,p.title,p.status,cp.position from collection_products cp join products p on p.id=cp.product_id where cp.collection_id=$1 order by cp.position",[id]);products=p.rows;
    }
    return {collection:collection.rows[0],products};
  }

  async create(body:any){
    const storeId=await this.storeId();
    const handle=String(body?.handle||"").trim().toLowerCase();
    const title=String(body?.title||"").trim();
    if(!handle||!title) throw new BadRequestException("handle and title are required");
    const collectionType=String(body?.collectionType||"manual");if(!["manual","smart"].includes(collectionType)) throw new BadRequestException("Invalid collection type");
    const result=await this.db.query<any>("insert into collections(store_id,handle,title,subtitle,description,image_url,status,position,collection_type,rules,match_type,publish_at,unpublish_at,merchandising) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14::jsonb) returning *",[storeId,handle,title,body.subtitle??null,body.description??null,body.imageUrl??null,body.status??"active",Number(body.position||0),collectionType,JSON.stringify(Array.isArray(body?.rules)?body.rules:[]),String(body?.matchType||"all"),body?.publishAt??null,body?.unpublishAt??null,JSON.stringify(body?.merchandising||{})]);
    return result.rows[0];
  }

  async update(id:string,body:any){
    const storeId=await this.storeId();
    const allowed:{key:string;column:string}[]=[
      {key:"handle",column:"handle"},{key:"title",column:"title"},{key:"subtitle",column:"subtitle"},
      {key:"description",column:"description"},{key:"imageUrl",column:"image_url"},
      {key:"status",column:"status"},{key:"position",column:"position"},{key:"collectionType",column:"collection_type"},
      {key:"rules",column:"rules"},{key:"matchType",column:"match_type"},{key:"publishAt",column:"publish_at"},{key:"unpublishAt",column:"unpublish_at"},{key:"merchandising",column:"merchandising"},
    ];
    const sets:string[]=[];const params:any[]=[];
    for(const item of allowed){
      if(body[item.key]!==undefined){const value=["rules","merchandising"].includes(item.key)?JSON.stringify(body[item.key]):body[item.key];params.push(value);sets.push(item.column+"=$"+params.length+(["rules","merchandising"].includes(item.key)?"::jsonb":""));}
    }
    if(!sets.length) return this.detail(id);
    params.push(id,storeId);
    const result=await this.db.query<any>("update collections set "+sets.join(",")+",updated_at=now() where id=$"+(params.length-1)+" and store_id=$"+params.length+" returning *",params);
    if(!result.rowCount) throw new NotFoundException("Collection not found");
    return result.rows[0];
  }

  async setProducts(id:string,body:any){
    const storeId=await this.storeId();
    const productIds=Array.isArray(body?.productIds)?body.productIds.map(String):[];
    await this.db.transaction(async client=>{
      const found=await client.query("select id from collections where id=$1 and store_id=$2",[id,storeId]);
      if(!found.rowCount) throw new NotFoundException("Collection not found");
      await client.query("delete from collection_products where collection_id=$1",[id]);
      let position=0;
      for(const productId of productIds){
        const product=await client.query("select id from products where id=$1 and store_id=$2",[productId,storeId]);
        if(!product.rowCount) throw new BadRequestException("Unknown product in collection");
        await client.query("insert into collection_products(collection_id,product_id,position) values($1,$2,$3)",[id,productId,position++]);
      }
    });
    return this.detail(id);
  }

  async archive(id:string){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("update collections set status='archived',updated_at=now() where id=$1 and store_id=$2 returning id,status",[id,storeId]);
    if(!result.rowCount) throw new NotFoundException("Collection not found");
    return result.rows[0];
  }

  async storefrontList(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>("select c.*,c.image_url as image from collections c join stores s on s.id=c.store_id where s.domain=$1 and c.status='active' and (c.publish_at is null or c.publish_at<=now()) and (c.unpublish_at is null or c.unpublish_at>now()) order by c.position",[domain]);
    const out=[] as any[];for(const row of result.rows){const count=row.collection_type==="smart"?(await this.smartProductHandles(row)).length:Number((await this.db.query<any>("select count(*)::int n from collection_products where collection_id=$1",[row.id])).rows[0]?.n||0);out.push({id:row.id,handle:row.handle,title:row.title,subtitle:row.subtitle,description:row.description,image:row.image,position:row.position,product_count:count,collectionType:row.collection_type});}return out;
  }

  async storefrontDetail(handle:string){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const collection=await this.db.query<any>("select c.*,c.image_url as image from collections c join stores s on s.id=c.store_id where s.domain=$1 and c.handle=$2 and c.status='active' and (c.publish_at is null or c.publish_at<=now()) and (c.unpublish_at is null or c.unpublish_at>now()) limit 1",[domain,handle]);
    if(!collection.rowCount) throw new NotFoundException("Collection not found");
    let handles:string[];if(collection.rows[0].collection_type==="smart")handles=await this.smartProductHandles(collection.rows[0]);else{const products=await this.db.query<any>("select p.handle from collection_products cp join products p on p.id=cp.product_id where cp.collection_id=$1 and p.status='active' order by cp.position",[collection.rows[0].id]);handles=products.rows.map((p:any)=>p.handle);}
    return {...collection.rows[0],productHandles:handles};
  }
}
