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
        const quantity=Math.max(1,Math.min(25,Number(item.quantity||1)));
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
    return {...checkout.rows[0],subtotal:Number(checkout.rows[0].subtotal),shipping_amount:Number(checkout.rows[0].shipping_amount||0),items:lines.rows.map(line=>({...line,unit_price:Number(line.unit_price),line_total:Number(line.line_total)}))};
  }

  async setCustomer(id:string,body:any){
    const store=await this.store();
    const email=String(body?.email||"").trim().toLowerCase();
    const name=String(body?.name||"").trim();
    const phone=String(body?.phone||"").trim();
    if(!email||!email.includes("@")) throw new BadRequestException("A valid email is required");
    if(!name) throw new BadRequestException("Customer name is required");
    if(!phone) throw new BadRequestException("Phone is required");

    const shipping=this.cleanAddress(body?.shippingAddress);
    if(!shipping.line1||!shipping.city||!shipping.country) throw new BadRequestException("Shipping address is incomplete");
    const billing=body?.billingAddress?this.cleanAddress(body.billingAddress):shipping;
    const paymentMethod=String(body?.paymentMethod||"cod").toLowerCase();
    if(paymentMethod!=="cod") throw new BadRequestException("Only COD is enabled until an online payment provider is connected");

    const shippingMethod=String(body?.shippingMethod||"standard").trim();
    const shippingAmount=0;

    const result=await this.db.query<any>("update checkout_sessions set customer_email=$1,customer_name=$2,customer_phone=$3,shipping_address=$4::jsonb,billing_address=$5::jsonb,shipping_method=$6,shipping_amount=$7,payment_method=$8,updated_at=now() where id=$9 and store_id=$10 and status='open' and expires_at>now() returning id,status,currency,subtotal,shipping_amount,customer_email,customer_name,customer_phone,shipping_address,billing_address,shipping_method,payment_method,expires_at",[email,name,phone,JSON.stringify(shipping),JSON.stringify(billing),shippingMethod,shippingAmount,paymentMethod,id,store.id]);

    if(!result.rowCount) throw new NotFoundException("Open checkout not found");
    return {...result.rows[0],subtotal:Number(result.rows[0].subtotal),shipping_amount:Number(result.rows[0].shipping_amount||0)};
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
      if(checkout.payment_method!=="cod") throw new BadRequestException("Payment provider is not connected");

      const prior=await client.query<any>("select id,order_number,status,payment_status,fulfillment_status,total from orders where store_id=$1 and external_id=$2 limit 1",[store.id,"checkout:"+id+":"+idempotencyKey]);
      if(prior.rowCount) return {ok:true,idempotent:true,order:prior.rows[0]};

      const lines=await client.query<any>("select * from checkout_lines where checkout_id=$1 order by id",[id]);
      if(!lines.rowCount) throw new BadRequestException("Checkout has no items");

      let subtotal=0;
      const locked:any[]=[];
      for(const line of lines.rows){
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
      const customerResult=await client.query<any>("insert into customers(store_id,email,name,phone,attributes) values($1,$2,$3,$4,'{}'::jsonb) on conflict(store_id,lower(email)) where email is not null and email <> '' do update set name=excluded.name,phone=excluded.phone returning id,name,email,phone",[store.id,email,checkout.customer_name,checkout.customer_phone]);
      const customer=customerResult.rows[0];

      const numberResult=await client.query<{value:string}>("select 'JS-'||lpad(nextval('jewelry_order_number_seq')::text,6,'0') as value");
      const orderNumber=numberResult.rows[0].value;
      const total=subtotal+Number(checkout.shipping_amount||0);

      const orderResult=await client.query<any>("insert into orders(store_id,customer_id,order_number,status,payment_status,currency,subtotal,total,source_channel,external_id,shipping_address,billing_address,shipping_method,shipping_amount,payment_method,fulfillment_status) values($1,$2,$3,'confirmed','pending',$4,$5,$6,'online_store',$7,$8::jsonb,$9::jsonb,$10,$11,'cod','unfulfilled') returning *",[store.id,customer.id,orderNumber,checkout.currency||store.currency||"PKR",subtotal,total,"checkout:"+id+":"+idempotencyKey,JSON.stringify(checkout.shipping_address||{}),JSON.stringify(checkout.billing_address||checkout.shipping_address||{}),checkout.shipping_method||"standard",Number(checkout.shipping_amount||0)]);
      const order=orderResult.rows[0];

      for(const entry of locked){
        const before=Number(entry.variant.inventory);
        const after=before-Number(entry.line.quantity);
        await client.query("insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)",[order.id,entry.variant.product_id,entry.variant.id,entry.variant.sku,entry.variant.title,JSON.stringify(entry.line.selected_options||{}),Number(entry.line.quantity),entry.price,entry.price*Number(entry.line.quantity)]);
        await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,entry.variant.id]);
        await client.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_sale',$4,$5,$6,$7,'checkout')",[store.id,entry.variant.id,order.id,-Number(entry.line.quantity),before,after,"Order "+orderNumber]);
      }

      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.created',$2,$3::jsonb)",[order.id,"Order "+orderNumber+" created from checkout",JSON.stringify({checkoutId:id,paymentMethod:"cod"})]);
      await client.query("update checkout_sessions set status='completed',subtotal=$1,completed_order_id=$2,updated_at=now() where id=$3",[subtotal,order.id,id]);

      return {ok:true,idempotent:false,order:{id:order.id,orderNumber:order.order_number,status:order.status,paymentStatus:order.payment_status,fulfillmentStatus:order.fulfillment_status,total:Number(order.total),currency:order.currency}};
    });
  }
}
