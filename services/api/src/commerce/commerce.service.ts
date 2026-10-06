import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

@Injectable()
export class CommerceService{
  constructor(private readonly db:DatabaseService){}

  private async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const r=await this.db.query<any>("select * from stores where domain=$1 limit 1",[domain]);
    if(!r.rowCount) throw new NotFoundException("Store is not configured");
    return r.rows[0];
  }
  private num(v:any,d=0){const n=Number(v??d);if(!Number.isFinite(n)) throw new BadRequestException("Invalid numeric value");return n;}
  private address(v:any){const a=v&&typeof v==="object"?v:{};return {line1:String(a.line1||"").trim(),line2:String(a.line2||"").trim(),city:String(a.city||"").trim(),region:String(a.region||"").trim(),postalCode:String(a.postalCode||"").trim(),country:String(a.country||"Pakistan").trim()};}
  private async audit(client:any,storeId:string,action:string,type:string,id:any,after:any,metadata:any={}){
    await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,after_state,metadata) values($1,'admin',$2,$3,$4,$5::jsonb,$6::jsonb)",[storeId,action,type,String(id||""),JSON.stringify(after||{}),JSON.stringify(metadata||{})]);
  }

  async overview(){
    const s=await this.store();
    const q=await this.db.query<any>(`select
      (select count(*) from draft_orders where store_id=$1 and status in ('draft','quote'))::int drafts,
      (select count(*) from discount_codes where store_id=$1 and active)::int discounts,
      (select count(*) from locations where store_id=$1 and active)::int locations,
      (select count(*) from returns where store_id=$1 and status not in ('completed','rejected'))::int open_returns,
      (select count(*) from purchase_orders where store_id=$1 and status not in ('received','canceled'))::int open_purchase_orders,
      (select count(*) from notifications where store_id=$1 and read_at is null)::int unread_notifications,
      (select count(*) from payment_transactions where store_id=$1)::int transactions`,[s.id]);
    return q.rows[0];
  }

  async locations(){
    const s=await this.store();
    const r=await this.db.query<any>("select l.*,coalesce(sum(il.on_hand),0)::int as on_hand,coalesce(sum(il.reserved),0)::int as reserved from locations l left join inventory_levels il on il.location_id=l.id where l.store_id=$1 group by l.id order by l.is_default desc,l.created_at",[s.id]);
    return {items:r.rows};
  }
  async createLocation(body:any){
    const s=await this.store(); const name=String(body?.name||"").trim(); const code=String(body?.code||"").trim().toUpperCase();
    if(!name||!code) throw new BadRequestException("name and code are required");
    return this.db.transaction(async c=>{
      if(body?.isDefault) await c.query("update locations set is_default=false where store_id=$1",[s.id]);
      const r=await c.query<any>("insert into locations(store_id,name,code,location_type,address,is_default) values($1,$2,$3,$4,$5::jsonb,$6) returning *",[s.id,name,code,String(body?.locationType||"warehouse"),JSON.stringify(this.address(body?.address)),Boolean(body?.isDefault)]);
      await this.audit(c,s.id,"location.created","location",r.rows[0].id,r.rows[0]); return r.rows[0];
    });
  }
  async adjustLocationStock(locationId:string,variantId:string,body:any){
    const s=await this.store(); const delta=this.num(body?.delta); if(!Number.isInteger(delta)||delta===0) throw new BadRequestException("delta must be a non-zero integer");
    return this.db.transaction(async c=>{
      const own=await c.query("select 1 from locations where id=$1 and store_id=$2",[locationId,s.id]); if(!own.rowCount) throw new NotFoundException("Location not found");
      const v=await c.query<any>("select v.id,v.inventory from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[variantId,s.id]); if(!v.rowCount) throw new NotFoundException("Variant not found");
      const level=await c.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,variantId]);
      const before=Number(level.rows[0]?.on_hand||0),after=before+delta;if(after<0) throw new ConflictException("Location stock cannot be negative");
      await c.query("insert into inventory_levels(location_id,variant_id,on_hand) values($1,$2,$3) on conflict(location_id,variant_id) do update set on_hand=excluded.on_hand,updated_at=now()",[locationId,variantId,after]);
      const total=await c.query<any>("select coalesce(sum(on_hand),0)::int n from inventory_levels where variant_id=$1",[variantId]);
      await c.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[Number(total.rows[0].n),variantId]);
      await c.query("insert into inventory_movements(store_id,variant_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,'location_adjustment',$3,$4,$5,$6,'admin')",[s.id,variantId,delta,before,after,String(body?.reason||"Location stock adjustment")]);
      await this.audit(c,s.id,"inventory.adjusted","variant",variantId,{locationId,before,after,delta});
      return {locationId,variantId,before,after,total:Number(total.rows[0].n)};
    });
  }

  async metafieldDefinitions(resourceType="product"){
    const s=await this.store(); const r=await this.db.query<any>("select * from metafield_definitions where store_id=$1 and resource_type=$2 order by position,name",[s.id,resourceType]);return {items:r.rows};
  }
  async createMetafieldDefinition(body:any){
    const s=await this.store(); const key=String(body?.key||"").trim().toLowerCase().replace(/[^a-z0-9_]/g,"_"); const name=String(body?.name||"").trim();
    const types=["text","number","boolean","date","url","json","single_select","multi_select"]; const type=String(body?.valueType||"text");
    if(!key||!name||!types.includes(type)) throw new BadRequestException("Invalid metafield definition");
    const r=await this.db.query<any>("insert into metafield_definitions(store_id,resource_type,namespace,key,name,value_type,description,validations,filterable,searchable,position) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) returning *",[s.id,String(body?.resourceType||"product"),String(body?.namespace||"custom"),key,name,type,body?.description??null,JSON.stringify(body?.validations||{}),Boolean(body?.filterable),Boolean(body?.searchable),Number(body?.position||0)]);return r.rows[0];
  }
  async metafields(resourceType:string,resourceId:string){
    const s=await this.store();const r=await this.db.query<any>("select rm.*,md.name,md.filterable,md.searchable from resource_metafields rm left join metafield_definitions md on md.id=rm.definition_id where rm.store_id=$1 and rm.resource_type=$2 and rm.resource_id=$3 order by md.position nulls last,rm.namespace,rm.key",[s.id,resourceType,resourceId]);return {items:r.rows};
  }
  async upsertMetafield(resourceType:string,resourceId:string,body:any){
    const s=await this.store();const namespace=String(body?.namespace||"custom"),key=String(body?.key||"").trim(); if(!key) throw new BadRequestException("key is required");
    let def:any=null;if(body?.definitionId){const d=await this.db.query<any>("select * from metafield_definitions where id=$1 and store_id=$2",[body.definitionId,s.id]);def=d.rows[0]||null;}
    const valueType=String(body?.valueType||def?.value_type||"text");
    const r=await this.db.query<any>("insert into resource_metafields(store_id,resource_type,resource_id,definition_id,namespace,key,value_type,value) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict(store_id,resource_type,resource_id,namespace,key) do update set definition_id=excluded.definition_id,value_type=excluded.value_type,value=excluded.value,updated_at=now() returning *",[s.id,resourceType,resourceId,body?.definitionId||null,namespace,key,valueType,JSON.stringify(body?.value)]);return r.rows[0];
  }

  async discounts(){const s=await this.store();const r=await this.db.query<any>("select * from discount_codes where store_id=$1 order by created_at desc",[s.id]);return {items:r.rows};}
  async createDiscount(body:any){
    const s=await this.store();const code=String(body?.code||"").trim().toUpperCase();const kind=String(body?.kind||"percentage");const value=this.num(body?.value);
    if(!code||!["percentage","fixed","free_shipping"].includes(kind)||value<0) throw new BadRequestException("Invalid discount");
    const r=await this.db.query<any>("insert into discount_codes(store_id,code,name,kind,value,applies_to,product_ids,collection_ids,minimum_order,usage_limit,starts_at,ends_at,automatic,active) values($1,$2,$3,$4,$5,$6,$7::uuid[],$8::uuid[],$9,$10,$11,$12,$13,$14) returning *",[s.id,code,body?.name??null,kind,value,String(body?.appliesTo||"order"),body?.productIds||[],body?.collectionIds||[],body?.minimumOrder??null,body?.usageLimit??null,body?.startsAt??null,body?.endsAt??null,Boolean(body?.automatic),body?.active!==false]);return r.rows[0];
  }

  async shipping(){const s=await this.store();const r=await this.db.query<any>("select z.*,coalesce(json_agg(r order by r.created_at) filter(where r.id is not null),'[]') rates from shipping_zones z left join shipping_rates r on r.zone_id=z.id where z.store_id=$1 group by z.id order by z.created_at",[s.id]);return {items:r.rows};}
  async createShippingZone(body:any){
    const s=await this.store();const name=String(body?.name||"").trim();if(!name) throw new BadRequestException("name is required");
    return this.db.transaction(async c=>{const z=await c.query<any>("insert into shipping_zones(store_id,name,countries,regions,cities) values($1,$2,$3,$4,$5) returning *",[s.id,name,body?.countries||["Pakistan"],body?.regions||[],body?.cities||[]]);
      for(const x of Array.isArray(body?.rates)?body.rates:[]) await c.query("insert into shipping_rates(zone_id,name,rate_type,amount,minimum_order,maximum_order,minimum_weight_grams,maximum_weight_grams,courier,service_code) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[z.rows[0].id,String(x.name||"Standard"),String(x.rateType||"flat"),this.num(x.amount),x.minimumOrder??null,x.maximumOrder??null,x.minimumWeightGrams??null,x.maximumWeightGrams??null,x.courier??null,x.serviceCode??null]);
      return z.rows[0];});
  }
  async taxes(){const s=await this.store();const r=await this.db.query<any>("select * from tax_rules where store_id=$1 order by priority,created_at",[s.id]);return {items:r.rows};}
  async createTaxRule(body:any){const s=await this.store();const name=String(body?.name||"").trim(),rate=this.num(body?.rate);if(!name||rate<0||rate>1)throw new BadRequestException("rate must be between 0 and 1");const r=await this.db.query<any>("insert into tax_rules(store_id,name,country,region,rate,inclusive,priority,active) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",[s.id,name,body?.country??null,body?.region??null,rate,Boolean(body?.inclusive),Number(body?.priority||0),body?.active!==false]);return r.rows[0];}

  private async resolveDiscount(client:any,storeId:string,code:any,subtotal:number){
    if(!code) return {amount:0,row:null};
    const r=await client.query<any>("select * from discount_codes where store_id=$1 and code=$2 and active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) limit 1",[storeId,String(code).toUpperCase()]);
    const d=r.rows[0];if(!d) throw new BadRequestException("Discount code is invalid or expired");if(d.minimum_order!==null&&subtotal<Number(d.minimum_order))throw new BadRequestException("Minimum order not met");if(d.usage_limit!==null&&Number(d.usage_count)>=Number(d.usage_limit))throw new BadRequestException("Discount usage limit reached");
    let amount=d.kind==="percentage"?subtotal*Math.min(100,Number(d.value))/100:d.kind==="fixed"?Number(d.value):0;amount=Math.min(subtotal,Math.max(0,amount));return {amount,row:d};
  }
  private async orderFromBody(body:any,source="admin_manual"){
    const s=await this.store();const items=Array.isArray(body?.items)?body.items:[];if(!items.length)throw new BadRequestException("At least one item is required");
    return this.db.transaction(async c=>{
      let customerId=body?.customerId||null;
      if(!customerId&&body?.customer?.email){const x=body.customer;const cr=await c.query<any>("insert into customers(store_id,email,name,phone,attributes) values($1,$2,$3,$4,'{}'::jsonb) on conflict(store_id,lower(email)) where email is not null and trim(email)<>'' do update set name=coalesce(excluded.name,customers.name),phone=coalesce(excluded.phone,customers.phone) returning id",[s.id,String(x.email).toLowerCase(),x.name??null,x.phone??null]);customerId=cr.rows[0].id;}
      const locationId=body?.locationId||null;let subtotal=0,cost=0;const locked:any[]=[];
      for(const line of items){const qty=Number(line.quantity||1);if(!Number.isInteger(qty)||qty<1)throw new BadRequestException("Invalid quantity");const v=await c.query<any>("select v.*,p.title,p.store_id,p.taxable from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[line.variantId,s.id]);if(!v.rowCount)throw new NotFoundException("Variant not found");const row=v.rows[0];if(Number(row.inventory)<qty)throw new ConflictException(row.sku+" has insufficient stock");const unit=line.unitPrice!==undefined?this.num(line.unitPrice):Number(row.price);if(unit<0)throw new BadRequestException("Invalid unit price");subtotal+=unit*qty;cost+=Number(row.cost_price||0)*qty;locked.push({row,qty,unit,lineTotal:unit*qty});}
      const disc=await this.resolveDiscount(c,s.id,body?.discountCode,subtotal);const shipping=Math.max(0,this.num(body?.shippingAmount));const tax=Math.max(0,this.num(body?.taxAmount));const total=Math.max(0,subtotal-disc.amount+shipping+tax);
      const n=await c.query<any>("select 'JS-'||lpad(nextval('jewelry_order_number_seq')::text,6,'0') value");const number=n.rows[0].value;
      const status=String(body?.status||"confirmed"),pay=String(body?.paymentStatus||"pending");const ship=this.address(body?.shippingAddress),bill=this.address(body?.billingAddress||body?.shippingAddress);
      const o=await c.query<any>("insert into orders(store_id,customer_id,order_number,status,payment_status,currency,subtotal,discount_amount,shipping_amount,tax_amount,total,source_channel,shipping_address,billing_address,shipping_method,payment_method,fulfillment_status,discount_code,fulfillment_location_id,notes,gross_profit) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,'unfulfilled',$17,$18,$19,$20) returning *",[s.id,customerId,number,status,pay,String(body?.currency||s.currency||"PKR"),subtotal,disc.amount,shipping,tax,total,source,JSON.stringify(ship),JSON.stringify(bill),String(body?.shippingMethod||"manual"),String(body?.paymentMethod||"cod"),disc.row?.code||null,locationId,body?.notes??null,total-cost]);
      for(const x of locked){await c.query("insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,'{}'::jsonb,$6,$7,$8)",[o.rows[0].id,x.row.product_id,x.row.id,x.row.sku,x.row.title,x.qty,x.unit,x.lineTotal]);
        if(locationId){const level=await c.query<any>("select on_hand from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,x.row.id]);if(level.rowCount&&Number(level.rows[0].on_hand)<x.qty)throw new ConflictException(x.row.sku+" has insufficient stock at selected location");if(level.rowCount)await c.query("update inventory_levels set on_hand=on_hand-$1,updated_at=now() where location_id=$2 and variant_id=$3",[x.qty,locationId,x.row.id]);}
        await c.query("update product_variants set inventory=inventory-$1,updated_at=now() where id=$2",[x.qty,x.row.id]);await c.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'admin_sale',$4,$5,$6,$7,'admin')",[s.id,x.row.id,o.rows[0].id,-x.qty,Number(x.row.inventory),Number(x.row.inventory)-x.qty,"Manual order "+number]);}
      if(disc.row){await c.query("update discount_codes set usage_count=usage_count+1 where id=$1",[disc.row.id]);await c.query("insert into discount_redemptions(discount_id,order_id,customer_id,amount) values($1,$2,$3,$4)",[disc.row.id,o.rows[0].id,customerId,disc.amount]);}
      if(pay==="paid"||this.num(body?.paidAmount)>0){const amt=this.num(body?.paidAmount,pay==="paid"?total:0);if(amt>0)await c.query("insert into payment_transactions(store_id,order_id,provider,transaction_type,status,amount,currency,metadata) values($1,$2,$3,'capture','succeeded',$4,$5,$6::jsonb)",[s.id,o.rows[0].id,String(body?.paymentProvider||body?.paymentMethod||"manual"),amt,o.rows[0].currency,JSON.stringify({source})]);}
      await c.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.created',$2,$3::jsonb)",[o.rows[0].id,"Order "+number+" created by admin",JSON.stringify({source})]);await this.audit(c,s.id,"order.created","order",o.rows[0].id,o.rows[0],{source});return o.rows[0];
    });
  }
  async createManualOrder(body:any){return this.orderFromBody(body,"admin_manual");}

  async drafts(){const s=await this.store();const r=await this.db.query<any>("select d.*,c.name customer_name,c.email customer_email,(select count(*) from draft_order_items i where i.draft_order_id=d.id)::int item_count from draft_orders d left join customers c on c.id=d.customer_id where d.store_id=$1 order by d.created_at desc",[s.id]);return {items:r.rows};}
  async createDraft(body:any){
    const s=await this.store();const items=Array.isArray(body?.items)?body.items:[];if(!items.length)throw new BadRequestException("At least one item is required");
    return this.db.transaction(async c=>{let subtotal=0;const lines:any[]=[];for(const line of items){const v=await c.query<any>("select v.id,v.product_id,v.sku,v.price,p.title from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2",[line.variantId,s.id]);if(!v.rowCount)throw new NotFoundException("Variant not found");const qty=Number(line.quantity||1),unit=line.unitPrice!==undefined?this.num(line.unitPrice):Number(v.rows[0].price);subtotal+=qty*unit;lines.push({...v.rows[0],qty,unit});}
      const discount=Math.max(0,this.num(body?.discountAmount));const shipping=Math.max(0,this.num(body?.shippingAmount));const tax=Math.max(0,this.num(body?.taxAmount));const d=await c.query<any>("insert into draft_orders(store_id,customer_id,status,currency,email,phone,shipping_address,billing_address,subtotal,discount_amount,shipping_amount,tax_amount,total,notes,quote_expires_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15) returning *",[s.id,body?.customerId||null,String(body?.status||"draft"),String(body?.currency||s.currency||"PKR"),body?.email??null,body?.phone??null,JSON.stringify(this.address(body?.shippingAddress)),JSON.stringify(this.address(body?.billingAddress||body?.shippingAddress)),subtotal,discount,shipping,tax,Math.max(0,subtotal-discount+shipping+tax),body?.notes??null,body?.quoteExpiresAt??null]);for(const x of lines)await c.query("insert into draft_order_items(draft_order_id,product_id,variant_id,title,sku,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6,$7,$8)",[d.rows[0].id,x.product_id,x.id,x.title,x.sku,x.qty,x.unit,x.qty*x.unit]);await this.audit(c,s.id,"draft.created","draft_order",d.rows[0].id,d.rows[0]);return d.rows[0];});
  }
  async convertDraft(id:string,body:any){
    const s=await this.store();const d=await this.db.query<any>("select * from draft_orders where id=$1 and store_id=$2",[id,s.id]);if(!d.rowCount)throw new NotFoundException("Draft not found");if(d.rows[0].converted_order_id)throw new ConflictException("Draft already converted");const items=await this.db.query<any>("select variant_id,quantity,unit_price from draft_order_items where draft_order_id=$1",[id]);const order=await this.orderFromBody({...body,customerId:d.rows[0].customer_id,items:items.rows.map((x:any)=>({variantId:x.variant_id,quantity:x.quantity,unitPrice:Number(x.unit_price)})),shippingAddress:d.rows[0].shipping_address,billingAddress:d.rows[0].billing_address,shippingAmount:Number(d.rows[0].shipping_amount),taxAmount:Number(d.rows[0].tax_amount),notes:d.rows[0].notes},"draft_conversion");await this.db.query("update draft_orders set status='converted',converted_order_id=$1,updated_at=now() where id=$2",[order.id,id]);return order;
  }

  async payments(orderId?:string){const s=await this.store();const r=await this.db.query<any>("select * from payment_transactions where store_id=$1 "+(orderId?"and order_id=$2 ":"")+"order by created_at desc limit 500",orderId?[s.id,orderId]:[s.id]);return {items:r.rows};}
  async recordPayment(orderId:string,body:any){const s=await this.store();const amount=this.num(body?.amount);if(amount<=0)throw new BadRequestException("amount must be positive");const r=await this.db.query<any>("insert into payment_transactions(store_id,order_id,provider,provider_transaction_id,transaction_type,status,amount,currency,metadata) select $1,o.id,$3,$4,$5,$6,$7,o.currency,$8::jsonb from orders o where o.id=$2 and o.store_id=$1 returning *",[s.id,orderId,String(body?.provider||"manual"),body?.providerTransactionId??null,String(body?.transactionType||"capture"),String(body?.status||"succeeded"),amount,JSON.stringify(body?.metadata||{})]);if(!r.rowCount)throw new NotFoundException("Order not found");return r.rows[0];}

  async returns(){const s=await this.store();const r=await this.db.query<any>("select r.*,o.order_number from returns r join orders o on o.id=r.order_id where r.store_id=$1 order by r.created_at desc",[s.id]);return {items:r.rows};}
  async createReturn(body:any){const s=await this.store();const orderId=String(body?.orderId||"");if(!orderId)throw new BadRequestException("orderId is required");return this.db.transaction(async c=>{const o=await c.query<any>("select * from orders where id=$1 and store_id=$2",[orderId,s.id]);if(!o.rowCount)throw new NotFoundException("Order not found");const r=await c.query<any>("insert into returns(store_id,order_id,status,return_type,reason,refund_amount,notes) values($1,$2,'requested',$3,$4,$5,$6) returning *",[s.id,orderId,String(body?.returnType||"return"),body?.reason??null,this.num(body?.refundAmount),body?.notes??null]);for(const x of Array.isArray(body?.items)?body.items:[])await c.query("insert into return_items(return_id,order_item_id,quantity,disposition,exchange_variant_id,refund_amount) values($1,$2,$3,$4,$5,$6)",[r.rows[0].id,x.orderItemId,Number(x.quantity||1),String(x.disposition||"restock"),x.exchangeVariantId||null,this.num(x.refundAmount)]);await this.audit(c,s.id,"return.requested","return",r.rows[0].id,r.rows[0]);return r.rows[0];});}

  async customerAddresses(customerId:string){const r=await this.db.query<any>("select * from customer_addresses where customer_id=$1 order by is_default desc,created_at desc",[customerId]);return {items:r.rows};}
  async addCustomerAddress(customerId:string,body:any){const a=this.address(body);if(!a.line1||!a.city)throw new BadRequestException("Address is incomplete");if(body?.isDefault)await this.db.query("update customer_addresses set is_default=false where customer_id=$1",[customerId]);const r=await this.db.query<any>("insert into customer_addresses(customer_id,label,address_type,is_default,name,phone,line1,line2,city,region,postal_code,country) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *",[customerId,body?.label??null,String(body?.addressType||"shipping"),Boolean(body?.isDefault),body?.name??null,body?.phone??null,a.line1,a.line2||null,a.city,a.region||null,a.postalCode||null,a.country]);return r.rows[0];}

  async suppliers(){const s=await this.store();const r=await this.db.query<any>("select * from suppliers where store_id=$1 order by name",[s.id]);return {items:r.rows};}
  async createSupplier(body:any){const s=await this.store();const name=String(body?.name||"").trim();if(!name)throw new BadRequestException("name is required");const r=await this.db.query<any>("insert into suppliers(store_id,name,email,phone,address,notes) values($1,$2,$3,$4,$5::jsonb,$6) returning *",[s.id,name,body?.email??null,body?.phone??null,JSON.stringify(this.address(body?.address)),body?.notes??null]);return r.rows[0];}
  async purchaseOrders(){const s=await this.store();const r=await this.db.query<any>("select po.*,s.name supplier_name,l.name location_name from purchase_orders po left join suppliers s on s.id=po.supplier_id left join locations l on l.id=po.location_id where po.store_id=$1 order by po.created_at desc",[s.id]);return {items:r.rows};}
  async createPurchaseOrder(body:any){const s=await this.store();const lines=Array.isArray(body?.items)?body.items:[];if(!lines.length)throw new BadRequestException("items are required");return this.db.transaction(async c=>{let subtotal=0;for(const x of lines)subtotal+=Number(x.quantity||0)*this.num(x.unitCost);const p=await c.query<any>("insert into purchase_orders(store_id,supplier_id,location_id,status,currency,subtotal,expected_at,notes) values($1,$2,$3,'draft',$4,$5,$6,$7) returning *",[s.id,body?.supplierId||null,body?.locationId||null,String(body?.currency||s.currency||"PKR"),subtotal,body?.expectedAt??null,body?.notes??null]);for(const x of lines)await c.query("insert into purchase_order_items(purchase_order_id,variant_id,quantity,unit_cost) values($1,$2,$3,$4)",[p.rows[0].id,x.variantId,Number(x.quantity),this.num(x.unitCost)]);return p.rows[0];});}
  async receivePurchaseOrder(id:string){const s=await this.store();return this.db.transaction(async c=>{const p=await c.query<any>("select * from purchase_orders where id=$1 and store_id=$2 for update",[id,s.id]);if(!p.rowCount)throw new NotFoundException("Purchase order not found");if(p.rows[0].status==="received")return p.rows[0];const items=await c.query<any>("select * from purchase_order_items where purchase_order_id=$1",[id]);for(const x of items.rows){const qty=Number(x.quantity)-Number(x.received_quantity);if(qty<=0)continue;const v=await c.query<any>("select inventory from product_variants where id=$1 for update",[x.variant_id]);await c.query("update product_variants set inventory=inventory+$1,cost_price=$2,updated_at=now() where id=$3",[qty,Number(x.unit_cost),x.variant_id]);if(p.rows[0].location_id)await c.query("insert into inventory_levels(location_id,variant_id,on_hand) values($1,$2,$3) on conflict(location_id,variant_id) do update set on_hand=inventory_levels.on_hand+excluded.on_hand,updated_at=now()",[p.rows[0].location_id,x.variant_id,qty]);await c.query("update purchase_order_items set received_quantity=quantity where id=$1",[x.id]);await c.query("insert into inventory_movements(store_id,variant_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,'purchase_receive',$3,$4,$5,$6,'admin')",[s.id,x.variant_id,qty,Number(v.rows[0]?.inventory||0),Number(v.rows[0]?.inventory||0)+qty,"Purchase order "+id]);}const done=await c.query<any>("update purchase_orders set status='received',received_at=now() where id=$1 returning *",[id]);return done.rows[0];});}

  async audit(){const s=await this.store();const r=await this.db.query<any>("select * from audit_log where store_id=$1 order by created_at desc limit 500",[s.id]);return {items:r.rows};}
  async notifications(){const s=await this.store();const r=await this.db.query<any>("select * from notifications where store_id=$1 order by read_at nulls first,created_at desc limit 500",[s.id]);return {items:r.rows};}
  async report(){
    const s=await this.store();const r=await this.db.query<any>(`select
      coalesce(sum(total) filter(where created_at>=now()-interval '30 days'),0) revenue,
      coalesce(sum(gross_profit) filter(where created_at>=now()-interval '30 days'),0) gross_profit,
      count(*) filter(where created_at>=now()-interval '30 days')::int orders,
      coalesce(avg(total) filter(where created_at>=now()-interval '30 days'),0) aov
      from orders where store_id=$1`,[s.id]);
    const inv=await this.db.query<any>("select coalesce(sum(v.inventory*coalesce(v.cost_price,0)),0) value,coalesce(sum(v.inventory),0)::int units from product_variants v join products p on p.id=v.product_id where p.store_id=$1",[s.id]);return {...r.rows[0],inventory_value:Number(inv.rows[0].value),inventory_units:Number(inv.rows[0].units)};
  }
}
