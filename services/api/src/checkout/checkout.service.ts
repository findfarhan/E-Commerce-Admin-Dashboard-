import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {GovernanceService} from "../platform/governance.service";
import {PricingEngineService,type PricingLine} from "../platform/pricing-engine.service";

type RequestedLine={slug?:string;variantId?:string;quantity?:number};

@Injectable()
export class CheckoutService{
  constructor(
    private readonly db:DatabaseService,
    private readonly pricing:PricingEngineService,
    private readonly governance:GovernanceService,
  ){}

  private async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>("select * from stores where domain=$1 limit 1",[domain]);
    if(!result.rowCount) throw new NotFoundException("Store is not configured");
    return result.rows[0];
  }

  private cleanAddress(value:any){
    const address=value&&typeof value==="object"?value:{};
    return {
      line1:String(address.line1||"").trim(),
      line2:String(address.line2||"").trim(),
      city:String(address.city||"").trim(),
      region:String(address.region||"").trim(),
      postalCode:String(address.postalCode||"").trim(),
      country:String(address.country||"Pakistan").trim(),
    };
  }

  async create(body:any){
    const requested=Array.isArray(body?.items)?body.items as RequestedLine[]:[];
    if(!requested.length) throw new BadRequestException("At least one cart item is required");
    if(requested.length>50) throw new BadRequestException("Too many cart lines");
    const store=await this.store();

    return this.db.transaction(async client=>{
      const priced:any[]=[];
      for(const item of requested){
        const quantity=Number(item.quantity??1);
        if(!Number.isInteger(quantity)||quantity<1||quantity>25) throw new BadRequestException("Cart quantities must be whole numbers between 1 and 25");
        let found:any;
        const select=`select v.id as variant_id,v.sku,v.price,v.inventory,v.cost_amount,coalesce(v.weight_grams,p.weight_grams,0) as weight_grams,
          p.id as product_id,p.handle,p.title,p.product_type,p.taxable,
          coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options
          from product_variants v join products p on p.id=v.product_id`;
        if(item.variantId){
          found=await client.query<any>(select+" where v.id=$1 and p.store_id=$2 and p.status='active' and (p.published_at is null or p.published_at<=now()) and v.status='active' limit 1",[item.variantId,store.id]);
        }else{
          found=await client.query<any>(select+" where p.store_id=$1 and p.handle=$2 and p.status='active' and (p.published_at is null or p.published_at<=now()) and v.status='active' order by v.created_at limit 1",[store.id,item.slug]);
        }
        const variant=found.rows[0];
        if(!variant) throw new BadRequestException("A cart item is no longer available");
        if(Number(variant.inventory)<quantity) throw new BadRequestException(variant.sku+" has only "+variant.inventory+" item(s) available");
        const unitPrice=Number(variant.price);
        priced.push({...variant,quantity,unitPrice,lineTotal:unitPrice*quantity});
      }

      const subtotal=priced.reduce((sum,line)=>sum+line.lineTotal,0);
      const checkoutResult=await client.query<any>(
        "insert into checkout_sessions(store_id,status,currency,subtotal,payment_method) values($1,'open',$2,$3,'cod') returning id,status,currency,subtotal,expires_at,created_at",
        [store.id,store.currency||"PKR",subtotal]
      );
      const checkout=checkoutResult.rows[0];

      for(const line of priced){
        await client.query(
          "insert into checkout_lines(checkout_id,product_id,variant_id,sku_snapshot,title_snapshot,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)",
          [checkout.id,line.product_id,line.variant_id,line.sku,line.title,JSON.stringify(line.selected_options||{}),line.quantity,line.unitPrice,line.lineTotal]
        );
      }

      return {...checkout,subtotal:Number(checkout.subtotal),discount_amount:0,shipping_amount:0,tax_amount:0,total:Number(checkout.subtotal),items:priced.map(line=>({productId:line.product_id,variantId:line.variant_id,slug:line.handle,title:line.title,sku:line.sku,selectedOptions:line.selected_options||{},quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal}))};
    });
  }

  async detail(id:string){
    const store=await this.store();
    const checkout=await this.db.query<any>("select * from checkout_sessions where id=$1 and store_id=$2 limit 1",[id,store.id]);
    if(!checkout.rowCount) throw new NotFoundException("Checkout not found");
    const lines=await this.db.query<any>("select id,product_id,variant_id,sku_snapshot,title_snapshot,selected_options,quantity,unit_price,line_total from checkout_lines where checkout_id=$1 order by id",[id]);
    const row=checkout.rows[0];
    const subtotal=Number(row.subtotal||0),discount=Number(row.discount_amount||0),shipping=Number(row.shipping_amount||0),tax=Number(row.tax_amount||0);
    return {
      id:row.id,status:row.status,currency:row.currency,subtotal,
      discount_code:row.discount_code||null,discount_amount:discount,
      shipping_amount:shipping,shipping_method:row.shipping_method,shipping_rate_id:row.shipping_rate_id||null,
      tax_amount:tax,total:Math.max(0,subtotal-discount+shipping+tax),
      payment_method:row.payment_method,expires_at:row.expires_at,
      items:lines.rows.map(line=>({...line,unit_price:Number(line.unit_price),line_total:Number(line.line_total)})),
    };
  }

  async setCustomer(id:string,body:any){
    const store=await this.store();
    const email=String(body?.email||"").trim().toLowerCase();
    const name=String(body?.name||"").trim();
    const phone=String(body?.phone||"").trim();
    if(!email||!email.includes("@")) throw new BadRequestException("A valid email is required");
    if(!name) throw new BadRequestException("Customer name is required");
    if(!phone) throw new BadRequestException("Phone is required");
    if(body?.termsAccepted!==true) throw new BadRequestException("Terms and privacy acceptance is required");

    const shipping=this.cleanAddress(body?.shippingAddress);
    if(!shipping.line1||!shipping.city||!shipping.country) throw new BadRequestException("Shipping address is incomplete");
    const billing=body?.billingAddress?this.cleanAddress(body.billingAddress):shipping;
    const paymentMethod=String(body?.paymentMethod||"cod").toLowerCase();
    if(paymentMethod!=="cod") throw new BadRequestException("Only COD is enabled until an online payment provider is connected");

    const lines=await this.db.query<any>(
      `select cl.product_id,cl.variant_id,cl.quantity,cl.unit_price,cl.line_total,
       p.product_type,p.taxable,coalesce(v.weight_grams,p.weight_grams,0) as weight_grams
       from checkout_lines cl join products p on p.id=cl.product_id join product_variants v on v.id=cl.variant_id
       where cl.checkout_id=$1`,
      [id]
    );
    if(!lines.rowCount) throw new BadRequestException("Checkout has no items");
    const pricingLines:PricingLine[]=lines.rows.map((line:any)=>({
      productId:line.product_id,variantId:line.variant_id,quantity:Number(line.quantity),unitPrice:Number(line.unit_price),
      lineTotal:Number(line.line_total),productType:line.product_type,taxable:line.taxable!==false,weightGrams:Number(line.weight_grams||0),
    }));
    const quote=await this.pricing.price(store.id,pricingLines,{
      discountCode:body?.discountCode||null,
      shippingAddress:shipping,
      shippingRateId:body?.shippingRateId||null,
    });

    const isGift=Boolean(body?.isGift);
    const giftMessage=isGift?String(body?.giftMessage||"").trim().slice(0,500):null;
    const result=await this.db.query<any>(
      `update checkout_sessions set customer_email=$1,customer_name=$2,customer_phone=$3,shipping_address=$4::jsonb,billing_address=$5::jsonb,
       shipping_method=$6,shipping_rate_id=$7,shipping_amount=$8,discount_code=$9,discount_amount=$10,tax_amount=$11,payment_method=$12,
       is_gift=$13,gift_message=$14,terms_accepted_at=now(),updated_at=now()
       where id=$15 and store_id=$16 and status='open' and expires_at>now()
       returning *`,
      [email,name,phone,JSON.stringify(shipping),JSON.stringify(billing),quote.shipping.name,quote.shipping.rateId,quote.shipping.amount,quote.discount.code||body?.discountCode||null,quote.discount.amount,quote.tax.amount,paymentMethod,isGift,giftMessage,id,store.id]
    );
    if(!result.rowCount) throw new NotFoundException("Open checkout not found");
    return {...result.rows[0],subtotal:Number(result.rows[0].subtotal),discount_amount:Number(result.rows[0].discount_amount||0),shipping_amount:Number(result.rows[0].shipping_amount||0),tax_amount:Number(result.rows[0].tax_amount||0),total:quote.total,pricing:quote};
  }

  private async defaultLocation(client:any,storeId:string){
    const store=await client.query<any>("select default_location_id from stores where id=$1",[storeId]);
    if(store.rows[0]?.default_location_id) return store.rows[0].default_location_id as string;
    const location=await client.query<any>("select id from locations where store_id=$1 and is_active=true and is_fulfillment=true order by priority,created_at limit 1",[storeId]);
    return location.rows[0]?.id||null;
  }

  private async deductInventory(client:any,storeId:string,locationId:string|null,variantId:string,quantity:number,orderId:string,reason:string){
    const variant=await client.query<any>("select inventory from product_variants where id=$1 for update",[variantId]);
    if(!variant.rowCount) throw new ConflictException("Variant no longer exists");
    const before=Number(variant.rows[0].inventory||0);
    if(locationId){
      const level=await client.query<any>("select * from inventory_levels where location_id=$1 and variant_id=$2 for update",[locationId,variantId]);
      if(!level.rowCount||Number(level.rows[0].available)<quantity) throw new ConflictException("Not enough stock at the fulfillment location");
      await client.query("update inventory_levels set available=available-$1,updated_at=now() where id=$2",[quantity,level.rows[0].id]);
      const total=await client.query<any>("select coalesce(sum(available),0)::int as total from inventory_levels where variant_id=$1",[variantId]);
      const after=Number(total.rows[0]?.total||0);
      await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,variantId]);
      await client.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_sale',$4,$5,$6,$7,'checkout')",[storeId,variantId,orderId,-quantity,before,after,reason]);
      return;
    }
    if(before<quantity) throw new ConflictException("Not enough inventory");
    const after=before-quantity;
    await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,variantId]);
    await client.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_sale',$4,$5,$6,$7,'checkout')",[storeId,variantId,orderId,-quantity,before,after,reason]);
  }

  async complete(id:string,idempotencyKey?:string){
    if(!idempotencyKey||idempotencyKey.length<8) throw new BadRequestException("Idempotency-Key header is required");
    const store=await this.store();

    return this.db.transaction(async client=>{
      const checkoutResult=await client.query<any>("select * from checkout_sessions where id=$1 and store_id=$2 for update",[id,store.id]);
      if(!checkoutResult.rowCount) throw new NotFoundException("Checkout not found");
      const checkout=checkoutResult.rows[0];

      if(checkout.status==="completed"&&checkout.completed_order_id){
        const existing=await client.query<any>("select id,order_number,status,payment_status,fulfillment_status,total from orders where id=$1",[checkout.completed_order_id]);
        return {ok:true,idempotent:true,order:existing.rows[0]};
      }
      if(checkout.status!=="open") throw new ConflictException("Checkout is not open");
      if(new Date(checkout.expires_at).getTime()<Date.now()) throw new ConflictException("Checkout has expired");
      if(!checkout.customer_email||!checkout.customer_name||!checkout.customer_phone) throw new BadRequestException("Customer details are required");
      if(!checkout.shipping_address?.line1||!checkout.shipping_address?.city) throw new BadRequestException("Shipping address is required");
      if(!checkout.terms_accepted_at) throw new BadRequestException("Terms acceptance is required");
      if(checkout.payment_method!=="cod") throw new BadRequestException("Payment provider is not connected");

      const prior=await client.query<any>("select id,order_number,status,payment_status,fulfillment_status,total from orders where store_id=$1 and external_id=$2 limit 1",[store.id,"checkout:"+id+":"+idempotencyKey]);
      if(prior.rowCount) return {ok:true,idempotent:true,order:prior.rows[0]};

      const lines=await client.query<any>("select * from checkout_lines where checkout_id=$1 order by id",[id]);
      if(!lines.rowCount) throw new BadRequestException("Checkout has no items");
      const groupedLines=new Map<string,any>();
      for(const line of lines.rows){
        const quantity=Number(line.quantity);
        if(!Number.isInteger(quantity)||quantity<1) throw new ConflictException("Checkout contains an invalid quantity");
        const existing=groupedLines.get(line.variant_id);
        if(existing) existing.quantity=Number(existing.quantity)+quantity;
        else groupedLines.set(line.variant_id,{...line,quantity});
      }

      const locked:any[]=[];
      for(const line of groupedLines.values()){
        const variantResult=await client.query<any>(
          `select v.id,v.sku,v.price,v.cost_amount,v.inventory,v.status,coalesce(v.weight_grams,p.weight_grams,0) as weight_grams,
           p.id as product_id,p.title,p.status as product_status,p.product_type,p.taxable
           from product_variants v join products p on p.id=v.product_id
           where v.id=$1 and p.store_id=$2 for update`,
          [line.variant_id,store.id]
        );
        if(!variantResult.rowCount) throw new ConflictException("A variant no longer exists");
        const variant=variantResult.rows[0];
        if(variant.status!=="active"||variant.product_status!=="active") throw new ConflictException(variant.sku+" is no longer available");
        if(Number(variant.inventory)<Number(line.quantity)) throw new ConflictException(variant.sku+" no longer has enough stock");
        locked.push({line,variant,price:Number(variant.price)});
      }

      const pricingLines:PricingLine[]=locked.map(entry=>({
        productId:entry.variant.product_id,variantId:entry.variant.id,quantity:Number(entry.line.quantity),unitPrice:entry.price,
        lineTotal:entry.price*Number(entry.line.quantity),productType:entry.variant.product_type,taxable:entry.variant.taxable!==false,weightGrams:Number(entry.variant.weight_grams||0),
      }));
      const pricing=await this.pricing.price(store.id,pricingLines,{
        discountCode:checkout.discount_code||null,
        shippingAddress:checkout.shipping_address||{},
        shippingRateId:checkout.shipping_rate_id||null,
      },client);

      const email=String(checkout.customer_email).toLowerCase();
      const customerResult=await client.query<any>(
        `insert into customers(store_id,email,name,phone,attributes,updated_at) values($1,$2,$3,$4,'{}'::jsonb,now())
         on conflict(store_id,lower(email)) where email is not null and trim(email)<>''
         do update set name=excluded.name,phone=excluded.phone,updated_at=now()
         returning id,name,email,phone`,
        [store.id,email,checkout.customer_name,checkout.customer_phone]
      );
      const customer=customerResult.rows[0];

      const numberResult=await client.query<{value:string}>("select 'JS-'||lpad(nextval('jewelry_order_number_seq')::text,6,'0') as value");
      const orderNumber=numberResult.rows[0].value;
      const locationId=await this.defaultLocation(client,store.id);
      const orderResult=await client.query<any>(
        `insert into orders(store_id,customer_id,order_number,status,payment_status,currency,subtotal,total,source_channel,external_id,shipping_address,billing_address,shipping_method,shipping_amount,payment_method,fulfillment_status,is_gift,gift_message,terms_accepted_at,discount_amount,tax_amount,discount_code,location_id)
         values($1,$2,$3,'confirmed','pending',$4,$5,$6,'online_store',$7,$8::jsonb,$9::jsonb,$10,$11,'cod','unfulfilled',$12,$13,$14,$15,$16,$17,$18) returning *`,
        [store.id,customer.id,orderNumber,checkout.currency||store.currency||"PKR",pricing.subtotal,pricing.total,"checkout:"+id+":"+idempotencyKey,JSON.stringify(checkout.shipping_address||{}),JSON.stringify(checkout.billing_address||checkout.shipping_address||{}),pricing.shipping.name||checkout.shipping_method||"standard",pricing.shipping.amount,Boolean(checkout.is_gift),checkout.gift_message||null,checkout.terms_accepted_at,pricing.discount.amount,pricing.tax.amount,pricing.discount.code||checkout.discount_code||null,locationId]
      );
      const order=orderResult.rows[0];

      for(const entry of locked){
        const qty=Number(entry.line.quantity);
        const lineTotal=entry.price*qty;
        const share=pricing.subtotal>0?lineTotal/pricing.subtotal:0;
        const lineDiscount=Math.round(pricing.discount.amount*share*100)/100;
        const lineTax=Math.round(pricing.tax.amount*share*100)/100;
        await client.query(
          `insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,unit_cost,line_total,discount_amount,tax_amount)
           values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)`,
          [order.id,entry.variant.product_id,entry.variant.id,entry.variant.sku,entry.variant.title,JSON.stringify(entry.line.selected_options||{}),qty,entry.price,Number(entry.variant.cost_amount||0),lineTotal,lineDiscount,lineTax]
        );
        await this.deductInventory(client,store.id,locationId,entry.variant.id,qty,order.id,"Order "+orderNumber);
      }

      if(pricing.discount.discountId){
        await client.query("update discounts set usage_count=usage_count+1,updated_at=now() where id=$1",[pricing.discount.discountId]);
        await client.query("insert into discount_redemptions(discount_id,store_id,order_id,customer_id,amount) values($1,$2,$3,$4,$5)",[pricing.discount.discountId,store.id,order.id,customer.id,pricing.discount.amount]);
      }

      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.created',$2,$3::jsonb)",[order.id,"Order "+orderNumber+" created from checkout",JSON.stringify({checkoutId:id,paymentMethod:"cod",isGift:Boolean(checkout.is_gift),pricing,locationId})]);
      await client.query("update checkout_sessions set status='completed',subtotal=$1,discount_amount=$2,shipping_amount=$3,tax_amount=$4,completed_order_id=$5,updated_at=now() where id=$6",[pricing.subtotal,pricing.discount.amount,pricing.shipping.amount,pricing.tax.amount,order.id,id]);
      await this.governance.notify(store.id,{type:"order.created",title:"New online order "+orderNumber,body:checkout.customer_name+" · "+pricing.total+" "+order.currency,severity:"success",resourceType:"order",resourceId:order.id},client);
      await this.governance.enqueueMessage(store.id,{channel:"email",recipient:email,templateKey:"order_confirmation",subject:"Order "+orderNumber+" confirmed",payload:{orderId:order.id,orderNumber,total:pricing.total,currency:order.currency}},client);
      await this.governance.audit(store.id,"order.created","order",order.id,{actor:"checkout",actorType:"customer",after:order,metadata:{checkoutId:id,pricing,locationId}},client);

      return {ok:true,idempotent:false,order:{id:order.id,orderNumber:order.order_number,status:order.status,paymentStatus:order.payment_status,fulfillmentStatus:order.fulfillment_status,total:Number(order.total),currency:order.currency}};
    });
  }
}
