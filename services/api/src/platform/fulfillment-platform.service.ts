import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {GovernanceService} from "./governance.service";
import {StoreContextService} from "./store-context.service";

@Injectable()
export class FulfillmentPlatformService{
  constructor(private readonly db:DatabaseService,private readonly context:StoreContextService,private readonly governance:GovernanceService){}

  async discounts(){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>("select * from discounts where store_id=$1 order by created_at desc",[storeId]);
    return {items:result.rows};
  }

  async createDiscount(body:any){
    const storeId=await this.context.storeId();
    const name=String(body?.name||"").trim();
    const type=String(body?.discountType||"percentage");
    const value=Number(body?.value||0);
    if(!name||!["percentage","fixed_amount","automatic"].includes(type)||!Number.isFinite(value)||value<0) throw new BadRequestException("Invalid discount");
    if(type==="percentage"&&value>100) throw new BadRequestException("Percentage cannot exceed 100");
    const code=String(body?.code||"").trim().toUpperCase()||null;
    const result=await this.db.query<any>(
      `insert into discounts(store_id,name,code,discount_type,value,minimum_subtotal,usage_limit,starts_at,ends_at,active,target_type,target_ids,metadata)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) returning *`,
      [storeId,name,code,type,value,Number(body?.minimumSubtotal||0),body?.usageLimit?Number(body.usageLimit):null,body?.startsAt||null,body?.endsAt||null,body?.active!==false,String(body?.targetType||"order"),Array.isArray(body?.targetIds)?body.targetIds:[],JSON.stringify(body?.metadata||{})]
    );
    await this.governance.audit(storeId,"discount.created","discount",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  async updateDiscount(id:string,body:any){
    const storeId=await this.context.storeId();
    const current=await this.db.query<any>("select * from discounts where id=$1 and store_id=$2",[id,storeId]);
    if(!current.rowCount) throw new NotFoundException("Discount not found");
    const row={...current.rows[0],...{
      name:body?.name??current.rows[0].name,
      code:body?.code===undefined?current.rows[0].code:(String(body.code||"").trim().toUpperCase()||null),
      discount_type:body?.discountType??current.rows[0].discount_type,
      value:body?.value===undefined?current.rows[0].value:Number(body.value),
      minimum_subtotal:body?.minimumSubtotal===undefined?current.rows[0].minimum_subtotal:Number(body.minimumSubtotal),
      usage_limit:body?.usageLimit===undefined?current.rows[0].usage_limit:(body.usageLimit?Number(body.usageLimit):null),
      starts_at:body?.startsAt===undefined?current.rows[0].starts_at:(body.startsAt||null),
      ends_at:body?.endsAt===undefined?current.rows[0].ends_at:(body.endsAt||null),
      active:body?.active===undefined?current.rows[0].active:Boolean(body.active),
      target_type:body?.targetType??current.rows[0].target_type,
      target_ids:body?.targetIds===undefined?current.rows[0].target_ids:(Array.isArray(body.targetIds)?body.targetIds:[]),
      metadata:body?.metadata===undefined?current.rows[0].metadata:(body.metadata||{}),
    }};
    if(!["percentage","fixed_amount","automatic"].includes(String(row.discount_type))) throw new BadRequestException("Invalid discount type");
    if(Number(row.value)<0||row.discount_type==="percentage"&&Number(row.value)>100) throw new BadRequestException("Invalid discount value");
    const result=await this.db.query<any>(
      `update discounts set name=$1,code=$2,discount_type=$3,value=$4,minimum_subtotal=$5,usage_limit=$6,starts_at=$7,ends_at=$8,active=$9,target_type=$10,target_ids=$11,metadata=$12::jsonb,updated_at=now()
       where id=$13 and store_id=$14 returning *`,
      [row.name,row.code,row.discount_type,row.value,row.minimum_subtotal,row.usage_limit,row.starts_at,row.ends_at,row.active,row.target_type,row.target_ids,JSON.stringify(row.metadata||{}),id,storeId]
    );
    await this.governance.audit(storeId,"discount.updated","discount",id,{before:current.rows[0],after:result.rows[0]});
    return result.rows[0];
  }

  async shipping(){
    const storeId=await this.context.storeId();
    const zones=await this.db.query<any>("select * from shipping_zones where store_id=$1 order by priority,created_at",[storeId]);
    const rates=zones.rowCount?await this.db.query<any>("select r.* from shipping_rates r join shipping_zones z on z.id=r.zone_id where z.store_id=$1 order by z.priority,r.priority,r.created_at",[storeId]):{rows:[]};
    return {zones:zones.rows,rates:rates.rows};
  }

  async createShippingZone(body:any){
    const storeId=await this.context.storeId();
    const name=String(body?.name||"").trim();
    if(!name) throw new BadRequestException("Zone name is required");
    const result=await this.db.query<any>(
      "insert into shipping_zones(store_id,name,countries,regions,cities,active,priority) values($1,$2,$3,$4,$5,$6,$7) returning *",
      [storeId,name,Array.isArray(body?.countries)?body.countries:[],Array.isArray(body?.regions)?body.regions:[],Array.isArray(body?.cities)?body.cities:[],body?.active!==false,Number(body?.priority||0)]
    );
    await this.governance.audit(storeId,"shipping.zone.created","shipping_zone",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  async createShippingRate(zoneId:string,body:any){
    const storeId=await this.context.storeId();
    const zone=await this.db.query<any>("select id from shipping_zones where id=$1 and store_id=$2",[zoneId,storeId]);
    if(!zone.rowCount) throw new NotFoundException("Shipping zone not found");
    const type=String(body?.rateType||"flat");
    if(!["flat","free","weight","order_value"].includes(type)) throw new BadRequestException("Invalid shipping rate type");
    const amount=Number(body?.amount||0);
    if(!Number.isFinite(amount)||amount<0) throw new BadRequestException("Invalid shipping amount");
    const result=await this.db.query<any>(
      `insert into shipping_rates(zone_id,name,rate_type,amount,min_order_value,max_order_value,min_weight_grams,max_weight_grams,carrier,service_code,active,priority,metadata)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) returning *`,
      [zoneId,String(body?.name||"Standard").trim(),type,amount,body?.minOrderValue??null,body?.maxOrderValue??null,body?.minWeightGrams??null,body?.maxWeightGrams??null,String(body?.carrier||"").trim()||null,String(body?.serviceCode||"").trim()||null,body?.active!==false,Number(body?.priority||0),JSON.stringify(body?.metadata||{})]
    );
    await this.governance.audit(storeId,"shipping.rate.created","shipping_rate",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  async taxes(){
    const store=await this.context.store();
    const result=await this.db.query<any>("select * from tax_rules where store_id=$1 order by priority,created_at",[store.id]);
    return {pricesIncludeTax:Boolean(store.prices_include_tax),items:result.rows};
  }

  async createTaxRule(body:any){
    const storeId=await this.context.storeId();
    const rate=Number(body?.rate);
    if(!Number.isFinite(rate)||rate<0||rate>1) throw new BadRequestException("Tax rate must be a decimal between 0 and 1");
    const result=await this.db.query<any>(
      "insert into tax_rules(store_id,name,country,region,city,rate,priority,active,product_types,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) returning *",
      [storeId,String(body?.name||"Tax").trim(),body?.country||null,body?.region||null,body?.city||null,rate,Number(body?.priority||0),body?.active!==false,Array.isArray(body?.productTypes)?body.productTypes:[],JSON.stringify(body?.metadata||{})]
    );
    await this.governance.audit(storeId,"tax.rule.created","tax_rule",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  async setPricesIncludeTax(value:boolean){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>("update stores set prices_include_tax=$1 where id=$2 returning *",[Boolean(value),storeId]);
    await this.governance.audit(storeId,"tax.mode.updated","store",storeId,{after:{pricesIncludeTax:Boolean(value)}});
    return result.rows[0];
  }

  async locations(){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>(
      `select l.*,coalesce((select sum(il.available)::int from inventory_levels il where il.location_id=l.id),0) as available_units,
       coalesce((select sum(il.incoming)::int from inventory_levels il where il.location_id=l.id),0) as incoming_units
       from locations l where l.store_id=$1 order by l.priority,l.created_at`,
      [storeId]
    );
    return {items:result.rows};
  }

  async createLocation(body:any){
    const storeId=await this.context.storeId();
    const name=String(body?.name||"").trim();
    const code=String(body?.code||"").trim().toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"");
    if(!name||!code) throw new BadRequestException("Location name and code are required");
    const result=await this.db.query<any>(
      "insert into locations(store_id,name,code,address,is_active,is_fulfillment,priority) values($1,$2,$3,$4::jsonb,$5,$6,$7) returning *",
      [storeId,name,code,JSON.stringify(body?.address||{}),body?.isActive!==false,body?.isFulfillment!==false,Number(body?.priority||0)]
    );
    if(body?.makeDefault===true) await this.db.query("update stores set default_location_id=$1 where id=$2",[result.rows[0].id,storeId]);
    await this.governance.audit(storeId,"location.created","location",result.rows[0].id,{after:result.rows[0]});
    return result.rows[0];
  }

  async inventory(locationId?:string){
    const storeId=await this.context.storeId();
    const params:any[]=[storeId];
    const where=locationId?" and il.location_id=$2":"";
    if(locationId) params.push(locationId);
    const result=await this.db.query<any>(
      `select il.*,l.name as location_name,l.code as location_code,v.sku,v.cost_amount,p.title as product_title,p.id as product_id
       from inventory_levels il join locations l on l.id=il.location_id join product_variants v on v.id=il.variant_id join products p on p.id=v.product_id
       where il.store_id=$1${where} order by l.priority,p.title,v.sku limit 2000`,
      params
    );
    return {items:result.rows};
  }

  private async syncVariant(client:any,variantId:string){
    const result=await client.query("select coalesce(sum(available),0)::int as total from inventory_levels where variant_id=$1",[variantId]);
    const total=Number(result.rows[0]?.total||0);
    await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[total,variantId]);
    return total;
  }

  async adjustInventory(locationId:string,variantId:string,body:any){
    const storeId=await this.context.storeId();
    const delta=Number(body?.delta);
    if(!Number.isInteger(delta)||delta===0) throw new BadRequestException("A non-zero whole-number delta is required");
    return this.db.transaction(async client=>{
      const location=await client.query<any>("select id from locations where id=$1 and store_id=$2 and is_active=true",[locationId,storeId]);
      if(!location.rowCount) throw new NotFoundException("Location not found");
      const variant=await client.query<any>("select v.id,v.inventory from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[variantId,storeId]);
      if(!variant.rowCount) throw new NotFoundException("Variant not found");
      let level=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,variantId]);
      if(!level.rowCount){
        if(delta<0) throw new BadRequestException("Cannot reduce stock below zero");
        level=await client.query<any>("insert into inventory_levels(store_id,location_id,variant_id,available) values($1,$2,$3,0) returning *",[storeId,locationId,variantId]);
      }
      const beforeLocation=Number(level.rows[0].available||0);
      const afterLocation=beforeLocation+delta;
      if(afterLocation<0) throw new BadRequestException("Inventory cannot be negative");
      await client.query("update inventory_levels set available=$1,updated_at=now() where id=$2",[afterLocation,level.rows[0].id]);
      const beforeTotal=Number(variant.rows[0].inventory||0);
      const afterTotal=await this.syncVariant(client,variantId);
      await client.query("insert into inventory_movements(store_id,variant_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,'location_adjustment',$3,$4,$5,$6,$7)",[storeId,variantId,delta,beforeTotal,afterTotal,String(body?.reason||"Location adjustment"),String(body?.actor||"admin")]);
      await this.governance.audit(storeId,"inventory.adjusted","variant",variantId,{actor:body?.actor,metadata:{locationId,delta,beforeLocation,afterLocation,beforeTotal,afterTotal}},client);
      return {locationId,variantId,beforeLocation,afterLocation,beforeTotal,afterTotal};
    });
  }

  async createTransfer(body:any){
    const storeId=await this.context.storeId();
    const from=String(body?.fromLocationId||"");
    const to=String(body?.toLocationId||"");
    const items=Array.isArray(body?.items)?body.items:[];
    if(!from||!to||from===to||!items.length) throw new BadRequestException("Transfer needs distinct locations and items");
    return this.db.transaction(async client=>{
      const locations=await client.query<any>("select id from locations where store_id=$1 and id=any($2::uuid[])",[storeId,[from,to]]);
      if(locations.rowCount!==2) throw new BadRequestException("Transfer location is invalid");
      const transfer=await client.query<any>("insert into inventory_transfers(store_id,from_location_id,to_location_id,status,notes,created_by) values($1,$2,$3,'in_transit',$4,$5) returning *",[storeId,from,to,body?.notes||null,String(body?.actor||"admin")]);
      for(const item of items){
        const variantId=String(item.variantId||"");
        const quantity=Number(item.quantity);
        if(!variantId||!Number.isInteger(quantity)||quantity<1) throw new BadRequestException("Transfer quantities must be positive whole numbers");
        const source=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[from,variantId]);
        if(!source.rowCount||Number(source.rows[0].available)<quantity) throw new ConflictException("Not enough source inventory for transfer");
        await client.query("update inventory_levels set available=available-$1,updated_at=now() where id=$2",[quantity,source.rows[0].id]);
        const dest=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[to,variantId]);
        if(dest.rowCount) await client.query("update inventory_levels set incoming=incoming+$1,updated_at=now() where id=$2",[quantity,dest.rows[0].id]);
        else await client.query("insert into inventory_levels(store_id,location_id,variant_id,available,incoming) values($1,$2,$3,0,$4)",[storeId,to,variantId,quantity]);
        await client.query("insert into inventory_transfer_items(transfer_id,variant_id,quantity) values($1,$2,$3)",[transfer.rows[0].id,variantId,quantity]);
        await this.syncVariant(client,variantId);
      }
      await this.governance.audit(storeId,"inventory.transfer.created","inventory_transfer",transfer.rows[0].id,{actor:body?.actor,after:transfer.rows[0],metadata:{items}},client);
      return transfer.rows[0];
    });
  }

  async receiveTransfer(id:string,body:any){
    const storeId=await this.context.storeId();
    return this.db.transaction(async client=>{
      const transfer=await client.query<any>("select * from inventory_transfers where id=$1 and store_id=$2 for update",[id,storeId]);
      if(!transfer.rowCount) throw new NotFoundException("Transfer not found");
      if(transfer.rows[0].status==="received") return {idempotent:true,transfer:transfer.rows[0]};
      if(transfer.rows[0].status!=="in_transit") throw new ConflictException("Transfer is not in transit");
      const items=await client.query<any>("select * from inventory_transfer_items where transfer_id=$1",[id]);
      for(const item of items.rows){
        const level=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[transfer.rows[0].to_location_id,item.variant_id]);
        if(!level.rowCount) throw new ConflictException("Destination inventory level is missing");
        const qty=Number(item.quantity);
        await client.query("update inventory_levels set incoming=greatest(0,incoming-$1),available=available+$1,updated_at=now() where id=$2",[qty,level.rows[0].id]);
        await client.query("update inventory_transfer_items set received_quantity=$1 where transfer_id=$2 and variant_id=$3",[qty,id,item.variant_id]);
        await this.syncVariant(client,item.variant_id);
      }
      const updated=await client.query<any>("update inventory_transfers set status='received',received_at=now() where id=$1 returning *",[id]);
      await this.governance.audit(storeId,"inventory.transfer.received","inventory_transfer",id,{actor:body?.actor,after:updated.rows[0]},client);
      return {idempotent:false,transfer:updated.rows[0]};
    });
  }

  async payments(orderId?:string){
    const storeId=await this.context.storeId();
    const result=orderId
      ?await this.db.query<any>("select * from payment_transactions where store_id=$1 and order_id=$2 order by created_at desc",[storeId,orderId])
      :await this.db.query<any>("select * from payment_transactions where store_id=$1 order by created_at desc limit 500",[storeId]);
    return {items:result.rows};
  }

  private async recalcPaymentStatus(client:any,storeId:string,orderId:string){
    const order=await client.query<any>("select total from orders where id=$1 and store_id=$2 for update",[orderId,storeId]);
    if(!order.rowCount) throw new NotFoundException("Order not found");
    const tx=await client.query<any>(
      `select coalesce(sum(case when status='succeeded' and transaction_type in ('payment','capture') then amount else 0 end),0) as paid,
       coalesce(sum(case when status='succeeded' and transaction_type='refund' then amount else 0 end),0) as refunded
       from payment_transactions where order_id=$1 and store_id=$2`,
      [orderId,storeId]
    );
    const paid=Number(tx.rows[0]?.paid||0),refunded=Number(tx.rows[0]?.refunded||0),total=Number(order.rows[0].total||0),net=Math.max(0,paid-refunded);
    let status="pending";
    if(refunded>0&&net<=0&&paid>0) status="refunded";
    else if(refunded>0&&net<paid) status="partially_refunded";
    else if(net>=total&&total>0) status="paid";
    else if(net>0) status="partially_paid";
    await client.query("update orders set payment_status=$1 where id=$2",[status,orderId]);
    return {status,paid,refunded,net,total};
  }

  async recordPayment(body:any){
    const store=await this.context.store();
    const orderId=String(body?.orderId||"");
    const amount=Number(body?.amount);
    if(!orderId||!Number.isFinite(amount)||amount<=0) throw new BadRequestException("Order and positive payment amount are required");
    return this.db.transaction(async client=>{
      const order=await client.query<any>("select * from orders where id=$1 and store_id=$2",[orderId,store.id]);
      if(!order.rowCount) throw new NotFoundException("Order not found");
      const status=String(body?.status||"succeeded");
      if(!["pending","succeeded","failed","canceled"].includes(status)) throw new BadRequestException("Invalid transaction status");
      const result=await client.query<any>(
        `insert into payment_transactions(store_id,order_id,transaction_type,provider,status,amount,currency,external_id,idempotency_key,metadata)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
         on conflict(store_id,idempotency_key) where idempotency_key is not null do update set metadata=payment_transactions.metadata
         returning *`,
        [store.id,orderId,String(body?.transactionType||"payment"),String(body?.provider||"manual"),status,amount,order.rows[0].currency||store.currency||"PKR",body?.externalId||null,body?.idempotencyKey||null,JSON.stringify(body?.metadata||{})]
      );
      const summary=await this.recalcPaymentStatus(client,store.id,orderId);
      await this.governance.audit(store.id,"payment.recorded","order",orderId,{actor:body?.actor,after:result.rows[0],metadata:summary},client);
      return {transaction:result.rows[0],summary};
    });
  }

  async refundPayment(body:any){
    const idempotencyKey=String(body?.idempotencyKey||"").trim();
    if(idempotencyKey.length<8) throw new BadRequestException("Refund idempotencyKey of at least 8 characters is required");
    return this.recordPayment({...body,transactionType:"refund",idempotencyKey});
  }

  async returns(){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>(
      `select r.*,o.order_number,c.name as customer_name from returns r join orders o on o.id=r.order_id left join customers c on c.id=o.customer_id
       where r.store_id=$1 order by r.created_at desc limit 250`,
      [storeId]
    );
    return {items:result.rows};
  }

  async createReturn(body:any){
    const storeId=await this.context.storeId();
    const orderId=String(body?.orderId||"");
    const items=Array.isArray(body?.items)?body.items:[];
    if(!orderId||!items.length) throw new BadRequestException("Return needs an order and at least one item");
    return this.db.transaction(async client=>{
      const order=await client.query<any>("select * from orders where id=$1 and store_id=$2",[orderId,storeId]);
      if(!order.rowCount) throw new NotFoundException("Order not found");
      if(order.rows[0].status==="canceled") throw new ConflictException("Canceled orders cannot be returned");
      const number=await client.query<{value:string}>("select 'RET-'||lpad(nextval('jewelry_return_number_seq')::text,6,'0') as value");
      const created=await client.query<any>("insert into returns(store_id,order_id,return_number,status,reason,refund_amount,notes,created_by) values($1,$2,$3,'requested',$4,$5,$6,$7) returning *",[storeId,orderId,number.rows[0].value,body?.reason||null,Number(body?.refundAmount||0),body?.notes||null,String(body?.actor||"admin")]);
      for(const item of items){
        const orderItem=await client.query<any>("select * from order_items where id=$1 and order_id=$2",[String(item.orderItemId||""),orderId]);
        if(!orderItem.rowCount) throw new BadRequestException("Return item does not belong to this order");
        const qty=Number(item.quantity);
        if(!Number.isInteger(qty)||qty<1||qty>Number(orderItem.rows[0].quantity)) throw new BadRequestException("Invalid return quantity");
        const action=String(item.action||"return");
        if(!["return","exchange"].includes(action)) throw new BadRequestException("Invalid return action");
        if(action==="exchange"&&!item.exchangeVariantId) throw new BadRequestException("Exchange variant is required");
        await client.query(
          "insert into return_items(return_id,order_item_id,quantity,action,exchange_variant_id,item_condition,restock,refund_amount) values($1,$2,$3,$4,$5,$6,$7,$8)",
          [created.rows[0].id,orderItem.rows[0].id,qty,action,item.exchangeVariantId||null,String(item.itemCondition||"resellable"),item.restock!==false,Number(item.refundAmount||0)]
        );
      }
      await this.governance.notify(storeId,{type:"return.requested",title:"Return "+number.rows[0].value+" created",body:"Order "+order.rows[0].order_number,severity:"warning",resourceType:"return",resourceId:created.rows[0].id},client);
      await this.governance.audit(storeId,"return.created","return",created.rows[0].id,{actor:body?.actor,after:created.rows[0],metadata:{items}},client);
      return created.rows[0];
    });
  }

  async completeReturn(id:string,body:any={}){
    const store=await this.context.store();
    return this.db.transaction(async client=>{
      const ret=await client.query<any>("select r.*,o.location_id,o.order_number,o.payment_status from returns r join orders o on o.id=r.order_id where r.id=$1 and r.store_id=$2 for update",[id,store.id]);
      if(!ret.rowCount) throw new NotFoundException("Return not found");
      if(ret.rows[0].status==="completed") return {idempotent:true,return:ret.rows[0]};
      if(["rejected","canceled"].includes(ret.rows[0].status)) throw new ConflictException("Return cannot be completed");
      const locationId=String(body?.locationId||ret.rows[0].location_id||"");
      if(!locationId) throw new BadRequestException("A restock location is required");
      const location=await client.query<any>("select id from locations where id=$1 and store_id=$2 and is_active=true",[locationId,store.id]);
      if(!location.rowCount) throw new BadRequestException("Restock location is invalid");
      const items=await client.query<any>("select ri.*,oi.variant_id,oi.sku from return_items ri join order_items oi on oi.id=ri.order_item_id where ri.return_id=$1",[id]);
      for(const item of items.rows){
        if(item.restock&&item.variant_id){
          const level=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,item.variant_id]);
          if(level.rowCount) await client.query("update inventory_levels set available=available+$1,updated_at=now() where id=$2",[Number(item.quantity),level.rows[0].id]);
          else await client.query("insert into inventory_levels(store_id,location_id,variant_id,available) values($1,$2,$3,$4)",[store.id,locationId,item.variant_id,Number(item.quantity)]);
          await this.syncVariant(client,item.variant_id);
        }
        if(item.action==="exchange"&&item.exchange_variant_id){
          const exchange=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,item.exchange_variant_id]);
          if(!exchange.rowCount||Number(exchange.rows[0].available)<Number(item.quantity)) throw new ConflictException("Exchange variant does not have enough stock");
          await client.query("update inventory_levels set available=available-$1,updated_at=now() where id=$2",[Number(item.quantity),exchange.rows[0].id]);
          await this.syncVariant(client,item.exchange_variant_id);
        }
      }
      const refundAmount=Number(body?.refundAmount??ret.rows[0].refund_amount??0);
      if(refundAmount>0){
        await client.query("insert into payment_transactions(store_id,order_id,transaction_type,provider,status,amount,currency,idempotency_key,metadata) select $1,$2,'refund',$3,'succeeded',$4,currency,$5,$6::jsonb from orders where id=$2",[store.id,ret.rows[0].order_id,String(body?.provider||"manual"),refundAmount,"return:"+id+":refund",JSON.stringify({returnId:id})]);
        await this.recalcPaymentStatus(client,store.id,ret.rows[0].order_id);
      }
      const updated=await client.query<any>("update returns set status='completed',refund_amount=$1,completed_at=now(),updated_at=now() where id=$2 returning *",[refundAmount,id]);
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'return.completed',$2,$3::jsonb)",[ret.rows[0].order_id,"Return "+ret.rows[0].return_number+" completed",JSON.stringify({returnId:id,refundAmount,locationId})]);
      await this.governance.audit(store.id,"return.completed","return",id,{actor:body?.actor,after:updated.rows[0],metadata:{refundAmount,locationId}},client);
      return {idempotent:false,return:updated.rows[0]};
    });
  }
}
