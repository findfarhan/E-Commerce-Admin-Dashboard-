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

  async list(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select c.*,(select count(*)::int from collection_products cp where cp.collection_id=c.id) as product_count from collections c where c.store_id=$1 order by c.position,c.created_at",[storeId]);
    return {items:result.rows};
  }

  async detail(id:string){
    const storeId=await this.storeId();
    const collection=await this.db.query<any>("select * from collections where id=$1 and store_id=$2 limit 1",[id,storeId]);
    if(!collection.rowCount) throw new NotFoundException("Collection not found");
    const products=await this.db.query<any>("select p.id,p.handle,p.title,p.status,cp.position from collection_products cp join products p on p.id=cp.product_id where cp.collection_id=$1 order by cp.position",[id]);
    return {collection:collection.rows[0],products:products.rows};
  }

  async create(body:any){
    const storeId=await this.storeId();
    const handle=String(body?.handle||"").trim().toLowerCase();
    const title=String(body?.title||"").trim();
    if(!handle||!title) throw new BadRequestException("handle and title are required");
    const result=await this.db.query<any>("insert into collections(store_id,handle,title,subtitle,description,image_url,status,position) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",[storeId,handle,title,body.subtitle??null,body.description??null,body.imageUrl??null,body.status??"active",Number(body.position||0)]);
    return result.rows[0];
  }

  async update(id:string,body:any){
    const storeId=await this.storeId();
    const allowed:{key:string;column:string}[]=[
      {key:"handle",column:"handle"},{key:"title",column:"title"},{key:"subtitle",column:"subtitle"},
      {key:"description",column:"description"},{key:"imageUrl",column:"image_url"},
      {key:"status",column:"status"},{key:"position",column:"position"},
    ];
    const sets:string[]=[];const params:any[]=[];
    for(const item of allowed){
      if(body[item.key]!==undefined){params.push(body[item.key]);sets.push(item.column+"=$"+params.length);}
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
    const result=await this.db.query<any>("select c.id,c.handle,c.title,c.subtitle,c.description,c.image_url as image,c.position,c.collection_type,c.publish_at,c.unpublish_at,(select count(*)::int from collection_products cp where cp.collection_id=c.id) as product_count from collections c join stores s on s.id=c.store_id where s.domain=$1 and c.status='active' and (c.publish_at is null or c.publish_at<=now()) and (c.unpublish_at is null or c.unpublish_at>now()) order by c.position",[domain]);
    return result.rows;
  }

  async storefrontDetail(handle:string){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const collection=await this.db.query<any>("select c.id,c.handle,c.title,c.subtitle,c.description,c.image_url as image,c.position,c.collection_type,c.publish_at,c.unpublish_at from collections c join stores s on s.id=c.store_id where s.domain=$1 and c.handle=$2 and c.status='active' and (c.publish_at is null or c.publish_at<=now()) and (c.unpublish_at is null or c.unpublish_at>now()) limit 1",[domain,handle]);
    if(!collection.rowCount) throw new NotFoundException("Collection not found");
    const products=await this.db.query<any>("select p.handle from collection_products cp join products p on p.id=cp.product_id where cp.collection_id=$1 and p.status='active' and (p.published_at is null or p.published_at<=now()) order by cp.position",[collection.rows[0].id]);
    return {...collection.rows[0],productHandles:products.rows.map(p=>p.handle)};
  }
}
