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
  private async logAudit(client:any,storeId:string,action:string,type:string,id:any,after:any,metadata:any={}){
    await client.query("insert into audit_log(store_id,actor,action,resource_type,resource_id,after_state,metadata) values($1,'admin',$2,$3,$4,$5::jsonb,$6::jsonb)",[storeId,action,type,String(id||""),JSON.stringify(after||{}),JSON.stringify(metadata||{})]);
  }

  async orderCatalog(){
    const s=await this.store();
    const r=await this.db.query<any>("select v.id variant_id,v.sku,v.price,v.inventory,v.cost_price,p.id product_id,p.title,p.status,coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) selected_options from product_variants v join products p on p.id=v.product_id where p.store_id=$1 and p.status<>'archived' and v.status='active' order by p.title,v.sku",[s.id]);
    return {items:r.rows.map((x:any)=>({...x,price:Number(x.price),inventory:Number(x.inventory),cost_price:x.cost_price===null?null:Number(x.cost_price)}))};
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
      await this.logAudit(c,s.id,"location.created","location",r.rows[0].id,r.rows[0]); return r.rows[0];
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
      await this.logAudit(c,s.id,"inventory.adjusted","variant",variantId,{locationId,before,after,delta});
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

  private async resolveDiscount(client:any,storeId:string,code:any,subtotal:number,lines:any[]=[]){
    if(!code) return {amount:0,row:null};
    const r=await client.query("select * from discount_codes where store_id=$1 and code=$2 and active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) limit 1",[storeId,String(code).toUpperCase()]);
    const d=(r as any).rows[0];if(!d) throw new BadRequestException("Discount code is invalid or expired");
    if(d.minimum_order!==null&&subtotal<Number(d.minimum_order))throw new BadRequestException("Minimum order not met");
    if(d.usage_limit!==null&&Number(d.usage_count)>=Number(d.usage_limit))throw new BadRequestException("Discount usage limit reached");
    let eligibleSubtotal=subtotal;
    if(d.applies_to==="product"&&Array.isArray(d.product_ids)&&d.product_ids.length){
      const allowed=new Set(d.product_ids.map(String));eligibleSubtotal=lines.filter(x=>allowed.has(String(x.row?.product_id))).reduce((sum,x)=>sum+Number(x.lineTotal||0),0);
    }else if(d.applies_to==="collection"&&Array.isArray(d.collection_ids)&&d.collection_ids.length){
      const productIds=[...new Set(lines.map(x=>String(x.row?.product_id)).filter(Boolean))];
      if(productIds.length){
        const matched=await client.query("select distinct product_id from collection_products where collection_id=any($1::uuid[]) and product_id=any($2::uuid[])",[d.collection_ids,productIds]);
        const allowed=new Set((matched as any).rows.map((x:any)=>String(x.product_id)));
        eligibleSubtotal=lines.filter(x=>allowed.has(String(x.row?.product_id))).reduce((sum,x)=>sum+Number(x.lineTotal||0),0);
      }else eligibleSubtotal=0;
    }
    let amount=d.kind==="percentage"?eligibleSubtotal*Math.min(100,Number(d.value))/100:d.kind==="fixed"?Number(d.value):0;
    amount=Math.min(eligibleSubtotal,Math.max(0,amount));return {amount,row:d};
  }
  private async resolveTaxes(client:any,storeId:string,address:any,subtotal:number,discountAmount:number,lines:any[],body:any={}){
    if(body?.inclusiveTaxAmount!==undefined||body?.exclusiveTaxAmount!==undefined||body?.taxAmount!==undefined){
      const inclusive=Math.max(0,this.num(body?.inclusiveTaxAmount));
      const exclusive=body?.exclusiveTaxAmount!==undefined
        ?Math.max(0,this.num(body.exclusiveTaxAmount))
        :body?.taxAmount!==undefined?Math.max(0,this.num(body.taxAmount)):0;
      return {inclusive,exclusive,total:inclusive+exclusive,source:"override"};
    }
    const taxableSubtotal=lines.filter((line:any)=>line.row?.taxable!==false).reduce((sum:number,line:any)=>sum+Number(line.lineTotal||0),0);
    const allocatedDiscount=subtotal>0?discountAmount*(taxableSubtotal/subtotal):0;
    const taxableBase=Math.max(0,taxableSubtotal-allocatedDiscount);
    const rules=await client.query("select * from tax_rules where store_id=$1 and active=true and (country is null or country='' or country=$2) and (region is null or region='' or region=$3) order by priority,created_at",[storeId,String(address?.country||"Pakistan"),String(address?.region||"")]);
    let inclusive=0,exclusive=0;
    for(const rule of (rules as any).rows){
      const rate=Number(rule.rate||0);
      if(rule.inclusive) inclusive+=taxableBase*rate/(1+rate);
      else exclusive+=taxableBase*rate;
    }
    inclusive=Math.round(inclusive*100)/100;
    exclusive=Math.round(exclusive*100)/100;
    return {inclusive,exclusive,total:inclusive+exclusive,source:"rules"};
  }

  private async orderFromBody(body:any,source="admin_manual"){
    const s=await this.store();const items=Array.isArray(body?.items)?body.items:[];if(!items.length)throw new BadRequestException("At least one item is required");
    return this.db.transaction(async c=>{
      let customerId=body?.customerId||null;
      if(!customerId&&body?.customer?.email){const x=body.customer;const cr=await c.query<any>("insert into customers(store_id,email,name,phone,attributes) values($1,$2,$3,$4,'{}'::jsonb) on conflict(store_id,lower(email)) where email is not null and trim(email)<>'' do update set name=coalesce(excluded.name,customers.name),phone=coalesce(excluded.phone,customers.phone) returning id",[s.id,String(x.email).toLowerCase(),x.name??null,x.phone??null]);customerId=cr.rows[0].id;}
      let locationId=body?.locationId||null;
      if(!locationId){
        const defaultLocation=await c.query<any>("select id from locations where store_id=$1 and active=true order by is_default desc,created_at limit 1",[s.id]);
        locationId=defaultLocation.rows[0]?.id||null;
      }
      let subtotal=0,cost=0;const locked:any[]=[];
      for(const line of items){const qty=Number(line.quantity||1);if(!Number.isInteger(qty)||qty<1)throw new BadRequestException("Invalid quantity");const v=await c.query<any>("select v.*,p.title,p.store_id,p.taxable from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[line.variantId,s.id]);if(!v.rowCount)throw new NotFoundException("Variant not found");const row=v.rows[0];if(Number(row.inventory)<qty)throw new ConflictException(row.sku+" has insufficient stock");const unit=line.unitPrice!==undefined?this.num(line.unitPrice):Number(row.price);if(unit<0)throw new BadRequestException("Invalid unit price");subtotal+=unit*qty;cost+=Number(row.cost_price||0)*qty;locked.push({row,qty,unit,lineTotal:unit*qty});}
      const disc=await this.resolveDiscount(c,s.id,body?.discountCode,subtotal,locked);
      const shipping=Math.max(0,this.num(body?.shippingAmount));
      const ship=this.address(body?.shippingAddress),bill=this.address(body?.billingAddress||body?.shippingAddress);
      const taxes=await this.resolveTaxes(c,s.id,ship,subtotal,disc.amount,locked,body);
      const tax=taxes.total;
      const total=Math.max(0,subtotal-disc.amount+shipping+taxes.exclusive);
      const grossProfit=total-taxes.exclusive-taxes.inclusive-cost;
      const n=await c.query<any>("select 'JS-'||lpad(nextval('jewelry_order_number_seq')::text,6,'0') value");const number=n.rows[0].value;
      const status=String(body?.status||"confirmed"),pay=String(body?.paymentStatus||"pending");
      const o=await c.query<any>("insert into orders(store_id,customer_id,order_number,status,payment_status,currency,subtotal,discount_amount,shipping_amount,tax_amount,inclusive_tax_amount,exclusive_tax_amount,total,source_channel,shipping_address,billing_address,shipping_method,payment_method,fulfillment_status,discount_code,fulfillment_location_id,notes,gross_profit) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18,'unfulfilled',$19,$20,$21,$22) returning *",[s.id,customerId,number,status,pay,String(body?.currency||s.currency||"PKR"),subtotal,disc.amount,shipping,tax,taxes.inclusive,taxes.exclusive,total,source,JSON.stringify(ship),JSON.stringify(bill),String(body?.shippingMethod||"manual"),String(body?.paymentMethod||"cod"),disc.row?.code||null,locationId,body?.notes??null,grossProfit]);
      for(const x of locked){await c.query("insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,'{}'::jsonb,$6,$7,$8)",[o.rows[0].id,x.row.product_id,x.row.id,x.row.sku,x.row.title,x.qty,x.unit,x.lineTotal]);
        if(locationId){const level=await c.query<any>("select on_hand from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,x.row.id]);if(!level.rowCount||Number(level.rows[0].on_hand)<x.qty)throw new ConflictException(x.row.sku+" has insufficient stock at selected location");await c.query("update inventory_levels set on_hand=on_hand-$1,updated_at=now() where location_id=$2 and variant_id=$3",[x.qty,locationId,x.row.id]);}
        await c.query("update product_variants set inventory=inventory-$1,updated_at=now() where id=$2",[x.qty,x.row.id]);await c.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'admin_sale',$4,$5,$6,$7,'admin')",[s.id,x.row.id,o.rows[0].id,-x.qty,Number(x.row.inventory),Number(x.row.inventory)-x.qty,"Manual order "+number]);}
      if(disc.row){await c.query("update discount_codes set usage_count=usage_count+1 where id=$1",[disc.row.id]);await c.query("insert into discount_redemptions(discount_id,order_id,customer_id,amount) values($1,$2,$3,$4)",[disc.row.id,o.rows[0].id,customerId,disc.amount]);}
      if(pay==="paid"||this.num(body?.paidAmount)>0){const amt=this.num(body?.paidAmount,pay==="paid"?total:0);if(amt>0)await c.query("insert into payment_transactions(store_id,order_id,provider,transaction_type,status,amount,currency,metadata) values($1,$2,$3,'capture','succeeded',$4,$5,$6::jsonb)",[s.id,o.rows[0].id,String(body?.paymentProvider||body?.paymentMethod||"manual"),amt,o.rows[0].currency,JSON.stringify({source})]);}
      await c.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.created',$2,$3::jsonb)",[o.rows[0].id,"Order "+number+" created by admin",JSON.stringify({source})]);
      await c.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'new_order','info',$2,$3,'order',$4)",[s.id,"New manual order "+number,"Admin created order for "+o.rows[0].currency+" "+Number(o.rows[0].total).toLocaleString(),o.rows[0].id]);
      if(body?.customer?.email||body?.email){
        const recipient=String(body?.customer?.email||body?.email).toLowerCase();
        await c.query("insert into message_outbox(store_id,channel,template_key,recipient,subject,payload,status) values($1,'email','order_confirmation',$2,$3,$4::jsonb,'queued')",[s.id,recipient,"Order "+number+" confirmation",JSON.stringify({orderId:o.rows[0].id,orderNumber:number,total:Number(o.rows[0].total),currency:o.rows[0].currency})]);
      }
      await this.logAudit(c,s.id,"order.created","order",o.rows[0].id,o.rows[0],{source});return o.rows[0];
    });
  }
  async createManualOrder(body:any){return this.orderFromBody(body,"admin_manual");}

  async drafts(){const s=await this.store();const r=await this.db.query<any>("select d.*,c.name customer_name,c.email customer_email,(select count(*) from draft_order_items i where i.draft_order_id=d.id)::int item_count from draft_orders d left join customers c on c.id=d.customer_id where d.store_id=$1 order by d.created_at desc",[s.id]);return {items:r.rows};}
  async createDraft(body:any){
    const s=await this.store();const items=Array.isArray(body?.items)?body.items:[];if(!items.length)throw new BadRequestException("At least one item is required");
    return this.db.transaction(async c=>{let subtotal=0;const lines:any[]=[];for(const line of items){const v=await c.query<any>("select v.id,v.product_id,v.sku,v.price,p.title,p.taxable from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2",[line.variantId,s.id]);if(!v.rowCount)throw new NotFoundException("Variant not found");const qty=Number(line.quantity||1),unit=line.unitPrice!==undefined?this.num(line.unitPrice):Number(v.rows[0].price);subtotal+=qty*unit;lines.push({row:v.rows[0],...v.rows[0],qty,unit,lineTotal:qty*unit});}
      const discount=Math.max(0,this.num(body?.discountAmount));const shipping=Math.max(0,this.num(body?.shippingAmount));const ship=this.address(body?.shippingAddress);const bill=this.address(body?.billingAddress||body?.shippingAddress);const taxes=await this.resolveTaxes(c,s.id,ship,subtotal,discount,lines,body);const tax=taxes.total;const total=Math.max(0,subtotal-discount+shipping+taxes.exclusive);const d=await c.query<any>("insert into draft_orders(store_id,customer_id,status,currency,email,phone,shipping_address,billing_address,subtotal,discount_amount,shipping_amount,tax_amount,inclusive_tax_amount,exclusive_tax_amount,total,notes,quote_expires_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *",[s.id,body?.customerId||null,String(body?.status||"draft"),String(body?.currency||s.currency||"PKR"),body?.email??null,body?.phone??null,JSON.stringify(ship),JSON.stringify(bill),subtotal,discount,shipping,tax,taxes.inclusive,taxes.exclusive,total,body?.notes??null,body?.quoteExpiresAt??null]);for(const x of lines)await c.query("insert into draft_order_items(draft_order_id,product_id,variant_id,title,sku,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6,$7,$8)",[d.rows[0].id,x.product_id,x.id,x.title,x.sku,x.qty,x.unit,x.lineTotal]);await this.logAudit(c,s.id,"draft.created","draft_order",d.rows[0].id,d.rows[0]);return d.rows[0];});
  }
  async convertDraft(id:string,body:any){
    const s=await this.store();const d=await this.db.query<any>("select * from draft_orders where id=$1 and store_id=$2",[id,s.id]);if(!d.rowCount)throw new NotFoundException("Draft not found");if(d.rows[0].converted_order_id)throw new ConflictException("Draft already converted");const items=await this.db.query<any>("select variant_id,quantity,unit_price from draft_order_items where draft_order_id=$1",[id]);const order=await this.orderFromBody({...body,customerId:d.rows[0].customer_id,items:items.rows.map((x:any)=>({variantId:x.variant_id,quantity:x.quantity,unitPrice:Number(x.unit_price)})),shippingAddress:d.rows[0].shipping_address,billingAddress:d.rows[0].billing_address,shippingAmount:Number(d.rows[0].shipping_amount),taxAmount:Number(d.rows[0].tax_amount),inclusiveTaxAmount:Number(d.rows[0].inclusive_tax_amount||0),exclusiveTaxAmount:Number(d.rows[0].exclusive_tax_amount||0),notes:d.rows[0].notes},"draft_conversion");await this.db.query("update draft_orders set status='converted',converted_order_id=$1,updated_at=now() where id=$2",[order.id,id]);return order;
  }

  async editOrder(id:string,body:any){
    const store=await this.store();const items=Array.isArray(body?.items)?body.items:null;
    return this.db.transaction(async c=>{
      const orderR=await c.query<any>("select * from orders where id=$1 and store_id=$2 for update",[id,store.id]);if(!orderR.rowCount)throw new NotFoundException("Order not found");const order=orderR.rows[0];
      if(order.status==="canceled")throw new ConflictException("Canceled orders cannot be edited");
      let fulfillmentLocationId=order.fulfillment_location_id||null;
      if(!fulfillmentLocationId){
        const location=await c.query<any>("select id from locations where store_id=$1 and active=true order by is_default desc,created_at limit 1",[store.id]);
        fulfillmentLocationId=location.rows[0]?.id||null;
      }
      let subtotal=Number(order.subtotal||0),cost=0;
      if(items){
        const old=await c.query<any>("select * from order_items where order_id=$1",[id]);const oldMap=new Map<string,number>();for(const x of old.rows)if(x.variant_id)oldMap.set(x.variant_id,(oldMap.get(x.variant_id)||0)+Number(x.quantity));
        const nextMap=new Map<string,{qty:number;unit:number;row:any}>();
        for(const line of items){const qty=Number(line.quantity||0);if(!line.variantId||!Number.isInteger(qty)||qty<1)throw new BadRequestException("Invalid order line");const vr=await c.query<any>("select v.*,p.title,p.store_id from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[line.variantId,store.id]);if(!vr.rowCount)throw new NotFoundException("Variant not found");const row=vr.rows[0],unit=line.unitPrice!==undefined?this.num(line.unitPrice):Number(row.price);const prior=nextMap.get(row.id);nextMap.set(row.id,{qty:(prior?.qty||0)+qty,unit,row});}
        const all=new Set([...oldMap.keys(),...nextMap.keys()]);
        for(const vid of all){const oldQty=oldMap.get(vid)||0,next=nextMap.get(vid),newQty=next?.qty||0,delta=newQty-oldQty;if(delta===0)continue;let vr=next?.row;if(!vr){const q=await c.query<any>("select v.*,p.title from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[vid,store.id]);vr=q.rows[0];}if(!vr)throw new NotFoundException("Variant not found");if(delta>0&&Number(vr.inventory)<delta)throw new ConflictException(vr.sku+" has insufficient stock");const before=Number(vr.inventory),after=before-delta;if(fulfillmentLocationId){const level=await c.query<any>("select on_hand from inventory_levels where location_id=$1 and variant_id=$2 for update",[fulfillmentLocationId,vid]);const levelBefore=Number(level.rows[0]?.on_hand||0),levelAfter=levelBefore-delta;if(levelAfter<0)throw new ConflictException(vr.sku+" has insufficient stock at the fulfillment location");await c.query("insert into inventory_levels(location_id,variant_id,on_hand,reserved) values($1,$2,$3,0) on conflict(location_id,variant_id) do update set on_hand=excluded.on_hand,updated_at=now()",[fulfillmentLocationId,vid,levelAfter]);}await c.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,vid]);await c.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_edit',$4,$5,$6,$7,'admin')",[store.id,vid,id,-delta,before,after,"Order edited"]); }
        await c.query("delete from order_items where order_id=$1",[id]);subtotal=0;cost=0;for(const x of nextMap.values()){subtotal+=x.qty*x.unit;cost+=x.qty*Number(x.row.cost_price||0);await c.query("insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,'{}'::jsonb,$6,$7,$8)",[id,x.row.product_id,x.row.id,x.row.sku,x.row.title,x.qty,x.unit,x.qty*x.unit]);}
      }
      const discount=body?.discountAmount!==undefined?Math.max(0,this.num(body.discountAmount)):Number(order.discount_amount||0);const shipping=body?.shippingAmount!==undefined?Math.max(0,this.num(body.shippingAmount)):Number(order.shipping_amount||0);const inclusiveTax=body?.inclusiveTaxAmount!==undefined?Math.max(0,this.num(body.inclusiveTaxAmount)):Number(order.inclusive_tax_amount||0);const exclusiveTax=body?.exclusiveTaxAmount!==undefined?Math.max(0,this.num(body.exclusiveTaxAmount)):body?.taxAmount!==undefined?Math.max(0,this.num(body.taxAmount)):Number(order.exclusive_tax_amount??order.tax_amount??0);const tax=inclusiveTax+exclusiveTax;const total=Math.max(0,subtotal-discount+shipping+exclusiveTax);
      const ship=body?.shippingAddress?this.address(body.shippingAddress):order.shipping_address;const bill=body?.billingAddress?this.address(body.billingAddress):order.billing_address;const grossProfit=total-exclusiveTax-inclusiveTax-cost;
      const u=await c.query<any>("update orders set subtotal=$1,discount_amount=$2,shipping_amount=$3,tax_amount=$4,inclusive_tax_amount=$5,exclusive_tax_amount=$6,total=$7,shipping_address=$8::jsonb,billing_address=$9::jsonb,shipping_method=coalesce($10,shipping_method),notes=coalesce($11,notes),gross_profit=$12 where id=$13 returning *",[subtotal,discount,shipping,tax,inclusiveTax,exclusiveTax,total,JSON.stringify(ship||{}),JSON.stringify(bill||{}),body?.shippingMethod??null,body?.notes??null,grossProfit,id]);
      await c.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.edited','Order lines or totals edited',$2::jsonb)",[id,JSON.stringify({subtotal,discount,shipping,tax,inclusiveTax,exclusiveTax,total})]);await this.logAudit(c,store.id,"order.edited","order",id,u.rows[0]);return u.rows[0];
    });
  }

  async completeReturn(id:string,body:any){
    const store=await this.store();return this.db.transaction(async c=>{const rr=await c.query<any>("select * from returns where id=$1 and store_id=$2 for update",[id,store.id]);if(!rr.rowCount)throw new NotFoundException("Return not found");const ret=rr.rows[0];if(ret.status==="completed")return ret;const items=await c.query<any>("select ri.*,oi.variant_id,oi.order_id from return_items ri join order_items oi on oi.id=ri.order_item_id where ri.return_id=$1",[id]);for(const x of items.rows){if(x.disposition==="restock"&&x.variant_id){const v=await c.query<any>("select inventory from product_variants where id=$1 for update",[x.variant_id]);const before=Number(v.rows[0]?.inventory||0),after=before+Number(x.quantity);await c.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,x.variant_id]);await c.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'return_restock',$4,$5,$6,'Return completed','admin')",[store.id,x.variant_id,ret.order_id,Number(x.quantity),before,after]);}
        if(x.exchange_variant_id){const ev=await c.query<any>("select inventory from product_variants where id=$1 for update",[x.exchange_variant_id]);if(!ev.rowCount||Number(ev.rows[0].inventory)<Number(x.quantity))throw new ConflictException("Exchange variant has insufficient stock");await c.query("update product_variants set inventory=inventory-$1,updated_at=now() where id=$2",[Number(x.quantity),x.exchange_variant_id]);}}
      const refund=Math.max(0,body?.refundAmount!==undefined?this.num(body.refundAmount):Number(ret.refund_amount||0));if(refund>0){const o=await c.query<any>("select currency from orders where id=$1",[ret.order_id]);await c.query("insert into payment_transactions(store_id,order_id,provider,transaction_type,status,amount,currency,metadata) values($1,$2,$3,'refund','succeeded',$4,$5,$6::jsonb)",[store.id,ret.order_id,String(body?.provider||"manual"),refund,o.rows[0]?.currency||"PKR",JSON.stringify({returnId:id})]);}
      const done=await c.query<any>("update returns set status='completed',refund_amount=$1,completed_at=now() where id=$2 returning *",[refund,id]);await c.query("insert into order_events(order_id,event_type,message,metadata) values($1,'return.completed','Return/exchange completed',$2::jsonb)",[ret.order_id,JSON.stringify({returnId:id,refund})]);await this.logAudit(c,store.id,"return.completed","return",id,done.rows[0]);return done.rows[0];});
  }

  async payments(orderId?:string){const s=await this.store();const r=await this.db.query<any>("select * from payment_transactions where store_id=$1 "+(orderId?"and order_id=$2 ":"")+"order by created_at desc limit 500",orderId?[s.id,orderId]:[s.id]);return {items:r.rows};}
  async recordPayment(orderId:string,body:any){
    const store=await this.store();const amount=this.num(body?.amount);if(amount<=0)throw new BadRequestException("amount must be positive");
    return this.db.transaction(async c=>{
      const order=await c.query<any>("select * from orders where id=$1 and store_id=$2 for update",[orderId,store.id]);if(!order.rowCount)throw new NotFoundException("Order not found");
      const tx=await c.query<any>("insert into payment_transactions(store_id,order_id,provider,provider_transaction_id,transaction_type,status,amount,currency,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) returning *",[store.id,orderId,String(body?.provider||"manual"),body?.providerTransactionId??null,String(body?.transactionType||"capture"),String(body?.status||"succeeded"),amount,order.rows[0].currency,JSON.stringify(body?.metadata||{})]);
      const sums=await c.query<any>("select coalesce(sum(amount) filter(where status='succeeded' and transaction_type in ('capture','payment')),0) captured,coalesce(sum(amount) filter(where status='succeeded' and transaction_type='refund'),0) refunded from payment_transactions where order_id=$1",[orderId]);
      const captured=Number(sums.rows[0].captured||0),refunded=Number(sums.rows[0].refunded||0),total=Number(order.rows[0].total||0),net=Math.max(0,captured-refunded);
      const status=refunded>=captured&&captured>0?"refunded":refunded>0?"partially_refunded":net>=total&&total>0?"paid":net>0?"partially_paid":"pending";
      await c.query("update orders set payment_status=$1 where id=$2",[status,orderId]);
      await c.query("insert into order_events(order_id,event_type,message,metadata) values($1,'payment.updated',$2,$3::jsonb)",[orderId,"Payment ledger updated",JSON.stringify({captured,refunded,net,status})]);
      if(String(body?.status||"succeeded")!=="succeeded"){
        await c.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'failed_payment','critical','Payment failed',$2,'order',$3)",[store.id,"A payment transaction failed for order "+order.rows[0].order_number,orderId]);
      }
      await this.logAudit(c,store.id,"payment.recorded","order",orderId,tx.rows[0],{status});
      return {...tx.rows[0],orderPaymentStatus:status,captured,refunded};
    });
  }

  async returns(){const s=await this.store();const r=await this.db.query<any>("select r.*,o.order_number from returns r join orders o on o.id=r.order_id where r.store_id=$1 order by r.created_at desc",[s.id]);return {items:r.rows};}
  async createReturn(body:any){const s=await this.store();const orderId=String(body?.orderId||"");if(!orderId)throw new BadRequestException("orderId is required");return this.db.transaction(async c=>{const o=await c.query<any>("select * from orders where id=$1 and store_id=$2",[orderId,s.id]);if(!o.rowCount)throw new NotFoundException("Order not found");const r=await c.query<any>("insert into returns(store_id,order_id,status,return_type,reason,refund_amount,notes) values($1,$2,'requested',$3,$4,$5,$6) returning *",[s.id,orderId,String(body?.returnType||"return"),body?.reason??null,this.num(body?.refundAmount),body?.notes??null]);for(const x of Array.isArray(body?.items)?body.items:[])await c.query("insert into return_items(return_id,order_item_id,quantity,disposition,exchange_variant_id,refund_amount) values($1,$2,$3,$4,$5,$6)",[r.rows[0].id,x.orderItemId,Number(x.quantity||1),String(x.disposition||"restock"),x.exchangeVariantId||null,this.num(x.refundAmount)]);
      await c.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'return_request','warning','Return / exchange opened',$2,'return',$3)",[s.id,"Return case opened for order "+o.rows[0].order_number,r.rows[0].id]);
      await this.logAudit(c,s.id,"return.requested","return",r.rows[0].id,r.rows[0]);return r.rows[0];});}

  async customerAddresses(customerId:string){const r=await this.db.query<any>("select * from customer_addresses where customer_id=$1 order by is_default desc,created_at desc",[customerId]);return {items:r.rows};}
  async addCustomerAddress(customerId:string,body:any){const a=this.address(body);if(!a.line1||!a.city)throw new BadRequestException("Address is incomplete");if(body?.isDefault)await this.db.query("update customer_addresses set is_default=false where customer_id=$1",[customerId]);const r=await this.db.query<any>("insert into customer_addresses(customer_id,label,address_type,is_default,name,phone,line1,line2,city,region,postal_code,country) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *",[customerId,body?.label??null,String(body?.addressType||"shipping"),Boolean(body?.isDefault),body?.name??null,body?.phone??null,a.line1,a.line2||null,a.city,a.region||null,a.postalCode||null,a.country]);return r.rows[0];}

  async customerTags(customerId:string){
    const store=await this.store();
    const r=await this.db.query<any>("select t.* from customer_tags t join customer_tag_links l on l.tag_id=t.id where l.customer_id=$1 and t.store_id=$2 order by t.name",[customerId,store.id]);
    return {items:r.rows};
  }
  async setCustomerTags(customerId:string,body:any){
    const store=await this.store();const names=Array.isArray(body?.tags)?body.tags.map((x:any)=>String(x).trim()).filter(Boolean):[];
    const customer=await this.db.query("select id from customers where id=$1 and store_id=$2",[customerId,store.id]);if(!customer.rowCount) throw new NotFoundException("Customer not found");
    await this.db.transaction(async c=>{
      await c.query("delete from customer_tag_links where customer_id=$1",[customerId]);
      for(const name of [...new Set(names)] as string[]){
        const t=await c.query<any>("insert into customer_tags(store_id,name) values($1,$2) on conflict(store_id,name) do update set name=excluded.name returning id",[store.id,name]);
        await c.query("insert into customer_tag_links(customer_id,tag_id) values($1,$2) on conflict do nothing",[customerId,t.rows[0].id]);
      }
      await this.logAudit(c,store.id,"customer.tags.updated","customer",customerId,{tags:names});
    });
    return this.customerTags(customerId);
  }

  async suppliers(){const s=await this.store();const r=await this.db.query<any>("select * from suppliers where store_id=$1 order by name",[s.id]);return {items:r.rows};}
  async createSupplier(body:any){const s=await this.store();const name=String(body?.name||"").trim();if(!name)throw new BadRequestException("name is required");const r=await this.db.query<any>("insert into suppliers(store_id,name,email,phone,address,notes) values($1,$2,$3,$4,$5::jsonb,$6) returning *",[s.id,name,body?.email??null,body?.phone??null,JSON.stringify(this.address(body?.address)),body?.notes??null]);return r.rows[0];}
  async purchaseOrders(){const s=await this.store();const r=await this.db.query<any>("select po.*,s.name supplier_name,l.name location_name from purchase_orders po left join suppliers s on s.id=po.supplier_id left join locations l on l.id=po.location_id where po.store_id=$1 order by po.created_at desc",[s.id]);return {items:r.rows};}
  async createPurchaseOrder(body:any){const s=await this.store();const lines=Array.isArray(body?.items)?body.items:[];if(!lines.length)throw new BadRequestException("items are required");return this.db.transaction(async c=>{let subtotal=0;for(const x of lines)subtotal+=Number(x.quantity||0)*this.num(x.unitCost);const p=await c.query<any>("insert into purchase_orders(store_id,supplier_id,location_id,status,currency,subtotal,expected_at,notes) values($1,$2,$3,'draft',$4,$5,$6,$7) returning *",[s.id,body?.supplierId||null,body?.locationId||null,String(body?.currency||s.currency||"PKR"),subtotal,body?.expectedAt??null,body?.notes??null]);for(const x of lines)await c.query("insert into purchase_order_items(purchase_order_id,variant_id,quantity,unit_cost) values($1,$2,$3,$4)",[p.rows[0].id,x.variantId,Number(x.quantity),this.num(x.unitCost)]);return p.rows[0];});}
  async receivePurchaseOrder(id:string,body:any={}){
    const s=await this.store();
    return this.db.transaction(async c=>{
      const p=await c.query<any>("select * from purchase_orders where id=$1 and store_id=$2 for update",[id,s.id]);
      if(!p.rowCount)throw new NotFoundException("Purchase order not found");
      if(p.rows[0].status==="received")return p.rows[0];
      const items=await c.query<any>("select * from purchase_order_items where purchase_order_id=$1 order by id",[id]);
      const requested=new Map<string,number>();
      for(const x of Array.isArray(body?.items)?body.items:[]){
        const qty=Number(x.quantity||0);if(qty<0||!Number.isInteger(qty))throw new BadRequestException("Receive quantities must be non-negative whole numbers");
        requested.set(String(x.itemId),qty);
      }
      let allReceived=true;
      for(const x of items.rows){
        const remaining=Number(x.quantity)-Number(x.received_quantity);
        if(remaining<=0) continue;
        const qty=requested.size?Math.min(remaining,requested.get(String(x.id))||0):remaining;
        if(qty<=0){allReceived=false;continue;}
        const v=await c.query<any>("select inventory from product_variants where id=$1 for update",[x.variant_id]);
        if(!v.rowCount)throw new NotFoundException("Purchase order variant not found");
        const before=Number(v.rows[0].inventory||0),after=before+qty;
        await c.query("update product_variants set inventory=$1,cost_price=$2,updated_at=now() where id=$3",[after,Number(x.unit_cost),x.variant_id]);
        if(p.rows[0].location_id)await c.query("insert into inventory_levels(location_id,variant_id,on_hand) values($1,$2,$3) on conflict(location_id,variant_id) do update set on_hand=inventory_levels.on_hand+excluded.on_hand,updated_at=now()",[p.rows[0].location_id,x.variant_id,qty]);
        await c.query("update purchase_order_items set received_quantity=received_quantity+$1 where id=$2",[qty,x.id]);
        await c.query("insert into inventory_movements(store_id,variant_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,'purchase_receive',$3,$4,$5,$6,'admin')",[s.id,x.variant_id,qty,before,after,"Purchase order "+id]);
        if(Number(x.received_quantity)+qty<Number(x.quantity)) allReceived=false;
      }
      const final=await c.query<any>("select bool_and(received_quantity>=quantity) complete from purchase_order_items where purchase_order_id=$1",[id]);
      const completed=Boolean(final.rows[0]?.complete);
      const done=await c.query<any>("update purchase_orders set status=$1,received_at=case when $1='received' then now() else received_at end where id=$2 returning *",[completed?"received":"partially_received",id]);
      await this.logAudit(c,s.id,"purchase_order.received","purchase_order",id,done.rows[0],{partial:!completed});
      return done.rows[0];
    });
  }

  async audit(){const s=await this.store();const r=await this.db.query<any>("select * from audit_log where store_id=$1 order by created_at desc limit 500",[s.id]);return {items:r.rows};}
  async notifications(){const s=await this.store();const r=await this.db.query<any>("select * from notifications where store_id=$1 order by read_at nulls first,created_at desc limit 500",[s.id]);return {items:r.rows};}
  async report(){
    const s=await this.store();
    const summary=await this.db.query<any>("select coalesce(sum(total) filter(where created_at>=now()-interval '30 days'),0) revenue,coalesce(sum(gross_profit) filter(where created_at>=now()-interval '30 days'),0) gross_profit,count(*) filter(where created_at>=now()-interval '30 days')::int orders,coalesce(avg(total) filter(where created_at>=now()-interval '30 days'),0) aov,count(distinct customer_id) filter(where created_at>=now()-interval '30 days')::int customers from orders where store_id=$1",[s.id]);
    const inv=await this.db.query<any>("select coalesce(sum(v.inventory*coalesce(v.cost_price,0)),0) value,coalesce(sum(v.inventory),0)::int units from product_variants v join products p on p.id=v.product_id where p.store_id=$1",[s.id]);
    const conversion=await this.db.query<any>("select count(*)::int total,count(*) filter(where status='completed')::int completed from checkout_sessions where store_id=$1 and created_at>=now()-interval '30 days'",[s.id]);
    const repeat=await this.db.query<any>("select count(*)::int n from (select customer_id from orders where store_id=$1 and customer_id is not null and created_at>=now()-interval '365 days' group by customer_id having count(*)>1)x",[s.id]);
    const products=await this.db.query<any>("select oi.product_id,oi.title,sum(oi.quantity)::int units,sum(oi.line_total) revenue from order_items oi join orders o on o.id=oi.order_id where o.store_id=$1 and o.created_at>=now()-interval '30 days' group by oi.product_id,oi.title order by revenue desc limit 50",[s.id]);
    const variants=await this.db.query<any>("select oi.variant_id,oi.sku,sum(oi.quantity)::int units,sum(oi.line_total) revenue,coalesce(v.inventory,0)::int inventory,coalesce(v.cost_price,0) cost_price from order_items oi join orders o on o.id=oi.order_id left join product_variants v on v.id=oi.variant_id where o.store_id=$1 and o.created_at>=now()-interval '30 days' group by oi.variant_id,oi.sku,v.inventory,v.cost_price order by revenue desc limit 100",[s.id]);
    const channels=await this.db.query<any>("select source_channel,count(*)::int orders,sum(total) revenue from orders where store_id=$1 and created_at>=now()-interval '30 days' group by source_channel order by revenue desc",[s.id]);
    const locations=await this.db.query<any>("select coalesce(l.name,'Unassigned') location,count(o.id)::int orders,coalesce(sum(o.total),0) revenue from orders o left join locations l on l.id=o.fulfillment_location_id where o.store_id=$1 and o.created_at>=now()-interval '30 days' group by l.name order by revenue desc",[s.id]);
    const collections=await this.db.query<any>("select c.id,c.title,sum(oi.quantity)::int units,sum(oi.line_total) revenue from collection_products cp join collections c on c.id=cp.collection_id join order_items oi on oi.product_id=cp.product_id join orders o on o.id=oi.order_id where c.store_id=$1 and o.created_at>=now()-interval '30 days' group by c.id,c.title order by revenue desc limit 50",[s.id]);
    const row=summary.rows[0],check=conversion.rows[0];
    return {
      revenue:Number(row.revenue||0),gross_profit:Number(row.gross_profit||0),gross_margin:Number(row.revenue||0)>0?Math.round(Number(row.gross_profit||0)/Number(row.revenue)*10000)/100:0,
      orders:Number(row.orders||0),aov:Number(row.aov||0),customers:Number(row.customers||0),repeat_customers:Number(repeat.rows[0]?.n||0),
      checkout_conversion:Number(check?.total||0)>0?Math.round(Number(check.completed||0)/Number(check.total)*10000)/100:0,
      inventory_value:Number(inv.rows[0].value),inventory_units:Number(inv.rows[0].units),
      products:products.rows.map((x:any)=>({...x,revenue:Number(x.revenue)})),
      variants:variants.rows.map((x:any)=>({...x,revenue:Number(x.revenue),cost_price:Number(x.cost_price||0)})),
      channels:channels.rows.map((x:any)=>({...x,revenue:Number(x.revenue)})),
      locations:locations.rows.map((x:any)=>({...x,revenue:Number(x.revenue)})),
      collections:collections.rows.map((x:any)=>({...x,revenue:Number(x.revenue)})),
    };
  }
}
