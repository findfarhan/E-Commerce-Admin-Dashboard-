import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import type {PoolClient} from "pg";
import {DatabaseService} from "../database/database.service";
import {GovernanceService} from "./governance.service";
import {PricingEngineService,type PricingLine} from "./pricing-engine.service";
import {StoreContextService} from "./store-context.service";

@Injectable()
export class OrdersPlatformService{
  constructor(
    private readonly db:DatabaseService,
    private readonly context:StoreContextService,
    private readonly pricing:PricingEngineService,
    private readonly governance:GovernanceService,
  ){}

  private async resolveCustomer(client:PoolClient,storeId:string,body:any){
    if(body?.customerId){
      const found=await client.query<any>("select * from customers where id=$1 and store_id=$2",[String(body.customerId),storeId]);
      if(!found.rowCount) throw new BadRequestException("Customer not found");
      return found.rows[0];
    }
    const customer=body?.customer||{};
    const email=String(customer.email||"").trim().toLowerCase();
    const name=String(customer.name||"").trim();
    const phone=String(customer.phone||"").trim();
    if(!email&&!name&&!phone) return null;
    if(email&&!email.includes("@")) throw new BadRequestException("Customer email is invalid");
    if(email){
      const result=await client.query<any>(
        `insert into customers(store_id,email,name,phone,attributes,updated_at)
         values($1,$2,$3,$4,'{}'::jsonb,now())
         on conflict(store_id,lower(email)) where email is not null and trim(email)<>''
         do update set name=coalesce(nullif(excluded.name,''),customers.name),phone=coalesce(nullif(excluded.phone,''),customers.phone),updated_at=now()
         returning *`,
        [storeId,email,name||null,phone||null]
      );
      return result.rows[0];
    }
    const result=await client.query<any>("insert into customers(store_id,email,name,phone,attributes) values($1,null,$2,$3,'{}'::jsonb) returning *",[storeId,name||null,phone||null]);
    return result.rows[0];
  }

  private async lines(client:PoolClient,storeId:string,rawItems:any[],allowPriceOverride=true){
    if(!Array.isArray(rawItems)||!rawItems.length) throw new BadRequestException("At least one order item is required");
    if(rawItems.length>100) throw new BadRequestException("Too many order items");
    const lines:any[]=[];
    for(const raw of rawItems){
      const variantId=String(raw?.variantId||"");
      const quantity=Number(raw?.quantity??1);
      if(!variantId||!Number.isInteger(quantity)||quantity<1||quantity>1000) throw new BadRequestException("Each item needs a valid variant and quantity");
      const result=await client.query<any>(
        `select v.id as variant_id,v.sku,v.price,v.cost_amount,v.inventory,coalesce(v.weight_grams,p.weight_grams,0) as weight_grams,
         p.id as product_id,p.title,p.product_type,p.taxable,
         coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options
         from product_variants v join products p on p.id=v.product_id
         where v.id=$1 and p.store_id=$2 and v.status<>'archived' and p.status<>'archived' limit 1`,
        [variantId,storeId]
      );
      if(!result.rowCount) throw new BadRequestException("Unknown product variant");
      const item=result.rows[0];
      const catalogPrice=Number(item.price||0);
      const requestedPrice=raw?.unitPrice===undefined?catalogPrice:Number(raw.unitPrice);
      if(!Number.isFinite(requestedPrice)||requestedPrice<0) throw new BadRequestException("Invalid item price");
      if(!allowPriceOverride&&requestedPrice!==catalogPrice) throw new BadRequestException("Price overrides are not allowed");
      lines.push({
        productId:item.product_id,
        variantId:item.variant_id,
        sku:item.sku,
        title:item.title,
        selectedOptions:item.selected_options||{},
        quantity,
        unitPrice:requestedPrice,
        unitCost:Number(item.cost_amount||0),
        lineTotal:Math.round(requestedPrice*quantity*100)/100,
        priceOverridden:requestedPrice!==catalogPrice,
        weightGrams:Number(item.weight_grams||0),
        taxable:item.taxable!==false,
        productType:item.product_type||null,
      });
    }
    return lines;
  }

  async draftOrders(){
    const storeId=await this.context.storeId();
    const result=await this.db.query<any>(
      `select d.*,c.name as customer_name,c.email as customer_email,
       (select count(*)::int from draft_order_items i where i.draft_order_id=d.id) as item_count
       from draft_orders d left join customers c on c.id=d.customer_id
       where d.store_id=$1 order by d.created_at desc limit 250`,
      [storeId]
    );
    return {items:result.rows};
  }

  async draftOrder(id:string){
    const storeId=await this.context.storeId();
    const draft=await this.db.query<any>("select d.*,c.name as customer_name,c.email as customer_email,c.phone as customer_phone from draft_orders d left join customers c on c.id=d.customer_id where d.id=$1 and d.store_id=$2",[id,storeId]);
    if(!draft.rowCount) throw new NotFoundException("Draft order not found");
    const items=await this.db.query<any>("select * from draft_order_items where draft_order_id=$1 order by id",[id]);
    return {draft:draft.rows[0],items:items.rows};
  }

  async createDraft(body:any){
    const store=await this.context.store();
    return this.db.transaction(async client=>{
      const customer=await this.resolveCustomer(client,store.id,body);
      const lines=await this.lines(client,store.id,body?.items||[],true);
      if(lines.some(line=>line.priceOverridden)&&!String(body?.priceOverrideReason||"").trim()) throw new BadRequestException("A reason is required when overriding a catalog price");
      const pricingLines:PricingLine[]=lines.map(line=>({
        productId:line.productId,variantId:line.variantId,quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal,
        productType:line.productType,taxable:line.taxable,weightGrams:line.weightGrams,
      }));
      const quote=await this.pricing.price(store.id,pricingLines,{
        discountCode:body?.discountCode||null,
        shippingAddress:body?.shippingAddress||{},
        shippingRateId:body?.shippingRateId||null,
        customerId:customer?.id||null,
      },client);
      const numberResult=await client.query<{value:string}>("select 'Q-'||lpad(nextval('jewelry_quote_number_seq')::text,6,'0') as value");
      const quoteNumber=numberResult.rows[0].value;
      const result=await client.query<any>(
        `insert into draft_orders(store_id,quote_number,customer_id,status,currency,subtotal,discount_amount,shipping_amount,tax_amount,total,price_override_reason,shipping_address,billing_address,shipping_method,discount_code,notes,expires_at,created_by)
         values($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17) returning *`,
        [store.id,quoteNumber,customer?.id||null,body?.currency||store.currency||"PKR",quote.subtotal,quote.discount.amount,quote.shipping.amount,quote.tax.amount,quote.total,String(body?.priceOverrideReason||"").trim()||null,JSON.stringify(body?.shippingAddress||{}),JSON.stringify(body?.billingAddress||body?.shippingAddress||{}),quote.shipping.name||body?.shippingMethod||null,quote.discount.code||body?.discountCode||null,String(body?.notes||"").trim()||null,body?.expiresAt||null,String(body?.actor||"admin")]
      );
      const draft=result.rows[0];
      for(const line of lines){
        await client.query(
          `insert into draft_order_items(draft_order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,unit_cost,line_total,price_overridden,metadata)
           values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,'{}'::jsonb)`,
          [draft.id,line.productId,line.variantId,line.sku,line.title,JSON.stringify(line.selectedOptions||{}),line.quantity,line.unitPrice,line.unitCost,line.lineTotal,line.priceOverridden]
        );
      }
      await this.governance.audit(store.id,"draft_order.created","draft_order",draft.id,{actor:body?.actor,after:{...draft,items:lines},metadata:{pricing:quote}},client);
      return {...draft,items:lines,pricing:quote};
    });
  }

  async updateDraft(id:string,body:any){
    const store=await this.context.store();
    return this.db.transaction(async client=>{
      const current=await client.query<any>("select * from draft_orders where id=$1 and store_id=$2 for update",[id,store.id]);
      if(!current.rowCount) throw new NotFoundException("Draft order not found");
      if(["converted","canceled"].includes(current.rows[0].status)) throw new ConflictException("This draft can no longer be edited");
      const existingItems=await client.query<any>("select * from draft_order_items where draft_order_id=$1",[id]);
      const rawItems=body?.items??existingItems.rows.map((item:any)=>({variantId:item.variant_id,quantity:item.quantity,unitPrice:item.unit_price}));
      const customer=body?.customerId||body?.customer?await this.resolveCustomer(client,store.id,body):null;
      const lines=await this.lines(client,store.id,rawItems,true);
      if(lines.some(line=>line.priceOverridden)&&!String(body?.priceOverrideReason??current.rows[0].price_override_reason??"").trim()) throw new BadRequestException("A reason is required when overriding a catalog price");
      const shippingAddress=body?.shippingAddress??current.rows[0].shipping_address??{};
      const discountCode=body?.discountCode??current.rows[0].discount_code??null;
      const quote=await this.pricing.price(store.id,lines.map(line=>({
        productId:line.productId,variantId:line.variantId,quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal,productType:line.productType,taxable:line.taxable,weightGrams:line.weightGrams,
      })),{discountCode,shippingAddress,shippingRateId:body?.shippingRateId||null,customerId:customer?.id||current.rows[0].customer_id||null},client);
      await client.query(
        `update draft_orders set customer_id=coalesce($1,customer_id),subtotal=$2,discount_amount=$3,shipping_amount=$4,tax_amount=$5,total=$6,
         price_override_reason=$7,shipping_address=$8::jsonb,billing_address=$9::jsonb,shipping_method=$10,discount_code=$11,notes=$12,expires_at=$13,updated_at=now()
         where id=$14`,
        [customer?.id||null,quote.subtotal,quote.discount.amount,quote.shipping.amount,quote.tax.amount,quote.total,String(body?.priceOverrideReason??current.rows[0].price_override_reason??"").trim()||null,JSON.stringify(shippingAddress),JSON.stringify(body?.billingAddress??current.rows[0].billing_address??shippingAddress),quote.shipping.name||current.rows[0].shipping_method,quote.discount.code||discountCode,String(body?.notes??current.rows[0].notes??"").trim()||null,body?.expiresAt??current.rows[0].expires_at,id]
      );
      await client.query("delete from draft_order_items where draft_order_id=$1",[id]);
      for(const line of lines){
        await client.query(
          "insert into draft_order_items(draft_order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,unit_cost,line_total,price_overridden,metadata) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,'{}'::jsonb)",
          [id,line.productId,line.variantId,line.sku,line.title,JSON.stringify(line.selectedOptions||{}),line.quantity,line.unitPrice,line.unitCost,line.lineTotal,line.priceOverridden]
        );
      }
      await this.governance.audit(store.id,"draft_order.updated","draft_order",id,{actor:body?.actor,before:current.rows[0],after:{pricing:quote,items:lines}},client);
      return {id,pricing:quote,items:lines};
    });
  }

  async sendDraft(id:string,body:any){
    const store=await this.context.store();
    return this.db.transaction(async client=>{
      const draft=await client.query<any>("select d.*,c.email,c.name from draft_orders d left join customers c on c.id=d.customer_id where d.id=$1 and d.store_id=$2 for update",[id,store.id]);
      if(!draft.rowCount) throw new NotFoundException("Draft order not found");
      if(!draft.rows[0].email) throw new BadRequestException("Draft order customer has no email");
      if(["converted","canceled","expired"].includes(draft.rows[0].status)) throw new ConflictException("Draft order cannot be sent");
      const updated=await client.query<any>("update draft_orders set status='sent',updated_at=now() where id=$1 returning *",[id]);
      const message=await this.governance.enqueueMessage(store.id,{
        channel:"email",
        recipient:draft.rows[0].email,
        templateKey:"draft_order_quote",
        subject:String(body?.subject||("Your jewelry quote "+draft.rows[0].quote_number)),
        payload:{draftOrderId:id,quoteNumber:draft.rows[0].quote_number,total:Number(draft.rows[0].total),currency:draft.rows[0].currency,customerName:draft.rows[0].name},
      },client);
      await this.governance.audit(store.id,"draft_order.sent","draft_order",id,{actor:body?.actor,after:updated.rows[0],metadata:{messageId:message.id}},client);
      return {draft:updated.rows[0],message};
    });
  }

  private async inventoryLocation(client:PoolClient,storeId:string,requested?:string|null){
    if(requested){
      const found=await client.query<any>("select id from locations where id=$1 and store_id=$2 and is_active=true and is_fulfillment=true",[requested,storeId]);
      if(!found.rowCount) throw new BadRequestException("Fulfillment location is not available");
      return requested;
    }
    const result=await client.query<any>("select default_location_id from stores where id=$1",[storeId]);
    if(result.rows[0]?.default_location_id) return result.rows[0].default_location_id as string;
    const first=await client.query<any>("select id from locations where store_id=$1 and is_active=true and is_fulfillment=true order by priority,created_at limit 1",[storeId]);
    if(!first.rowCount) throw new BadRequestException("No fulfillment location is configured");
    return first.rows[0].id as string;
  }

  private async applyInventoryDelta(client:PoolClient,storeId:string,locationId:string,variantId:string,delta:number,orderId:string|null,reason:string,actor:string){
    const level=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,variantId]);
    if(!level.rowCount){
      if(delta<0) throw new ConflictException("Variant has no stock at the selected location");
      await client.query("insert into inventory_levels(store_id,location_id,variant_id,available) values($1,$2,$3,$4)",[storeId,locationId,variantId,delta]);
    }else{
      const next=Number(level.rows[0].available)+delta;
      if(next<0) throw new ConflictException("Not enough stock at the selected location");
      await client.query("update inventory_levels set available=$1,updated_at=now() where id=$2",[next,level.rows[0].id]);
    }
    const variant=await client.query<any>("select inventory from product_variants where id=$1 for update",[variantId]);
    if(!variant.rowCount) throw new NotFoundException("Variant not found");
    const before=Number(variant.rows[0].inventory||0);
    const totalResult=await client.query<any>("select coalesce(sum(available),0)::int as total from inventory_levels where variant_id=$1",[variantId]);
    const after=Number(totalResult.rows[0]?.total||0);
    await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,variantId]);
    await client.query(
      "insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [storeId,variantId,orderId,delta<0?"order_sale":"order_restore",delta,before,after,reason,actor]
    );
  }

  async convertDraft(id:string,body:any={}){
    const store=await this.context.store();
    return this.db.transaction(async client=>{
      const draftResult=await client.query<any>("select * from draft_orders where id=$1 and store_id=$2 for update",[id,store.id]);
      if(!draftResult.rowCount) throw new NotFoundException("Draft order not found");
      const draft=draftResult.rows[0];
      if(draft.status==="converted"&&draft.converted_order_id){
        const existing=await client.query<any>("select * from orders where id=$1",[draft.converted_order_id]);
        return {idempotent:true,order:existing.rows[0]};
      }
      if(["canceled","expired"].includes(draft.status)) throw new ConflictException("Draft order cannot be converted");
      if(draft.expires_at&&new Date(draft.expires_at).getTime()<Date.now()) throw new ConflictException("Draft order has expired");
      let customer:any=null;
      if(draft.customer_id){
        const found=await client.query<any>("select * from customers where id=$1 and store_id=$2",[draft.customer_id,store.id]);
        customer=found.rows[0]||null;
      }else{
        customer=await this.resolveCustomer(client,store.id,body);
      }
      if(!customer) throw new BadRequestException("A customer is required before conversion");
      const items=await client.query<any>("select * from draft_order_items where draft_order_id=$1 order by id",[id]);
      if(!items.rowCount) throw new BadRequestException("Draft order has no items");
      const locationId=await this.inventoryLocation(client,store.id,body?.locationId||null);
      for(const item of items.rows){
        if(!item.variant_id) throw new ConflictException("A draft item no longer has a sellable variant");
        const level=await client.query<any>("select available from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,item.variant_id]);
        if(!level.rowCount||Number(level.rows[0].available)<Number(item.quantity)) throw new ConflictException(item.sku+" does not have enough stock at the fulfillment location");
      }

      const numberResult=await client.query<{value:string}>("select 'JS-'||lpad(nextval('jewelry_order_number_seq')::text,6,'0') as value");
      const orderNumber=numberResult.rows[0].value;
      const paymentStatus=String(body?.paymentStatus||"pending");
      if(!["pending","partially_paid","paid"].includes(paymentStatus)) throw new BadRequestException("Invalid manual order payment status");
      const orderResult=await client.query<any>(
        `insert into orders(store_id,customer_id,order_number,status,payment_status,currency,subtotal,total,source_channel,external_id,shipping_address,billing_address,shipping_method,shipping_amount,payment_method,fulfillment_status,notes,discount_amount,tax_amount,discount_code,location_id,draft_order_id,terms_accepted_at)
         values($1,$2,$3,'confirmed',$4,$5,$6,$7,'admin_manual',$8,$9::jsonb,$10::jsonb,$11,$12,$13,'unfulfilled',$14,$15,$16,$17,$18,$19,now()) returning *`,
        [store.id,customer.id,orderNumber,paymentStatus,draft.currency,Number(draft.subtotal),Number(draft.total),"draft:"+id,JSON.stringify(draft.shipping_address||{}),JSON.stringify(draft.billing_address||draft.shipping_address||{}),draft.shipping_method,Number(draft.shipping_amount||0),String(body?.paymentMethod||"manual"),draft.notes,Number(draft.discount_amount||0),Number(draft.tax_amount||0),draft.discount_code||null,locationId,id]
      );
      const order=orderResult.rows[0];
      for(const item of items.rows){
        await client.query(
          `insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,unit_cost,line_total,discount_amount,tax_amount)
           values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,0,0)`,
          [order.id,item.product_id,item.variant_id,item.sku,item.title,JSON.stringify(item.selected_options||{}),item.quantity,item.unit_price,item.unit_cost,item.line_total]
        );
        await this.applyInventoryDelta(client,store.id,locationId,item.variant_id,-Number(item.quantity),order.id,"Manual order "+orderNumber,String(body?.actor||"admin"));
      }
      if(draft.discount_code){
        const discount=await client.query<any>("select id from discounts where store_id=$1 and lower(coalesce(code,''))=lower($2) limit 1",[store.id,draft.discount_code]);
        if(discount.rowCount){
          await client.query("update discounts set usage_count=usage_count+1,updated_at=now() where id=$1",[discount.rows[0].id]);
          await client.query("insert into discount_redemptions(discount_id,store_id,order_id,draft_order_id,customer_id,amount) values($1,$2,$3,$4,$5,$6)",[discount.rows[0].id,store.id,order.id,id,customer.id,Number(draft.discount_amount||0)]);
        }
      }
      const paymentAmount=Number(body?.paymentAmount??(paymentStatus==="paid"?draft.total:0));
      if(paymentAmount>0){
        await client.query(
          "insert into payment_transactions(store_id,order_id,draft_order_id,transaction_type,provider,status,amount,currency,idempotency_key,metadata) values($1,$2,$3,'payment',$4,'succeeded',$5,$6,$7,$8::jsonb)",
          [store.id,order.id,id,String(body?.paymentProvider||"manual"),paymentAmount,draft.currency,"manual-order:"+order.id+":initial",JSON.stringify({method:body?.paymentMethod||"manual"})]
        );
      }
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.created',$2,$3::jsonb)",[order.id,"Order "+orderNumber+" created from draft quote",JSON.stringify({draftOrderId:id,locationId})]);
      await client.query("update draft_orders set status='converted',converted_order_id=$1,updated_at=now() where id=$2",[order.id,id]);
      await this.governance.notify(store.id,{type:"order.created",title:"New manual order "+orderNumber,body:"Created from "+draft.quote_number,severity:"success",resourceType:"order",resourceId:order.id},client);
      if(customer.email){
        await this.governance.enqueueMessage(store.id,{channel:"email",recipient:customer.email,templateKey:"order_confirmation",subject:"Order "+orderNumber+" confirmed",payload:{orderId:order.id,orderNumber,total:Number(order.total),currency:order.currency}},client);
      }
      await this.governance.audit(store.id,"draft_order.converted","order",order.id,{actor:body?.actor,after:order,metadata:{draftOrderId:id,locationId}},client);
      return {idempotent:false,order};
    });
  }

  async manualOrder(body:any){
    const draft=await this.createDraft({...body,priceOverrideReason:body?.priceOverrideReason||"Manual order"});
    return this.convertDraft(draft.id,body);
  }

  async editOrder(id:string,body:any){
    const store=await this.context.store();
    return this.db.transaction(async client=>{
      const orderResult=await client.query<any>("select * from orders where id=$1 and store_id=$2 for update",[id,store.id]);
      if(!orderResult.rowCount) throw new NotFoundException("Order not found");
      const order=orderResult.rows[0];
      if(order.status==="canceled"||order.fulfillment_status==="returned") throw new ConflictException("This order can no longer be edited");
      const beforeItems=await client.query<any>("select * from order_items where order_id=$1",[id]);
      const locationId=await this.inventoryLocation(client,store.id,body?.locationId||order.location_id||null);
      let lines:any[]=beforeItems.rows.map((item:any)=>({
        productId:item.product_id,variantId:item.variant_id,sku:item.sku,title:item.title,selectedOptions:item.selected_options||{},
        quantity:Number(item.quantity),unitPrice:Number(item.unit_price),unitCost:Number(item.unit_cost||0),lineTotal:Number(item.line_total),
        weightGrams:0,taxable:true,productType:null,priceOverridden:false,
      }));

      if(body?.items!==undefined){
        if(order.fulfillment_status==="fulfilled") throw new ConflictException("Fulfilled orders cannot change line items");
        lines=await this.lines(client,store.id,body.items,true);
        const oldQty=new Map<string,number>();
        const newQty=new Map<string,number>();
        for(const item of beforeItems.rows) if(item.variant_id) oldQty.set(item.variant_id,(oldQty.get(item.variant_id)||0)+Number(item.quantity));
        for(const line of lines) if(line.variantId) newQty.set(line.variantId,(newQty.get(line.variantId)||0)+Number(line.quantity));
        const variants=new Set([...oldQty.keys(),...newQty.keys()]);
        for(const variantId of variants){
          const delta=(newQty.get(variantId)||0)-(oldQty.get(variantId)||0);
          if(delta!==0) await this.applyInventoryDelta(client,store.id,locationId,variantId,-delta,id,"Order "+order.order_number+" edited",String(body?.actor||"admin"));
        }
      }

      const shippingAddress=body?.shippingAddress??order.shipping_address??{};
      const pricing=await this.pricing.price(store.id,lines.map(line=>({
        productId:line.productId,variantId:line.variantId,quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal,
        productType:line.productType,taxable:line.taxable,weightGrams:line.weightGrams,
      })),{discountCode:body?.discountCode??order.discount_code??null,shippingAddress,shippingRateId:body?.shippingRateId||null,customerId:order.customer_id},client);

      if(body?.items!==undefined){
        await client.query("delete from order_items where order_id=$1",[id]);
        for(const line of lines){
          await client.query(
            "insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,unit_cost,line_total,discount_amount,tax_amount) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,0,0)",
            [id,line.productId,line.variantId,line.sku,line.title,JSON.stringify(line.selectedOptions||{}),line.quantity,line.unitPrice,line.unitCost,line.lineTotal]
          );
        }
      }

      const updated=await client.query<any>(
        `update orders set subtotal=$1,discount_amount=$2,shipping_amount=$3,tax_amount=$4,total=$5,discount_code=$6,
         shipping_address=$7::jsonb,billing_address=$8::jsonb,shipping_method=$9,location_id=$10,notes=$11
         where id=$12 returning *`,
        [pricing.subtotal,pricing.discount.amount,pricing.shipping.amount,pricing.tax.amount,pricing.total,pricing.discount.code||body?.discountCode||order.discount_code||null,JSON.stringify(shippingAddress),JSON.stringify(body?.billingAddress??order.billing_address??shippingAddress),pricing.shipping.name||body?.shippingMethod||order.shipping_method,locationId,body?.notes??order.notes,id]
      );
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.edited',$2,$3::jsonb)",[id,"Order edited by admin",JSON.stringify({pricing,locationId})]);
      await this.governance.audit(store.id,"order.edited","order",id,{actor:body?.actor,before:{order,items:beforeItems.rows},after:{order:updated.rows[0],items:lines},metadata:{pricing}},client);
      return {order:updated.rows[0],items:lines,pricing};
    });
  }
}
