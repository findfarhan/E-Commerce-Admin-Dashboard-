import {BadRequestException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {GovernanceService} from "./governance.service";
import {StoreContextService} from "./store-context.service";

@Injectable()
export class CrmPlatformService{
  constructor(private readonly db:DatabaseService,private readonly context:StoreContextService,private readonly governance:GovernanceService){}

  async customerProfile(customerId:string){
    const storeId=await this.context.storeId();
    const customer=await this.db.query<any>("select * from customers where id=$1 and store_id=$2",[customerId,storeId]);
    if(!customer.rowCount) throw new NotFoundException("Customer not found");
    const [addresses,tags,notes,orders,metrics]=await Promise.all([
      this.db.query<any>("select * from customer_addresses where customer_id=$1 order by is_default_shipping desc,is_default_billing desc,created_at",[customerId]),
      this.db.query<any>("select tag from customer_tags where customer_id=$1 order by tag",[customerId]),
      this.db.query<any>("select * from customer_notes where customer_id=$1 order by created_at desc",[customerId]),
      this.db.query<any>("select id,order_number,status,payment_status,fulfillment_status,total,created_at from orders where customer_id=$1 and store_id=$2 order by created_at desc",[customerId,storeId]),
      this.db.query<any>(
        `select count(*)::int as orders,coalesce(sum(total) filter(where payment_status in ('paid','partially_refunded')),0) as lifetime_value,
         coalesce(avg(total),0) as aov,max(created_at) as last_order_at,min(created_at) as first_order_at
         from orders where customer_id=$1 and store_id=$2`,
        [customerId,storeId]
      ),
    ]);
    return {customer:customer.rows[0],addresses:addresses.rows,tags:tags.rows.map((r:any)=>r.tag),notes:notes.rows,orders:orders.rows,metrics:metrics.rows[0]};
  }

  async addAddress(customerId:string,body:any){
    const storeId=await this.context.storeId();
    const customer=await this.db.query<any>("select id from customers where id=$1 and store_id=$2",[customerId,storeId]);
    if(!customer.rowCount) throw new NotFoundException("Customer not found");
    const line1=String(body?.line1||"").trim(),city=String(body?.city||"").trim(),country=String(body?.country||"Pakistan").trim();
    if(!line1||!city||!country) throw new BadRequestException("Address line, city and country are required");
    return this.db.transaction(async client=>{
      if(body?.isDefaultShipping===true) await client.query("update customer_addresses set is_default_shipping=false where customer_id=$1",[customerId]);
      if(body?.isDefaultBilling===true) await client.query("update customer_addresses set is_default_billing=false where customer_id=$1",[customerId]);
      const result=await client.query<any>(
        `insert into customer_addresses(customer_id,address_type,label,recipient_name,phone,line1,line2,city,region,postal_code,country,is_default_shipping,is_default_billing)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
        [customerId,String(body?.addressType||"shipping"),String(body?.label||"").trim()||null,String(body?.recipientName||"").trim()||null,String(body?.phone||"").trim()||null,line1,String(body?.line2||"").trim()||null,city,String(body?.region||"").trim()||null,String(body?.postalCode||"").trim()||null,country,Boolean(body?.isDefaultShipping),Boolean(body?.isDefaultBilling)]
      );
      await this.governance.audit(storeId,"customer.address.created","customer",customerId,{actor:body?.actor,after:result.rows[0]},client);
      return result.rows[0];
    });
  }

  async updateAddress(customerId:string,addressId:string,body:any){
    const storeId=await this.context.storeId();
    return this.db.transaction(async client=>{
      const current=await client.query<any>("select a.* from customer_addresses a join customers c on c.id=a.customer_id where a.id=$1 and a.customer_id=$2 and c.store_id=$3 for update",[addressId,customerId,storeId]);
      if(!current.rowCount) throw new NotFoundException("Customer address not found");
      if(body?.isDefaultShipping===true) await client.query("update customer_addresses set is_default_shipping=false where customer_id=$1",[customerId]);
      if(body?.isDefaultBilling===true) await client.query("update customer_addresses set is_default_billing=false where customer_id=$1",[customerId]);
      const row={...current.rows[0],...{
        address_type:body?.addressType??current.rows[0].address_type,label:body?.label??current.rows[0].label,
        recipient_name:body?.recipientName??current.rows[0].recipient_name,phone:body?.phone??current.rows[0].phone,
        line1:body?.line1??current.rows[0].line1,line2:body?.line2??current.rows[0].line2,city:body?.city??current.rows[0].city,
        region:body?.region??current.rows[0].region,postal_code:body?.postalCode??current.rows[0].postal_code,country:body?.country??current.rows[0].country,
        is_default_shipping:body?.isDefaultShipping===undefined?current.rows[0].is_default_shipping:Boolean(body.isDefaultShipping),
        is_default_billing:body?.isDefaultBilling===undefined?current.rows[0].is_default_billing:Boolean(body.isDefaultBilling),
      }};
      if(!String(row.line1||"").trim()||!String(row.city||"").trim()||!String(row.country||"").trim()) throw new BadRequestException("Address is incomplete");
      const result=await client.query<any>(
        `update customer_addresses set address_type=$1,label=$2,recipient_name=$3,phone=$4,line1=$5,line2=$6,city=$7,region=$8,postal_code=$9,country=$10,is_default_shipping=$11,is_default_billing=$12,updated_at=now()
         where id=$13 returning *`,
        [row.address_type,row.label,row.recipient_name,row.phone,row.line1,row.line2,row.city,row.region,row.postal_code,row.country,row.is_default_shipping,row.is_default_billing,addressId]
      );
      await this.governance.audit(storeId,"customer.address.updated","customer",customerId,{actor:body?.actor,before:current.rows[0],after:result.rows[0]},client);
      return result.rows[0];
    });
  }

  async deleteAddress(customerId:string,addressId:string){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>("delete from customer_addresses a using customers c where a.id=$1 and a.customer_id=$2 and c.id=a.customer_id and c.store_id=$3 returning a.*",[addressId,customerId,storeId]);
    if(!result.rowCount) throw new NotFoundException("Customer address not found");
    await this.governance.audit(storeId,"customer.address.deleted","customer",customerId,{before:result.rows[0]});
    return {ok:true,id:addressId};
  }

  async setTags(customerId:string,body:any){
    const storeId=await this.context.storeId();
    const tags=Array.isArray(body?.tags)?body.tags.map((v:any)=>String(v).trim()).filter(Boolean):String(body?.tags||"").split(",").map((v:string)=>v.trim()).filter(Boolean);
    const customer=await this.db.query<any>("select id from customers where id=$1 and store_id=$2",[customerId,storeId]);
    if(!customer.rowCount) throw new NotFoundException("Customer not found");
    await this.db.transaction(async client=>{
      await client.query("delete from customer_tags where customer_id=$1",[customerId]);
      for(const tag of [...new Set(tags)]) await client.query("insert into customer_tags(customer_id,tag) values($1,$2)",[customerId,tag]);
      await this.governance.audit(storeId,"customer.tags.updated","customer",customerId,{actor:body?.actor,after:{tags}},client);
    });
    return {customerId,tags:[...new Set(tags)]};
  }
}
