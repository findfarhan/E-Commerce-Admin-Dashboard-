import {BadRequestException,ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from "@nestjs/common";
import {DatabaseService} from "../database/database.service";
import {CollectionsService} from "../collections/collections.service";
import {BundlesService} from "../bundles/bundles.service";

type RequestedLine={slug?:string;variantId?:string;quantity?:number};

@Injectable()
export class CheckoutService{
  constructor(private readonly db:DatabaseService,private readonly collections:CollectionsService,private readonly bundles:BundlesService){}

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
    const requestedBundles=Array.isArray(body?.bundles)?body.bundles as Array<{bundleId:string;quantity:number}>:[];
    if(!requested.length&&!requestedBundles.length) throw new BadRequestException("At least one cart item is required");
    if(requested.length+requestedBundles.length>50) throw new BadRequestException("Too many cart lines");
    const store=await this.store();

    return this.db.transaction(async client=>{
      const bundleTablesReady=await this.bundles.schemaReady(client);
      if(requestedBundles.length&&!bundleTablesReady)throw new ServiceUnavailableException("Jewelry sets are temporarily unavailable");
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

      const bundleAllocations:Array<Awaited<ReturnType<BundlesService["purchase"]>>>=[];
      for(const request of requestedBundles){
        const bundle=await this.bundles.purchase(client,store.id,String(request.bundleId||""),Number(request.quantity));
        bundleAllocations.push(bundle);
        for(const component of bundle.components){
          const quantity=component.quantity*bundle.quantity;
          if(quantity>25) throw new BadRequestException("Bundle component quantity cannot exceed 25 units per checkout");
          priced.push({
            variant_id:component.variant_id,
            sku:component.sku,price:component.price,inventory:component.inventory,
            product_id:component.product_id,handle:component.handle,
            title:component.title,selected_options:component.selected_options||{},
            quantity,unitPrice:Number(component.price),lineTotal:Number(component.price)*quantity
          });
        }
      }

      // The same variant can appear in multiple cart lines. Validate aggregate
      // quantity before opening a session, not only line-by-line stock.
      const quantities=new Map<string,{quantity:number;inventory:number;sku:string}>();
      for(const line of priced){
        const previous=quantities.get(String(line.variant_id));
        quantities.set(String(line.variant_id),{
          quantity:(previous?.quantity||0)+Number(line.quantity),
          inventory:Number(line.inventory),
          sku:String(line.sku),
        });
      }
      for(const entry of quantities.values()){
        if(entry.quantity>entry.inventory) throw new BadRequestException(entry.sku+" has only "+entry.inventory+" item(s) available");
      }

      const subtotal=priced.reduce((sum,line)=>sum+line.lineTotal,0);
      const bundleDiscount=bundleAllocations.reduce((sum,bundle)=>sum+bundle.discountAmount,0);
      const checkout=bundleTablesReady
        ?await client.query<any>("insert into checkout_sessions(store_id,status,currency,subtotal,payment_method,discount_amount,bundle_discount_amount,total) values($1,'open',$2,$3,'cod',$4,$4,$5) returning id,status,currency,subtotal,discount_amount,bundle_discount_amount,total,expires_at,created_at",[store.id,store.currency||"PKR",subtotal,bundleDiscount,Math.max(0,subtotal-bundleDiscount)])
        :await client.query<any>("insert into checkout_sessions(store_id,status,currency,subtotal,payment_method) values($1,'open',$2,$3,'cod') returning id,status,currency,subtotal,expires_at,created_at",[store.id,store.currency||"PKR",subtotal]);

      for(const line of priced){
        await client.query("insert into checkout_lines(checkout_id,product_id,variant_id,sku_snapshot,title_snapshot,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)",[checkout.rows[0].id,line.product_id,line.variant_id,line.sku,line.title,JSON.stringify(line.selected_options||{}),line.quantity,line.unitPrice,line.lineTotal]);
      }

      for(const bundle of bundleAllocations){
        await client.query("insert into checkout_bundle_allocations(checkout_id,bundle_id,quantity,title_snapshot,component_snapshot,gross_amount,discount_amount) values($1,$2,$3,$4,$5::jsonb,$6,$7)",[checkout.rows[0].id,bundle.bundleId,bundle.quantity,bundle.title,JSON.stringify(bundle.snapshot),bundle.grossAmount,bundle.discountAmount]);
      }
      return {...checkout.rows[0],subtotal:Number(checkout.rows[0].subtotal),items:priced.map(line=>({productId:line.product_id,variantId:line.variant_id,slug:line.handle,title:line.title,sku:line.sku,selectedOptions:line.selected_options||{},quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal}))};
    });
  }

  async detail(id:string){
    const store=await this.store();
    const checkout=await this.db.query<any>("select * from checkout_sessions where id=$1 and store_id=$2 limit 1",[id,store.id]);
    if(!checkout.rowCount) throw new NotFoundException("Checkout not found");
    const lines=await this.db.query<any>("select id,product_id,variant_id,sku_snapshot,title_snapshot,selected_options,quantity,unit_price,line_total from checkout_lines where checkout_id=$1 order by id",[id]);
    const bundleRows=await this.bundles.schemaReady()
      ?await this.db.query<any>("select title_snapshot,quantity,gross_amount,discount_amount,component_snapshot from checkout_bundle_allocations where checkout_id=$1 order by created_at,id",[id])
      :{rows:[] as any[]};
    const row=checkout.rows[0];
    // A completed checkout may be reopened via its saved URL. Only expose
    // non-sensitive order confirmation fields; never customer details here.
    let completedOrder:{orderNumber:string;total:number}|null=null;
    if(row.status==="completed"&&row.completed_order_id){
      const placed=await this.db.query<{order_number:string;total:string}>(
        "select order_number,total from orders where id=$1 and store_id=$2 limit 1",
        [row.completed_order_id,store.id]
      );
      if(placed.rowCount){
        completedOrder={orderNumber:placed.rows[0].order_number,total:Number(placed.rows[0].total)};
      }
    }
    return {
      id:row.id,
      status:row.status,
      completed_order:completedOrder,
      currency:row.currency,
      subtotal:Number(row.subtotal),
      discount_code:row.discount_code||null,
      discount_amount:Number(row.discount_amount||0),
      bundle_discount_amount:Number(row.bundle_discount_amount||0),
      bundles:bundleRows.rows.map((b:any)=>({title:b.title_snapshot,quantity:Number(b.quantity),regularPrice:Number(b.gross_amount),saving:Number(b.discount_amount),components:b.component_snapshot})),
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

    let shippingMethod=String(body?.shippingMethod||"standard").trim();

    return this.db.transaction(async client=>{
    const checkoutState=await client.query<any>("select subtotal from checkout_sessions where id=$1 and store_id=$2 and status='open' and expires_at>now() limit 1 for update",[id,store.id]);
    if(!checkoutState.rowCount) throw new NotFoundException("Open checkout not found");
    const subtotal=Number(checkoutState.rows[0].subtotal||0);
    const bundleQuote=await this.bundles.checkoutDiscount(client,store.id,id);
    if(bundleQuote.bundleCount&&String(body?.discountCode||"").trim())throw new BadRequestException("Coupon codes cannot be combined with bundle offers");

    const weightResult=await client.query<any>("select coalesce(sum(cl.quantity*coalesce(v.weight_grams,p.weight_grams,0)),0)::int weight from checkout_lines cl join product_variants v on v.id=cl.variant_id join products p on p.id=cl.product_id where cl.checkout_id=$1",[id]);
    const weight=Number(weightResult.rows[0]?.weight||0);

    const zoneCount=await client.query<any>("select count(*)::int as count from shipping_zones where store_id=$1 and active=true",[store.id]);
    const zone=await client.query<any>("select z.id,z.name from shipping_zones z where z.store_id=$1 and z.active=true and (cardinality(z.countries)=0 or $2=any(z.countries)) and (cardinality(z.regions)=0 or $3=any(z.regions)) and (cardinality(z.cities)=0 or $4=any(z.cities)) order by ((cardinality(z.cities)>0)::int*4+(cardinality(z.regions)>0)::int*2+(cardinality(z.countries)>0)::int) desc,z.created_at limit 1",[store.id,shipping.country,shipping.region,shipping.city]);
    if(Number(zoneCount.rows[0]?.count||0)>0&&!zone.rowCount) throw new BadRequestException("Delivery is not available for this address");
    let shippingAmount=0;
    if(zone.rowCount){
      const rates=await client.query<any>("select * from shipping_rates where zone_id=$1 and active=true order by created_at",[zone.rows[0].id]);
      const eligible=rates.rows.filter((r:any)=>(r.minimum_order===null||subtotal>=Number(r.minimum_order))&&(r.maximum_order===null||subtotal<=Number(r.maximum_order))&&(r.minimum_weight_grams===null||weight>=Number(r.minimum_weight_grams))&&(r.maximum_weight_grams===null||weight<=Number(r.maximum_weight_grams)));
      if(!eligible.length) throw new BadRequestException("No shipping rate is available for this order");
      const requested=shippingMethod.toLowerCase();
      const selected=eligible.find((r:any)=>String(r.service_code||"").toLowerCase()===requested||String(r.name||"").toLowerCase()===requested)||eligible[0];
      shippingMethod=String(selected.service_code||selected.name||shippingMethod);
      shippingAmount=selected.rate_type==="free"?0:Number(selected.amount||0);
    }

    let discountRow:any=null;
    const requestedCode=String(body?.discountCode||"").trim().toUpperCase();
    if(requestedCode){
      const d=await client.query<any>("select * from discount_codes where store_id=$1 and code=$2 and active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) limit 1",[store.id,requestedCode]);
      discountRow=d.rows[0]||null;
      if(!discountRow) throw new BadRequestException("Discount code is invalid or expired");
    }else if(!bundleQuote.bundleCount){
      const d=await client.query<any>("select * from discount_codes where store_id=$1 and active=true and automatic=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) order by created_at limit 1",[store.id]);
      discountRow=d.rows[0]||null;
    }

    let discountAmount=bundleQuote.discount;
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
        const e=await client.query<any>("select coalesce(sum(line_total),0) amount from checkout_lines where checkout_id=$1 and product_id=any($2::uuid[])",[id,discountRow.product_ids]);
        eligibleSubtotal=Number(e.rows[0]?.amount||0);
      }else if(discountRow.applies_to==="collection"&&Array.isArray(discountRow.collection_ids)&&discountRow.collection_ids.length){
        const cart=await client.query<any>("select product_id,line_total from checkout_lines where checkout_id=$1",[id]);
        const productIds=[...new Set(cart.rows.map((x:any)=>String(x.product_id)))];
        const matched=await this.collections.productIdsForCollections(discountRow.collection_ids,productIds,client);
        const allowed=new Set(matched.map(String));
        eligibleSubtotal=cart.rows.filter((x:any)=>allowed.has(String(x.product_id))).reduce((sum:number,x:any)=>sum+Number(x.line_total||0),0);
      }
      discountAmount=discountRow.kind==="percentage"?eligibleSubtotal*Math.min(100,Number(discountRow.value))/100:discountRow.kind==="fixed"?Math.min(eligibleSubtotal,Number(discountRow.value)):0;
      discountAmount=Math.round(Math.max(0,discountAmount)*100)/100;
      if(discountRow.kind==="free_shipping") shippingAmount=0;
    }

    const taxable=await client.query<any>("select coalesce(sum(cl.line_total),0) amount from checkout_lines cl join products p on p.id=cl.product_id where cl.checkout_id=$1 and p.taxable=true",[id]);
    const taxableSubtotal=Number(taxable.rows[0]?.amount||0);
    const taxableDiscount=bundleQuote.bundleCount
      ?bundleQuote.taxableDiscount
      :(subtotal>0?discountAmount*(taxableSubtotal/subtotal):0);
    let taxableBase=Math.max(0,taxableSubtotal-taxableDiscount);
    const taxRules=await client.query<any>("select * from tax_rules where store_id=$1 and active=true and (country is null or country='' or country=$2) and (region is null or region='' or region=$3) order by priority,created_at",[store.id,shipping.country,shipping.region]);
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

    const result=await client.query<any>(
      "update checkout_sessions set customer_email=$1,customer_name=$2,customer_phone=$3,shipping_address=$4::jsonb,billing_address=$5::jsonb,shipping_method=$6,shipping_amount=$7,payment_method=$8,is_gift=$9,gift_message=$10,terms_accepted_at=now(),discount_code=$11,discount_amount=$12,tax_amount=$13,inclusive_tax_amount=$14,exclusive_tax_amount=$15,total=$16,bundle_discount_amount=$19,updated_at=now() where id=$17 and store_id=$18 and status='open' and expires_at>now() returning id,status,currency,subtotal,discount_code,discount_amount,bundle_discount_amount,shipping_amount,tax_amount,inclusive_tax_amount,exclusive_tax_amount,total,customer_email,customer_name,customer_phone,shipping_address,billing_address,shipping_method,payment_method,is_gift,gift_message,terms_accepted_at,expires_at",
      [email,name,phone,JSON.stringify(shipping),JSON.stringify(billing),shippingMethod,shippingAmount,paymentMethod,isGift,giftMessage,discountRow?.code||null,discountAmount,taxAmount,inclusiveTaxAmount,exclusiveTaxAmount,total,id,store.id,bundleQuote.discount]
    );

    if(!result.rowCount) throw new NotFoundException("Open checkout not found");
    return {...result.rows[0],subtotal:Number(result.rows[0].subtotal),discount_amount:Number(result.rows[0].discount_amount||0),shipping_amount:Number(result.rows[0].shipping_amount||0),tax_amount:Number(result.rows[0].tax_amount||0),inclusive_tax_amount:Number(result.rows[0].inclusive_tax_amount||0),exclusive_tax_amount:Number(result.rows[0].exclusive_tax_amount||0),total:Number(result.rows[0].total||0)};
    });
  }

  async complete(id:string,idempotencyKey?:string,body?:{expectedTotal?:number}){
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
      // Consistent lock order prevents intersecting bundle/standalone purchases
      // from acquiring SKU locks in opposite order.
      for(const line of [...groupedLines.values()].sort((a:any,b:any)=>String(a.variant_id).localeCompare(String(b.variant_id)))){
        const variantResult=await client.query<any>("select v.id,v.sku,v.price,v.inventory,v.status,v.weight_grams,p.id as product_id,p.title,p.status as product_status,p.taxable,p.weight_grams as product_weight_grams from product_variants v join products p on p.id=v.product_id where v.id=$1 and p.store_id=$2 for update",[line.variant_id,store.id]);
        if(!variantResult.rowCount) throw new ConflictException("A variant no longer exists");
        const variant=variantResult.rows[0];
        if(variant.status!=="active"||variant.product_status!=="active") throw new ConflictException(variant.sku+" is no longer available");
        if(Number(variant.inventory)<Number(line.quantity)) throw new ConflictException(variant.sku+" no longer has enough stock");
        const price=Number(variant.price);
        subtotal+=price*Number(line.quantity);
        locked.push({line,variant,price,lineTotal:price*Number(line.quantity)});
      }

      const locations=await client.query<any>("select id,name from locations where store_id=$1 and active=true order by is_default desc,created_at",[store.id]);
      let fulfillmentLocationId:string|null=null;
      for(const location of locations.rows){
        let canFulfill=true;
        for(const entry of locked){
          const level=await client.query<any>("select on_hand from inventory_levels where location_id=$1 and variant_id=$2 for update",[location.id,entry.variant.id]);
          if(!level.rowCount||Number(level.rows[0].on_hand)<Number(entry.line.quantity)){canFulfill=false;break;}
        }
        if(canFulfill){fulfillmentLocationId=location.id;break;}
      }
      if(locations.rowCount&&!fulfillmentLocationId) throw new ConflictException("No fulfillment location has enough stock for the complete order");

      const shippingAddress=checkout.shipping_address||{};
      const totalWeight=locked.reduce((sum:number,entry:any)=>sum+Number(entry.line.quantity)*Number(entry.variant.weight_grams??entry.variant.product_weight_grams??0),0);
      const zoneCount=await client.query<any>("select count(*)::int as count from shipping_zones where store_id=$1 and active=true",[store.id]);
      const zone=await client.query<any>("select z.id,z.name from shipping_zones z where z.store_id=$1 and z.active=true and (cardinality(z.countries)=0 or $2=any(z.countries)) and (cardinality(z.regions)=0 or $3=any(z.regions)) and (cardinality(z.cities)=0 or $4=any(z.cities)) order by ((cardinality(z.cities)>0)::int*4+(cardinality(z.regions)>0)::int*2+(cardinality(z.countries)>0)::int) desc,z.created_at limit 1",[store.id,String(shippingAddress.country||"Pakistan"),String(shippingAddress.region||""),String(shippingAddress.city||"")]);
      if(Number(zoneCount.rows[0]?.count||0)>0&&!zone.rowCount) throw new ConflictException("Delivery is no longer available for this address");
      let finalShippingMethod=String(checkout.shipping_method||"standard");
      let shippingAmount=0;
      if(zone.rowCount){
        const rates=await client.query<any>("select * from shipping_rates where zone_id=$1 and active=true order by created_at",[zone.rows[0].id]);
        const eligible=rates.rows.filter((r:any)=>(r.minimum_order===null||subtotal>=Number(r.minimum_order))&&(r.maximum_order===null||subtotal<=Number(r.maximum_order))&&(r.minimum_weight_grams===null||totalWeight>=Number(r.minimum_weight_grams))&&(r.maximum_weight_grams===null||totalWeight<=Number(r.maximum_weight_grams)));
        if(!eligible.length) throw new ConflictException("No shipping rate is currently available for this order");
        const requested=finalShippingMethod.toLowerCase();
        const selected=eligible.find((r:any)=>String(r.service_code||"").toLowerCase()===requested||String(r.name||"").toLowerCase()===requested)||eligible[0];
        finalShippingMethod=String(selected.service_code||selected.name||finalShippingMethod);
        shippingAmount=selected.rate_type==="free"?0:Number(selected.amount||0);
      }

      const bundleQuote=await this.bundles.checkoutDiscount(client,store.id,id);
      if(bundleQuote.bundleCount&&checkout.discount_code)throw new ConflictException("Bundle offers cannot be combined with coupons");
      let discountRow:any=null;
      let discountAmount=bundleQuote.discount;
      if(checkout.discount_code){
        const discountResult=await client.query<any>("select * from discount_codes where store_id=$1 and code=$2 for update",[store.id,String(checkout.discount_code).toUpperCase()]);
        discountRow=discountResult.rows[0]||null;
        if(!discountRow||discountRow.active!==true||(discountRow.starts_at&&new Date(discountRow.starts_at)>new Date())||(discountRow.ends_at&&new Date(discountRow.ends_at)<new Date())) throw new ConflictException("Discount is no longer available; refresh checkout");
        if(discountRow.minimum_order!==null&&subtotal<Number(discountRow.minimum_order)) throw new ConflictException("Order no longer meets the discount minimum");
        if(discountRow.usage_limit!==null&&Number(discountRow.usage_count)>=Number(discountRow.usage_limit)) throw new ConflictException("Discount usage limit has been reached");
        let eligibleSubtotal=subtotal;
        if(discountRow.applies_to==="product"&&Array.isArray(discountRow.product_ids)&&discountRow.product_ids.length){
          const allowed=new Set(discountRow.product_ids.map(String));
          eligibleSubtotal=locked.filter((x:any)=>allowed.has(String(x.variant.product_id))).reduce((sum:number,x:any)=>sum+Number(x.lineTotal),0);
        }else if(discountRow.applies_to==="collection"&&Array.isArray(discountRow.collection_ids)&&discountRow.collection_ids.length){
          const productIds=[...new Set(locked.map((x:any)=>String(x.variant.product_id)))];
          const matched=await this.collections.productIdsForCollections(discountRow.collection_ids,productIds,client);
          const allowed=new Set(matched.map(String));
          eligibleSubtotal=locked.filter((x:any)=>allowed.has(String(x.variant.product_id))).reduce((sum:number,x:any)=>sum+Number(x.lineTotal),0);
        }
        discountAmount=discountRow.kind==="percentage"?eligibleSubtotal*Math.min(100,Number(discountRow.value))/100:discountRow.kind==="fixed"?Math.min(eligibleSubtotal,Number(discountRow.value)):0;
        discountAmount=Math.round(Math.max(0,discountAmount)*100)/100;
        if(discountRow.kind==="free_shipping") shippingAmount=0;
      }

      const taxableSubtotal=locked.filter((x:any)=>x.variant.taxable!==false).reduce((sum:number,x:any)=>sum+Number(x.lineTotal),0);
      const taxableDiscount=bundleQuote.bundleCount
      ?bundleQuote.taxableDiscount
      :(subtotal>0?discountAmount*(taxableSubtotal/subtotal):0);
      const taxableBase=Math.max(0,taxableSubtotal-taxableDiscount);
      const taxRules=await client.query<any>("select * from tax_rules where store_id=$1 and active=true and (country is null or country='' or country=$2) and (region is null or region='' or region=$3) order by priority,created_at",[store.id,String(shippingAddress.country||"Pakistan"),String(shippingAddress.region||"")]);
      let inclusiveTaxAmount=0,exclusiveTaxAmount=0;
      for(const rule of taxRules.rows){
        const rate=Number(rule.rate||0);
        if(rule.inclusive) inclusiveTaxAmount+=taxableBase*rate/(1+rate);
        else exclusiveTaxAmount+=taxableBase*rate;
      }
      inclusiveTaxAmount=Math.round(inclusiveTaxAmount*100)/100;
      exclusiveTaxAmount=Math.round(exclusiveTaxAmount*100)/100;
      const taxAmount=Math.round((inclusiveTaxAmount+exclusiveTaxAmount)*100)/100;
      const total=Math.max(0,subtotal-discountAmount+shippingAmount+exclusiveTaxAmount);
      // Bundles may only complete against an explicit customer-reviewed
      // amount. Keep optional quotes for existing non-bundle integrations.
      if(bundleQuote.bundleCount&&body?.expectedTotal===undefined)
        throw new BadRequestException("A reviewed final total is required for jewelry sets");
      if(body?.expectedTotal!==undefined){
        const expectedTotal=Number(body.expectedTotal);
        if(!Number.isFinite(expectedTotal)||expectedTotal<0) throw new BadRequestException("Expected checkout total is invalid");
        if(Math.round(expectedTotal*100)!==Math.round(total*100)) {
          throw new ConflictException("The final total has changed. Please review the updated order amount before placing your order.");
        }
      }

      await client.query("update checkout_sessions set subtotal=$1,discount_amount=$2,shipping_amount=$3,tax_amount=$4,inclusive_tax_amount=$5,exclusive_tax_amount=$6,total=$7,shipping_method=$8,bundle_discount_amount=$10,updated_at=now() where id=$9",[subtotal,discountAmount,shippingAmount,taxAmount,inclusiveTaxAmount,exclusiveTaxAmount,total,finalShippingMethod,id,bundleQuote.discount]);

      const email=String(checkout.customer_email).toLowerCase();
      const customerResult=await client.query<any>(
        "insert into customers(store_id,email,name,phone,attributes) values($1,$2,$3,$4,'{}'::jsonb) on conflict(store_id,lower(email)) where email is not null and email<>'' do update set name=excluded.name,phone=excluded.phone returning id,name,email,phone",
        [store.id,email,checkout.customer_name,checkout.customer_phone]
      );
      const customer=customerResult.rows[0];

      const numberResult=await client.query<{value:string}>("select 'JS-'||lpad(nextval('jewelry_order_number_seq')::text,6,'0') as value");
      const orderNumber=numberResult.rows[0].value;
      const orderResult=await client.query<any>(
        "insert into orders(store_id,customer_id,order_number,status,payment_status,currency,subtotal,discount_amount,shipping_amount,tax_amount,inclusive_tax_amount,exclusive_tax_amount,total,source_channel,external_id,shipping_address,billing_address,shipping_method,payment_method,fulfillment_status,is_gift,gift_message,terms_accepted_at,discount_code,fulfillment_location_id,bundle_discount_amount) values($1,$2,$3,'confirmed','pending',$4,$5,$6,$7,$8,$9,$10,$11,'online_store',$12,$13::jsonb,$14::jsonb,$15,'cod','unfulfilled',$16,$17,$18,$19,$20,$21) returning *",
        [store.id,customer.id,orderNumber,checkout.currency||store.currency||"PKR",subtotal,discountAmount,shippingAmount,taxAmount,inclusiveTaxAmount,exclusiveTaxAmount,total,"checkout:"+id+":"+idempotencyKey,JSON.stringify(checkout.shipping_address||{}),JSON.stringify(checkout.billing_address||checkout.shipping_address||{}),finalShippingMethod,Boolean(checkout.is_gift),checkout.gift_message||null,checkout.terms_accepted_at,checkout.discount_code||null,fulfillmentLocationId,bundleQuote.discount]
      );
      const order=orderResult.rows[0];

      for(const entry of locked){
        const before=Number(entry.variant.inventory);
        const after=before-Number(entry.line.quantity);
        await client.query("insert into order_items(order_id,product_id,variant_id,sku,title,selected_options,quantity,unit_price,line_total) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)",[order.id,entry.variant.product_id,entry.variant.id,entry.variant.sku,entry.variant.title,JSON.stringify(entry.line.selected_options||{}),Number(entry.line.quantity),entry.price,entry.price*Number(entry.line.quantity)]);
        if(fulfillmentLocationId) await client.query("update inventory_levels set on_hand=on_hand-$1,updated_at=now() where location_id=$2 and variant_id=$3",[Number(entry.line.quantity),fulfillmentLocationId,entry.variant.id]);
        await client.query("update product_variants set inventory=$1,updated_at=now() where id=$2",[after,entry.variant.id]);
        await client.query("insert into inventory_movements(store_id,variant_id,order_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,actor) values($1,$2,$3,'order_sale',$4,$5,$6,$7,'checkout')",[store.id,entry.variant.id,order.id,-Number(entry.line.quantity),before,after,"Order "+orderNumber]);
        if(after<=3){
          await client.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'low_stock','warning',$2,$3,'variant',$4)",[store.id,"Low stock: "+entry.variant.sku,entry.variant.sku+" has "+after+" unit(s) remaining",entry.variant.id]);
        }
      }

      await client.query("insert into order_bundle_allocations(order_id,bundle_id,title_snapshot,component_snapshot,quantity,gross_amount,discount_amount) select $1,bundle_id,title_snapshot,component_snapshot,quantity,gross_amount,discount_amount from checkout_bundle_allocations where checkout_id=$2",[order.id,id]);

      if(discountRow){
        await client.query("update discount_codes set usage_count=usage_count+1 where id=$1",[discountRow.id]);
        await client.query("insert into discount_redemptions(discount_id,order_id,customer_id,amount) values($1,$2,$3,$4)",[discountRow.id,order.id,customer.id,discountAmount]);
      }
      // Commission is created in the same atomic transaction as the COD order.
      // Basis excludes shipping/tax; own purchases do not earn commissions.
      const affiliateBasis=Math.max(0,Math.round((subtotal-discountAmount)*100)/100);
      await client.query(
        "insert into affiliate_commissions(store_id,affiliate_id,order_id,checkout_id,rate,basis_amount,amount,currency,status,eligible_at) "+
        "select $1,a.id,$2,$3,a.rate,$4,round(($4::numeric*a.rate)/100,2),$5,'pending',now()+(cfg.hold_days*interval '1 day') "+
        "from affiliate_checkout_attributions attr join affiliates a on a.id=attr.affiliate_id "+
        "join affiliate_program_settings cfg on cfg.store_id=attr.store_id "+
        "join storefront_accounts account on account.id=a.account_id "+
        "where attr.checkout_id=$3 and attr.store_id=$1 and a.store_id=$1 and a.status='approved' and cfg.enabled=true "+
        "and lower(account.email)<>lower($6) "+
        "and (account.phone is null or length(regexp_replace(account.phone,'[^0-9]','','g'))<10 "+
        "or right(regexp_replace(account.phone,'[^0-9]','','g'),10)<>right(regexp_replace($7::text,'[^0-9]','','g'),10)) "+
        "on conflict(order_id) do nothing",
        [store.id,order.id,id,affiliateBasis,order.currency,email,checkout.customer_phone]
      );
      await client.query("insert into order_events(order_id,event_type,message,metadata) values($1,'order.created',$2,$3::jsonb)",[order.id,"Order "+orderNumber+" created from checkout",JSON.stringify({checkoutId:id,paymentMethod:"cod",isGift:Boolean(checkout.is_gift),discountCode:checkout.discount_code||null})]);
      await client.query("insert into notifications(store_id,kind,severity,title,message,resource_type,resource_id) values($1,'new_order','info',$2,$3,'order',$4)",[store.id,"New order "+orderNumber,"New storefront order for "+order.currency+" "+Number(order.total).toLocaleString(),order.id]);
      await client.query("insert into message_outbox(store_id,channel,template_key,recipient,subject,payload,status) values($1,'email','order_confirmation',$2,$3,$4::jsonb,'queued')",[store.id,email,"Order "+orderNumber+" confirmation",JSON.stringify({orderId:order.id,orderNumber,total:Number(order.total),currency:order.currency,name:checkout.customer_name})]);
      await client.query("update checkout_sessions set status='completed',subtotal=$1,completed_order_id=$2,updated_at=now() where id=$3",[subtotal,order.id,id]);

      return {ok:true,idempotent:false,order:{id:order.id,orderNumber:order.order_number,status:order.status,paymentStatus:order.payment_status,fulfillmentStatus:order.fulfillment_status,total:Number(order.total),currency:order.currency}};
    });
  }
}
