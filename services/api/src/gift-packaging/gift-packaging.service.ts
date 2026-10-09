import {BadRequestException,ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import type {PoolClient} from "pg";
import {DatabaseService} from "../database/database.service";

type PackagingRow={
 id:string;store_id:string;sku:string;title:string;description:string;image_url:string|null;
 price:string;inventory:number;weight_grams:number;taxable:boolean;status:string;position:number;
};
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const amount=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

@Injectable()
export class GiftPackagingService{
 constructor(private readonly db:DatabaseService){}
 async schemaReady(client?:PoolClient){
  const query="select to_regclass('public.gift_packaging_options') is not null and to_regclass('public.gift_packaging_movements') is not null as ready";
  const result=client?await client.query<{ready:boolean}>(query):await this.db.query<{ready:boolean}>(query);
  return result.rows[0]?.ready===true;
 }
 private async requireSchema(){
  if(!await this.schemaReady())throw new ServiceUnavailableException("Gift packaging setup is not activated until migration 025 is installed");
 }
 private async storeId(){
  const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
  const res=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
  if(!res.rowCount)throw new NotFoundException("Store is not configured");
  return res.rows[0].id;
 }
 private toPublic(row:PackagingRow){
  return {id:row.id,sku:row.sku,title:row.title,description:row.description,
   imageUrl:row.image_url,price:amount(Number(row.price)),inventory:Number(row.inventory),
   weightGrams:Number(row.weight_grams),taxable:Boolean(row.taxable),status:row.status,position:Number(row.position)};
 }
 async listPublic(){
  if(!await this.schemaReady())return {items:[]};
  const storeId=await this.storeId();
  const result=await this.db.query<PackagingRow>(
   "select * from gift_packaging_options where store_id=$1 and status='active' and inventory>0 order by position,title limit 100",[storeId]);
  return {items:result.rows.map(x=>this.toPublic(x))};
 }
 async listAdmin(){
  if(!await this.schemaReady())return {ready:false,items:[]};
  const storeId=await this.storeId();
  const result=await this.db.query<PackagingRow>("select * from gift_packaging_options where store_id=$1 order by position,title limit 300",[storeId]);
  return {ready:true,items:result.rows.map(x=>this.toPublic(x))};
 }
 private input(body:any){
  const title=String(body?.title||"").trim();
  const sku=String(body?.sku||"").trim().toUpperCase();
  const description=String(body?.description||"").trim();
  const rawImage=String(body?.imageUrl||"").trim();
  const imageUrl=rawImage||null;
  const status=String(body?.status||"draft");
  const price=Number(body?.price),inventory=Number(body?.inventory),weight=Number(body?.weightGrams||0);
  const position=Number(body?.position||0);
  const taxable=body?.taxable===true;
  if(title.length<2||title.length>130||! /^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(sku)||description.length>1200)throw new BadRequestException("Valid packaging title, SKU and description are required");
  if(!Number.isFinite(price)||price<0||price>100000||Math.abs(price*100-Math.round(price*100))>0.000001||!Number.isInteger(inventory)||inventory<0||inventory>1000000||!Number.isInteger(weight)||weight<0||weight>25000||!Number.isInteger(position)||position<0||position>10000)throw new BadRequestException("Invalid packaging price, stock, weight or position");
  if(!["draft","active","archived"].includes(status))throw new BadRequestException("Invalid packaging status");
  if(imageUrl&&(!imageUrl.startsWith("https://")||imageUrl.length>1000))throw new BadRequestException("Packaging image must use a secure HTTPS URL");
  return {title,sku,description,imageUrl,status,price:amount(price),inventory,weight,taxable,position};
 }
 async save(id:string|null,body:any){
  await this.requireSchema();
  const field=this.input(body);
  const storeId=await this.storeId();
  return this.db.transaction(async client=>{
   if(id&&!uuid(id))throw new BadRequestException("Invalid packaging ID");
   let previous:PackagingRow|undefined;
   let next:PackagingRow;
   if(id){
    const result=await client.query<PackagingRow>("select * from gift_packaging_options where id=$1 and store_id=$2 for update",[id,storeId]);
    if(!result.rowCount)throw new NotFoundException("Packaging option not found");
    previous=result.rows[0];
    const changed=await client.query<PackagingRow>(
     "update gift_packaging_options set title=$1,sku=$2,description=$3,image_url=$4,status=$5,price=$6,inventory=$7,weight_grams=$8,taxable=$9,position=$10,updated_at=now() where id=$11 and store_id=$12 returning *",
     [field.title,field.sku,field.description,field.imageUrl,field.status,field.price,field.inventory,field.weight,field.taxable,field.position,id,storeId]);
    next=changed.rows[0];
   }else{
    const result=await client.query<PackagingRow>(
     "insert into gift_packaging_options(store_id,sku,title,description,image_url,status,price,inventory,weight_grams,taxable,position) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *",
     [storeId,field.sku,field.title,field.description,field.imageUrl,field.status,field.price,field.inventory,field.weight,field.taxable,field.position]);
    next=result.rows[0];
   }
   await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state) values($1,'admin',$2,'gift_packaging',$3,$4::jsonb,$5::jsonb)",
    [storeId,id?"gift_packaging.updated":"gift_packaging.created",next.id,JSON.stringify(previous||null),JSON.stringify(next)]);
   return {ok:true,id:next.id,item:this.toPublic(next)};
  });
 }
 async archive(id:string){
  await this.requireSchema();
  const storeId=await this.storeId();
  return this.db.transaction(async client=>{
   const previous=await client.query<PackagingRow>("select * from gift_packaging_options where id=$1 and store_id=$2 for update",[id,storeId]);
   if(!previous.rowCount)throw new NotFoundException("Packaging option not found");
   if(previous.rows[0].status==="archived")return {ok:true,idempotent:true};
   const updated=await client.query<PackagingRow>("update gift_packaging_options set status='archived',updated_at=now() where id=$1 and store_id=$2 returning *",[id,storeId]);
   await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state) values($1,'admin','gift_packaging.archived','gift_packaging',$2,$3::jsonb,$4::jsonb)",
     [storeId,id,JSON.stringify(previous.rows[0]),JSON.stringify(updated.rows[0])]);
   return {ok:true};
  });
 }
 async quote(client:PoolClient,storeId:string,id:string|null,lock=false){
  if(!id)return null;
  if(!uuid(id))throw new BadRequestException("Invalid gift packaging selection");
  if(!await this.schemaReady(client))throw new ServiceUnavailableException("Gift packaging is temporarily unavailable");
  const result=await client.query<PackagingRow>(
   "select * from gift_packaging_options where id=$1 and store_id=$2 and status='active'"+(lock?" for update":""),
   [id,storeId]);
  if(!result.rowCount||Number(result.rows[0].inventory)<1)throw new ConflictException("The selected gift packaging is unavailable. Please choose another.");
  return this.toPublic(result.rows[0]);
 }
 /** Must run inside the existing order-creation transaction after saving the order. */
 async consume(client:PoolClient,storeId:string,orderId:string,optionId:string){
  const selected=await this.quote(client,storeId,optionId,true);
  if(!selected)throw new ConflictException("Gift packaging is unavailable");
  const updated=await client.query<{inventory:number}>(
   "update gift_packaging_options set inventory=inventory-1,updated_at=now() where id=$1 and store_id=$2 and inventory>=1 returning inventory",[optionId,storeId]);
  if(!updated.rowCount)throw new ConflictException("Gift packaging sold out");
  await client.query(
   "insert into gift_packaging_movements(store_id,gift_packaging_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,actor) values($1,$2,$3,'order_sale',-1,$4,$5,'checkout')",
   [storeId,optionId,orderId,selected.inventory,Number(updated.rows[0].inventory)]);
 }
}
