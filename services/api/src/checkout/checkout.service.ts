import {BadRequestException,ConflictException,Injectable,NotFoundException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";

type RequestedLine={slug?:string;variantId?:string;quantity?:number};

@Injectable()
export class CheckoutService{
  constructor(private readonly db:DatabaseService){}

  private async store(){
    const domain=process.env.STORE_DOMAIN||"jewelry-store-lime.vercel.app";
    const result=await this.db.query<any>("select id,currency from stores where domain=$1 limit 1",[domain]);
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
        if(item.variantId){
          found=await client.query<any>("select v.id as variant_id,v.sku,v.price,v.inventory,p.id as product_id,p.handle,p.title,coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 and p.status='active' and v.status='active' limit 1",[item.variantId,store.id]);
        }else{
          found=await client.query<any>("select v.id as variant_id,v.sku,v.price,v.inventory,p.id as product_id,p.handle,p.title,coalesce((select jsonb_object_agg(o.name,ov.value) from variant_option_values vv join product_option_values ov on ov.id=vv.option_value_id join product_options o on o.id=ov.option_id where vv.variant_id=v.id),'{}'::jsonb) as selected_options from products p join product_variants v on v.product_id=p.id where p.store_id=$1 and p.handle=$2 and p.status='active' and v.status='active' order by v.created_at limit 1",[store.id,item.slug]);
        }
        const variant=found.rows[0];
        if(!variant) throw new BadRequestException("A cart item is no longer available");
        if(Number(variant.inventory)<quantity) throw new BadRequestException(variant.sku+" has only "+variant.inventory+" item(s) available");
        const unitPrice=Number(variant.price);
        priced.push({...variant,quantity,unitPrice,lineTotal:unitPrice*quantity});
      }

      const subtotal=priced.reduce((sum,line)=>sum+line.lineTotal,0);
      const checkout=await client.query<any>("insert into checkout_sessions(store_id,status,currency,subtotal,payment_method) values($1,'open',$2,$3,'cod') returning id,status,currency,subtotal,expires_at,created_at",[store.id,store.currency||"PKR",subtotal]);

      for(const line of priced){
        await client.query("insert into checkout_lines(checkout_id,product_id,variant_id,sku_snapshot,title_snapshot,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)",[checkout.rows[0].id,line.product_id,line.variant_id,line.sku,line.title,JSON.stringify(line.selected_options||{}),line.quantity,line.unitPrice,line.lineTotal]);
      }

      return {...checkout.rows[0],subtotal:Number(checkout.rows[0].subtotal),items:priced.map(line=>({productId:line.product_id,variantId:line.variant_id,slug:line.handle,title:line.title,sku:line.sku,selectedOptions:line.selected_options||{},quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal}))};
    });
  }

  async detail(id:string){
    const store=await this.store();
    const checkout=await this.db.query<any>("select * from checkout_sessions where id=$1 and store_id=$2 limit 1",[id,store.id]);
    if(!checkout.rowCount) throw new NotFoundException("Checkout not found");
    const lines=await this.db.query<any>("select id,product_id,variant_id,sku_snapshot,title_snapshot,selected_options,quantity,unit_price,line_total from checkout_lines where checkout_id=$1 order by id",[id]);
    const row=checkout.rows[0];
    return {
      id:row.id,
      status:row.status,
      currency:row.currency,
      subtotal:Number(row.subtotal),
      discount_code:row.discount_code||null,
      discount_amount:Number(row.discount_amount||0),
      shipping_amount:Number(row.shipping_amount||0),
      tax_amount:Number(row.tax_amount||0),
      inclusive_tax_amount:Number(row.inclusive_tax_amount||0),
      exclusive_tax_amount:Number(row.exclusive_tax_amount||0),
      total:Number(row.total??(Number(row.subtotal||0)-Number(row.discount_amount||0)+Number(row.shipping_amount||0)+Number(row.exclusive_tax_amount||0))),
      payment_method:row.payment_method,
      expires_at:row.expires_at,
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

    const shippingMethod=String(body?.shippingMethod||"standard").trim();

    const checkoutState=await this.db.query<any>("select subtotal from checkout_sessions where id=$1 and store_id=$2 and status='open' and expires_at>now() limit 1",[id,store.id]);
    if(!checkoutState.rowCount) throw new NotFoundException("Open checkout not found");
    const subtotal=Number(checkoutState.rows[0].subtotal||0);

    const weightResult=await this.db.query<any>("select coalesce(sum(cl.quantity*coalesce(v.weight_grams,p.weight_grams,0)),0)::int weight from checkout_lines cl join product_variants v on v.id=cl.variant_id join products p on p.id=cl.product_id where cl.checkout_id=$1",[id]);
    const weight=Number(weightResult.rows[0]?.weight||0);

    const zone=await this.db.query<any>("select z.id from shipping_zones z where z.store_id=$1 and z.active=true and (cardinality(z.countries)=0 or $2=any(z.countries)) and (cardinality(z.regions)=0 or $3=any(z.regions)) and (cardinality(z.cities)=0 or $4=any(z.cities)) order by z.created_at limit 1",[store.id,shipping.country,shipping.region,shipping.city]);
    let shippingAmount=0;
    if(zone.rowCount){
      const rates=await this.db.query<any>("select * from shipping_rates where zone_id=$1 and active=true order by created_at",[zone.rows[0].id]);
      const selected=rates.rows.find((r:any)=>(r.minimum_order===null||subtotal>=Number(r.minimum_order))&&(r.maximum_order===null||subtotal<=Number(r.maximum_order))&&(r.minimum_weight_grams===null||weight>=Number(r.minimum_weight_grams))&&(r.maximum_weight_grams===null||weight<=Number(r.maximum_weight_grams)));
      if(selected) shippingAmount=selected.rate_type==="free"?0:Number(selected.amount||0);
    }

    let discountRow:any=null;
    const requestedCode=String(body?.discountCode||"").trim().toUpperCase();
    if(requestedCode){
      const d=await this.db.query<any>("select * from discount_codes where store_id=$1 and code=$2 and active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) limit 1",[store.id,requestedCode]);
      discountRow=d.rows[0]||null;
      if(!discountRow) throw new BadRequestException("Discount code is invalid or expired");
    }else{
      const d=await this.db.query<any>("select * from discount_codes where store_id=$1 and active=true and automatic=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) order by created_at limit 1",[store.id]);
      discountRow=d.rows[0]||null;
    }

    let discountAmount=0;
    if(discountRow){
      if(discountRow.minimum_order!==null&&subtotal<Number(discountRow.minimum_order)) {
        if(requestedCode) throw new BadRequestException("Minimum order not met for discount");
        discountRow=null;
      } else if(discountRow.usage_limit!==null&&Number(discountRow.usage_count)>=Number(discountRow.usage_limit)) {
        if(requestedCode) throw new BadRequestException("Discount usage limit reached");
        discountRow=null;
      }
    }
    if(discountRow){
      let eligibleSubtotal=subtotal;
      if(discountRow.applies_to==="product"&&Array.isArray(discountRow.product_ids)&&discountRow.product_ids.length){
        const e=await this.db.query<any>("select coalesce(sum(line_total),0) amount from checkout_lines where checkout_id=$1 and product_id=any($2::uuid[])",[id,discountRow.product_ids]);
        eligibleSubtotal=Number(e.rows[0]?.amount||0);
      }else if(discountRow.applies_to==="collection"&&Array.isArray(discountRow.collection_ids)&&discountRow.collection_ids.length){
        const e=await this.db.query<any>("select coalesce(sum(cl.line_total),0) amount from checkout_lines cl where cl.checkout_id=$1 and exists(select 1 from collection_products cp where cp.product_id=cl.product_id and cp.collection_id=any($2::uuid[]))",[id,discountRow.collection_ids]);
        eligibleSubtotal=Number(e.rows[0]?.amount||0);
      }
      discountAmount=discountRow.kind==="percentage"?eligibleSubtotal*Math.min(100,Number(discountRow.value))/100:discountRow.kind==="fixed"?Math.min(eligibleSubtotal,Number(discountRow.value)):0;
      if(discountRow.kind==="free_shipping") shippingAmount=0;
    }

    const taxable=await this.db.query<any>("select coalesce(sum(cl.line_total),0) amount from checkout_lines cl join products p on p.id=cl.product_id where cl.checkout_id=$1 and p.taxable=true",[id]);
    let taxableBase=Math.max(0,Number(taxable.rows[0]?.amount||0)-discountAmount);
    const taxRules=await this.db.query<any>("select * from tax_rules where store_id=$1 and active=true and (country is null or country='' or country=$2) and (region is null or region='' or region=$3) order by priority,created_at",[store.id,shipping.country,shipping.region]);
    let taxAmount=0;
    let inclusiveTaxAmount=0;
    let exclusiveTaxAmount=0;
    for(const rule of taxRules.rows){
      const rate=Number(rule.rate||0);
      if(rule.inclusive){
        const amount=taxableBase*rate/(1+rate);
        taxAmount+=amount;
        inclusiveTaxAmount+=amount;
      }else{
        const amount=taxableBase*rate;
        taxAmount+=amount;
        exclusiveTaxAmount+=amount;
      }
    }
    taxAmount=Math.round(taxAmount*100)/100;
    inclusiveTaxAmount=Math.round(inclusiveTaxAmount*100)/100;
    exclusiveTaxAmount=Math.round(exclusiveTaxAmount*100)/100;
    const total=Math.max(0,subtotal-discountAmount+shippingAmount+exclusiveTaxAmount);
    const isGift=Boolean(body?.isGift);
    const giftMessage=isGift?String(body?.giftMessage||"").trim().slice(0,500):null;

    const result=await this.db.query<any>(
      "update checkout_sessions set customer_email=$1,customer_name=$2,customer_phone=$3,shipping_address=$4::jsonb,billing_address=$5::jsonb,shipping_method=$6,shipping_amount=$7,payment_method=$8,is_gift=$9,gift_message=$10,terms_accepted_at=now(),discount_code=$11,discount_amount=$12,tax_amount=$13,inclusive_tax_amount=$14,exclusive_tax_amount=$15,total=$16,updated_at=now() where id=$17 and store_id=$18 and status='open' and expires_at>now() returning id,status,currency,subtotal,discount_code,discount_amount,shipping_amount,tax_amount,inclusive_tax_amount,exclusive_tax_amount,total,customer_email,customer_name,customer_phone,shipping_address,billing_address,shipping_method,payment_method,is_gift,gift_message,terms_accepted_at,expires_at",
      [email,name,phone,JSON.stringify(shipping),JSON.stringify(billing),shippingMethod,shippingAmount,paymentMethod,isGift,giftMessage,discountRow?.code||null,discountAmount,taxAmount,inclusiveTaxAmount,exclusiveTaxAmount,total,id,store.id]
    );

    if(!result.rowCount) throw new NotFoundException("Open checkout not found");
    return {...result.rows[0],subtotal:Number(result.rows[0].subtotal),discount_amount:Number(result.rows[0].discount_amount||0),shipping_amount:Number(result.rows[0].shipping_amount||0),tax_amount:Number(result.rows[0].tax_amount||0),inclusive_tax_amount:Number(result.rows[0].inclusive_tax_amount||0),exclusive_tax_amount:Number(result.rows[0].exclusive_tax_amount||0),total:Number(result.rows[0].total||0)};
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
        if(existing){
          existing.quantity=Number(existing.quantity)+quantity;
          existing.line_total=Number(existing.line_total)+Number(line.line_total||0);
        }else{
          groupedLines.set(line.variant_id,{...line,quantity});
        }
      }

      let subtotal=0;
      const locked:any[]=[];
      for(const line of groupedLines.values()){
        const variantResult=await client.query<any>("select v.id,v.sku,v.price,v.inventory,v.status,p.id as product_id,p.title,p.status as product_status from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[line.variant_id,store.id]);
        if(!variantResult.rowCount) throw new ConflictException("A variant no longer exists");
        const variant=variantResult.rows[0];
        if(variant.status!=="active"||variant.product_status!=="active") throw new ConflictException(variant.sku+" is no longer available");
        if(Number(variant.inventory)<Number(line.quantity)) throw new ConflictException(variant.sku+" no longer has enough stock");
        const price=Number(variant.price);
        subtotal+=price*Number(line.quantity);
        locked.push({line,variant,price});
      }

      const email=String(checkout.customer_email).toLowerCase();
      const customerResult=await client.query<any>(
        "insert into customers(store_id,email,name,phone,attributes) values($1,$2,$3,$4,'{}'::jsonb) on conflict(store_id,lower(email)) where email is not null and trim(email)<>'' do update set name=excluded.name,phone=excluded.phone returning id,name,email,phone",
        [store.id,email,checkout.customer_name,checkout.customer_phone]
      );
      const customer=customerResult.rows[0];

      const numberResult=await client.query<{value:string}>("select 'JS-'||lpad(nextval('jewelry_order_number_seq')::text,6,'0') as value");
      const orderNumber=numberResult.rows[0].value;
      const discountAmount=Number(checkout.discount_amount||0);
      const shippingAmount=Number(checkout.shipping_amount||0);
      const taxAmount=Number(checkout.tax_amount||0);
      const inclusiveTaxAmount=Number(checkout.inclusive_tax_amount||0);
      const exclusiveTaxAmount=Number(checkout.exclusive_tax_amount||0);
      const total=Number(checkout.total??Math.max(0,subtotal-discountAmount+shippingAmount+exclusiveTaxAmount));

      const orderResult=await client.query<any>(
        "insert into orders(store_id,customer_id,order_number,status,payment_status,currency,subtotal,discount_amount,shipping_amount,tax_amount,inclusive_tax_amount,exclusive_tax_amount,total,source_channel,external_id,shipping_address,billing_address,shipping_method,payment_method,fulfillment_status,is_gift,gift_message,terms_accepted_at,discount_code) values($1,$2,$3,'confirmed','pending',$4,$5,$6,$7,$8,$9,$10,$11,'online_store',$12,$13::jsonb,$14::jsonb,$15,'cod','unfulfilled',$16,$17,$18,$19) returning *",
        [store.id,customer.id,orderNumber,checkout.currency||store.currency||"PKR",subtotal,discountAmount,shippingAmount,taxAmount,inclusiveTaxAmount,exclusiveTaxAmount,total,"checkout:"+id+":"+idempotencyKey,JSON.stringify(checkout.shipping_address||{}),JSON.stringify(checkout.billing_address||checkout.shipping_address||{}),checkout.shipping_method||"standard",Boolean(checkout.is_gift),checkout.gift_message||null,checkout.terms_accepted_at,checkout.discount_code||null]
      );
      const order=orderResult.rows[0];

      for(const entry of locked){
        const before=Number(entry.variant.inventory);
        const after=before-Number(entry.line.quantity);
        await client.query("insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)",[order.id,entry.variant.product_id,entry.variant.id,entry.variant.sku,entry.variant.title,JSON.stringify(entry.line.selected_options||{}),Number(entry.line.quantity),entry.price,entry.price*Number(entry.line.quantity)]);
        await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,entry.variant.id]);
        await client.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_sale',$4,$5,$6,$7,'checkout')",[store.id,entry.variant.id,order.id,-Number(entry.line.quantity),before,after,"Order "+orderNumber]);
        if(after<=3){
          await client.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'low_stock','warning',$2,$3,'variant',$4)",[store.id,"Low stock: "+entry.variant.sku,entry.variant.sku+" has "+after+" unit(s) remaining",entry.variant.id]);
        }
      }

      if(checkout.discount_code){
        const d=await client.query<any>("select id from discount_codes where store_id=$1 and code=$2 for update",[store.id,checkout.discount_code]);
        if(d.rowCount){
          await client.query("update discount_codes set usage_count=usage_count+1 where id=$1",[d.rows[0].id]);
          await client.query("insert into discount_redemptions(discount_id,order_id,customer_id,amount) values($1,$2,$3,$4)",[d.rows[0].id,order.id,customer.id,discountAmount]);
        }
      }
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.created',$2,$3::jsonb)",[order.id,"Order "+orderNumber+" created from checkout",JSON.stringify({checkoutId:id,paymentMethod:"cod",isGift:Boolean(checkout.is_gift),discountCode:checkout.discount_code||null})]);
      await client.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'new_order','info',$2,$3,'order',$4)",[store.id,"New order "+orderNumber,"New storefront order for "+order.currency+" "+Number(order.total).toLocaleString(),order.id]);
      await client.query("insert into message_outbox(store_id,channel,template_key,recipient,subject,payload,status) values($1,'email','order_confirmation',$2,$3,$4::jsonb,'queued')",[store.id,email,"Order "+orderNumber+" confirmation",JSON.stringify({orderId:order.id,orderNumber,total:Number(order.total),currency:order.currency,name:checkout.customer_name})]);
      await client.query("update checkout_sessions set status='completed',subtotal=$1,completed_order_id=$2,updated_at=now() where id=$3",[subtotal,order.id,id]);

      return {ok:true,idempotent:false,order:{id:order.id,orderNumber:order.order_number,status:order.status,paymentStatus:order.payment_status,fulfillmentStatus:order.fulfillment_status,total:Number(order.total),currency:order.currency}};
    });
  }
}
