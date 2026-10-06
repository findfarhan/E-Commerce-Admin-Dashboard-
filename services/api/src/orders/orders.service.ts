import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class OrdersService{
  constructor(private readonly db:DatabaseService){}

  private async storeId(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<{id:string}>("select id from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0].id;
  }

  async list(){
    const storeId=await this.storeId();
    const result=await this.db.query<any>("select o.id,o.order_number,o.status,o.payment_status,o.fulfillment_status,o.payment_method,o.currency,o.subtotal,o.shipping_amount,o.total,o.source_channel,o.created_at,c.id as customer_id,c.name as customer_name,c.email as customer_email,(select count(*)::int from order_items oi where oi.order_id=o.id) as item_count from orders o left join customers c on c.id=o.customer_id where o.store_id=$1 order by o.created_at desc limit 250",[storeId]);
    return {items:result.rows};
  }

  async detail(id:string){
    const storeId=await this.storeId();
    const order=await this.db.query<any>("select o.*,c.name as customer_name,c.email as customer_email,c.phone as customer_phone from orders o left join customers c on c.id=o.customer_id where o.store_id=$1 and o.id=$2 limit 1",[storeId,id]);
    if(!order.rowCount) throw new NotFoundException("Order not found");
    const items=await this.db.query<any>("select * from order_items where order_id=$1 order by id",[id]);
    const events=await this.db.query<any>("select * from order_events where order_id=$1 order by created_at",[id]);
    return {order:order.rows[0],items:items.rows,events:events.rows};
  }

  async update(id:string,body:any){
    const storeId=await this.storeId();
    const allowedStatus=["confirmed","processing","completed","canceled"];
    const allowedFulfillment=["unfulfilled","processing","fulfilled","returned"];
    const allowedPayment=["pending","paid","refunded","failed"];
    const status=body?.status!==undefined?String(body.status):undefined;
    const fulfillment=body?.fulfillmentStatus!==undefined?String(body.fulfillmentStatus):undefined;
    const payment=body?.paymentStatus!==undefined?String(body.paymentStatus):undefined;
    if(status&&!allowedStatus.includes(status)) throw new BadRequestException("Invalid order status");
    if(fulfillment&&!allowedFulfillment.includes(fulfillment)) throw new BadRequestException("Invalid fulfillment status");
    if(payment&&!allowedPayment.includes(payment)) throw new BadRequestException("Invalid payment status");

    return this.db.transaction(async client=>{
      const current=await client.query<any>("select * from orders where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!current.rowCount) throw new NotFoundException("Order not found");
      if(current.rows[0].status==="canceled") throw new ConflictException("Canceled orders cannot be edited");
      const nextStatus=status||current.rows[0].status;
      const nextFulfillment=fulfillment||current.rows[0].fulfillment_status;
      const nextPayment=payment||current.rows[0].payment_status;
      const updated=await client.query<any>("update orders set status=$1,fulfillment_status=$2,payment_status=$3,notes=coalesce($4,notes) where id=$5 returning *",[nextStatus,nextFulfillment,nextPayment,body?.notes??null,id]);
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.updated',$2,$3::jsonb)",[id,"Order state updated",JSON.stringify({status:nextStatus,fulfillmentStatus:nextFulfillment,paymentStatus:nextPayment})]);
      return updated.rows[0];
    });
  }

  async cancel(id:string,body:any){
    const storeId=await this.storeId();
    return this.db.transaction(async client=>{
      const order=await client.query<any>("select * from orders where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!order.rowCount) throw new NotFoundException("Order not found");
      if(order.rows[0].status==="canceled") return {ok:true,idempotent:true,order:order.rows[0]};
      if(order.rows[0].fulfillment_status==="fulfilled") throw new ConflictException("Fulfilled orders must use a return/refund workflow");

      const items=await client.query<any>("select * from order_items where order_id=$1",[id]);
      for(const item of items.rows){
        if(!item.variant_id) continue;
        const variant=await client.query<any>("select inventory from product_variants where id=$1 for update",[item.variant_id]);
        if(!variant.rowCount) continue;
        const before=Number(variant.rows[0].inventory);
        const after=before+Number(item.quantity);
        await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,item.variant_id]);
        await client.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_cancel',$4,$5,$6,$7,'admin')",[storeId,item.variant_id,id,Number(item.quantity),before,after,String(body?.reason||"Order canceled")]);
      }

      const updated=await client.query<any>("update orders set status='canceled',fulfillment_status='unfulfilled',notes=coalesce($1,notes) where id=$2 returning *",[body?.reason??null,id]);
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.canceled',$2,$3::jsonb)",[id,"Order canceled and inventory restored",JSON.stringify({reason:body?.reason||null})]);
      return {ok:true,idempotent:false,order:updated.rows[0]};
    });
  }
}
