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
    const allowedStatus=["confirmed","processing","completed"];
    const allowedFulfillment=["unfulfilled","processing","fulfilled","returned"];
        const status=body?.status!==undefined?String(body.status):undefined;
    const fulfillment=body?.fulfillmentStatus!==undefined?String(body.fulfillmentStatus):undefined;
    const payment=body?.paymentStatus!==undefined?String(body.paymentStatus):undefined;
    if(status&&!allowedStatus.includes(status)) throw new BadRequestException("Invalid order status");
    if(fulfillment&&!allowedFulfillment.includes(fulfillment)) throw new BadRequestException("Invalid fulfillment status");
    if(payment!==undefined) throw new BadRequestException("Payment status must be changed through a verified payment workflow");

    return this.db.transaction(async client=>{
      const current=await client.query<any>("select * from orders where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!current.rowCount) throw new NotFoundException("Order not found");
      if(current.rows[0].status==="canceled") throw new ConflictException("Canceled orders cannot be edited");
      if(current.rows[0].fulfillment_status==="returned") throw new ConflictException("Returned orders cannot be edited through generic update");
      if(status==="completed" && current.rows[0].fulfillment_status!=="fulfilled") throw new ConflictException("Order must be fulfilled before completion");
      const nextStatus=status||current.rows[0].status;
      const nextFulfillment=fulfillment||current.rows[0].fulfillment_status;
      const nextPayment=payment||current.rows[0].payment_status;
      const trackingCarrier=body?.trackingCarrier!==undefined?String(body.trackingCarrier||"").trim().slice(0,80):(current.rows[0].tracking_carrier||null);
      const trackingNumber=body?.trackingNumber!==undefined?String(body.trackingNumber||"").trim().slice(0,120):(current.rows[0].tracking_number||null);
      let trackingUrl=body?.trackingUrl!==undefined?String(body.trackingUrl||"").trim():(current.rows[0].tracking_url||"");
      if(trackingUrl){
        try{
          const parsed=new URL(trackingUrl);
          if(!["http:","https:"].includes(parsed.protocol)) throw new Error("protocol");
          trackingUrl=parsed.toString().slice(0,1000);
        }catch{
          throw new BadRequestException("Tracking URL must be a valid http(s) link");
        }
      }
      const updated=await client.query<any>(
        "update orders set status=$1,fulfillment_status=$2,payment_status=$3,notes=coalesce($4,notes),tracking_carrier=$5,tracking_number=$6,tracking_url=$7,fulfilled_at=case when $2='fulfilled' and fulfilled_at is null then now() else fulfilled_at end where id=$8 returning *",
        [nextStatus,nextFulfillment,nextPayment,body?.notes??null,trackingCarrier||null,trackingNumber||null,trackingUrl||null,id]
      );
      await client.query(
        "insert into order_events(order_id,event_type,message,metadata) values($1,'order.updated',$2,$3::jsonb)",
        [id,"Order state updated",JSON.stringify({status:nextStatus,fulfillmentStatus:nextFulfillment,paymentStatus:nextPayment,trackingCarrier:trackingCarrier||null,trackingNumber:trackingNumber||null})]
      );
      const customer=await client.query<any>("select email,name from customers where id=$1",[current.rows[0].customer_id]);
      const recipient=customer.rows[0]?.email;
      await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state) values($1,'admin','order.state_updated','order',$2,$3::jsonb,$4::jsonb)",[storeId,id,JSON.stringify(current.rows[0]),JSON.stringify(updated.rows[0])]);
      if(recipient&&(nextFulfillment==="fulfilled"||trackingNumber)){
        const template=trackingNumber?"tracking_update":"fulfillment";
        await client.query("insert into message_outbox(store_id,channel,template_key,recipient,subject,payload,status) values($1,'email',$2,$3,$4,$5::jsonb,'queued')",[storeId,template,recipient,"Order "+current.rows[0].order_number+" "+(trackingNumber?"tracking":"fulfillment"),JSON.stringify({orderId:id,orderNumber:current.rows[0].order_number,trackingCarrier,trackingNumber,trackingUrl,fulfillmentStatus:nextFulfillment})]);
      }
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
      let restoreLocationId=order.rows[0].fulfillment_location_id||null;
      if(!restoreLocationId){
        const location=await client.query<any>("select id from locations where store_id=$1 and active=true order by is_default desc,created_at limit 1",[storeId]);
        restoreLocationId=location.rows[0]?.id||null;
      }

      const items=await client.query<any>("select * from order_items where order_id=$1",[id]);
      for(const item of items.rows){
        if(!item.variant_id) continue;
        const variant=await client.query<any>("select inventory from product_variants where id=$1 for update",[item.variant_id]);
        if(!variant.rowCount) continue;
        const before=Number(variant.rows[0].inventory);
        const after=before+Number(item.quantity);
        if(restoreLocationId) await client.query("insert into inventory_levels(location_id,variant_id,on_hand,reserved) values($1,$2,$3,0) on conflict(location_id,variant_id) do update set on_hand=inventory_levels.on_hand+excluded.on_hand,updated_at=now()",[restoreLocationId,item.variant_id,Number(item.quantity)]);
        await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,item.variant_id]);
        await client.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_cancel',$4,$5,$6,$7,'admin')",[storeId,item.variant_id,id,Number(item.quantity),before,after,String(body?.reason||"Order canceled")]);
      }

      const updated=await client.query<any>("update orders set status='canceled',fulfillment_status='unfulfilled',notes=coalesce($1,notes) where id=$2 returning *",[body?.reason??null,id]);
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.canceled',$2,$3::jsonb)",[id,"Order canceled and inventory restored",JSON.stringify({reason:body?.reason||null})]);
      const customer=await client.query<any>("select email from customers where id=$1",[order.rows[0].customer_id]);
      if(customer.rows[0]?.email) await client.query("insert into message_outbox(store_id,channel,template_key,recipient,subject,payload,status) values($1,'email','order_cancellation',$2,$3,$4::jsonb,'queued')",[storeId,customer.rows[0].email,"Order "+order.rows[0].order_number+" canceled",JSON.stringify({orderId:id,orderNumber:order.rows[0].order_number,reason:body?.reason||null})]);
      await client.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'order_canceled','warning',$2,$3,'order',$4)",[storeId,"Order canceled "+order.rows[0].order_number,String(body?.reason||"Order canceled"),id]);
      await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state,metadata) values($1,'admin','order.canceled','order',$2,$3::jsonb,$4::jsonb,$5::jsonb)",[storeId,id,JSON.stringify(order.rows[0]),JSON.stringify(updated.rows[0]),JSON.stringify({reason:body?.reason||null})]);
      return {ok:true,idempotent:false,order:updated.rows[0]};
    });
  }

  async returnOrder(id:string,body:any){
    const storeId=await this.storeId();
    return this.db.transaction(async client=>{
      const order=await client.query<any>("select * from orders where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!order.rowCount) throw new NotFoundException("Order not found");
      const current=order.rows[0];
      if(current.fulfillment_status==="returned") return {ok:true,idempotent:true,order:current};
      if(current.status==="canceled") throw new ConflictException("Canceled orders cannot be returned");
      if(current.fulfillment_status!=="fulfilled") throw new ConflictException("Only fulfilled orders can be returned");
      // Returned stock remains quarantined until a separate inspection/restock workflow exists.
      // Do not increase sellable inventory for an uninspected return.
      const items=await client.query<any>("select * from order_items where order_id=$1",[id]);
      const returnedItems=items.rows.map((item:any)=>({variantId:item.variant_id,quantity:Number(item.quantity)}));

      const paymentStatus=current.payment_status;
      const updated=await client.query<any>("update orders set fulfillment_status='returned',payment_status=$1,notes=coalesce($2,notes) where id=$3 returning *",[paymentStatus,body?.reason??null,id]);
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.returned',$2,$3::jsonb)",[id,"Order returned; stock awaiting inspection",JSON.stringify({reason:body?.reason||null,paymentStatus,returnedItems,inventoryRestocked:false})]);
      const customer=await client.query<any>("select email from customers where id=$1",[order.rows[0].customer_id]);
      if(customer.rows[0]?.email) await client.query("insert into message_outbox(store_id,channel,template_key,recipient,subject,payload,status) values($1,'email','return_refund',$2,$3,$4::jsonb,'queued')",[storeId,customer.rows[0].email,"Return / refund for "+order.rows[0].order_number,JSON.stringify({orderId:id,orderNumber:order.rows[0].order_number,paymentStatus,reason:body?.reason||null})]);
      await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,before_state,after_state,metadata) values($1,'admin','order.returned','order',$2,$3::jsonb,$4::jsonb,$5::jsonb)",[storeId,id,JSON.stringify(current),JSON.stringify(updated.rows[0]),JSON.stringify({reason:body?.reason||null})]);
      return {ok:true,idempotent:false,order:updated.rows[0]};
    });
  }

}
