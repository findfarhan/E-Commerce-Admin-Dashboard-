"use strict";

/*
 * Real-PostgreSQL COD regression tests.
 *
 * Only a disposable local *_test database is accepted. Tests run against
 * the compiled checkout service, actual SQL, real transactions, and the
 * repository's schema/migrations. Never point TEST_DATABASE_URL to production.
 */
const {test,before,beforeEach,after}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync,readdirSync}=require("node:fs");
const path=require("node:path");
const {Pool}=require("pg");
// NestJS decorators need reflection metadata even when services are constructed directly.
require("reflect-metadata");
const {CheckoutService}=require("../dist/checkout/checkout.service.js");
const {CollectionsService}=require("../dist/collections/collections.service.js");
const {BundlesService}=require("../dist/bundles/bundles.service.js");
const {GiftPackagingService}=require("../dist/gift-packaging/gift-packaging.service.js");
const {OrdersService}=require("../dist/orders/orders.service.js");
const {RecoveryService}=require("../dist/recovery/recovery.service.js");
const {AnalyticsService}=require("../dist/analytics/analytics.service.js");
const {createHmac,randomUUID}=require("node:crypto");
const {DatabaseService}=require("../dist/database/database.service.js");

const testUrl=process.env.TEST_DATABASE_URL;
if(!testUrl) throw new Error("TEST_DATABASE_URL is required: tests never use DATABASE_URL.");
const parsed=new URL(testUrl);
if(!["127.0.0.1","localhost","::1"].includes(parsed.hostname)
  || !decodeURIComponent(parsed.pathname).endsWith("_test")){
  throw new Error("Refusing checkout tests: TEST_DATABASE_URL must point to a LOCAL database ending in _test.");
}
if(process.env.DATABASE_URL && process.env.DATABASE_URL!==testUrl){
  throw new Error("Refusing checkout tests: DATABASE_URL must not point to a different (possibly production) database.");
}
process.env.DATABASE_URL=testUrl;
// The disposable PostgreSQL service in CI runs without TLS; production TLS is unaffected.
process.env.DB_SSL="false";
process.env.STORE_DOMAIN="checkout-regression.invalid";

const root=path.resolve(__dirname,"../../..");
const pool=new Pool({connectionString:testUrl,max:8});
const db=new DatabaseService();
const bundles=new BundlesService(db,{listStorefront:async()=>[]});
const packaging=new GiftPackagingService(db);
const checkout=new CheckoutService(db,new CollectionsService(db),bundles,packaging);
const orders=new OrdersService(db);
process.env.RECOVERY_SIGNING_SECRET="qa-regression-test-secret-only-do-not-use-production-00000000";
process.env.RECOVERY_EMAIL_ENABLED="false";
const recovery=new RecoveryService(db,checkout);
const analytics=new AnalyticsService(db);
let fixture;

async function one(sql,params=[]){
  const result=await pool.query(sql,params);
  return result.rows[0];
}
async function count(table){
  const allowed=new Set(["orders","order_items","customers","checkout_sessions","inventory_movements","payment_transactions","message_outbox","notifications"]);
  if(!allowed.has(table)) throw new Error("Invalid count table");
  return Number((await one("select count(*)::int as n from "+table)).n);
}
async function seed(){
  // This test database is created by CI. TRUNCATE CASCADE NEVER runs against production.
  await pool.query("truncate table stores restart identity cascade");
  const store=await one("insert into stores(name,domain,currency) values('Checkout Regression','checkout-regression.invalid','PKR') returning id");
  const product=await one("insert into products(store_id,handle,title,status,taxable,weight_grams) values($1,'regression-ring','Regression Ring','active',true,5) returning id",[store.id]);
  const variant=await one("insert into product_variants(product_id,sku,price,inventory,status,weight_grams) values($1,'QA-DIA-5',78000,5,'active',5) returning id",[product.id]);
  const location=await one("insert into locations(store_id,name,code,location_type,is_default,active) values($1,'Test Warehouse','QA','warehouse',true,true) returning id",[store.id]);
  await pool.query("insert into inventory_levels(location_id,variant_id,on_hand,reserved) values($1,$2,5,0)",[location.id,variant.id]);
  const zone=await one("insert into shipping_zones(store_id,name,countries,active) values($1,'Pakistan',array['Pakistan']::text[],true) returning id",[store.id]);
  await pool.query("insert into shipping_rates(zone_id,name,service_code,rate_type,amount,active) values($1,'Standard','standard','flat',0,true)",[zone.id]);
  return {storeId:store.id,productId:product.id,variantId:variant.id,locationId:location.id};
}
function customer(overrides={}){
  return {
    name:"QA TEST DO NOT SHIP",
    email:"qa-regression@example.invalid",
    phone:"03001234567",
    shippingMethod:"standard",
    paymentMethod:"cod",
    termsAccepted:true,
    shippingAddress:{line1:"QA Test Address",city:"Lahore",region:"Punjab",country:"Pakistan",postalCode:"54000"},
    ...overrides,
  };
}
async function prepare(quantity=1,details=customer()){
  const session=await checkout.create({items:[{slug:"regression-ring",variantId:fixture.variantId,quantity}]});
  await checkout.setCustomer(session.id,details);
  return session;
}
async function inventory(){
  const variant=await one("select inventory from product_variants where id=$1",[fixture.variantId]);
  const level=await one("select on_hand,reserved from inventory_levels where location_id=$1 and variant_id=$2",[fixture.locationId,fixture.variantId]);
  return {variant:Number(variant.inventory),onHand:Number(level.on_hand),reserved:Number(level.reserved)};
}

before(async()=>{
  const databaseName=await one("select current_database() as name");
  assert.ok(databaseName.name.endsWith("_test"),"Refusing non-test database");
  for(const role of ["anon","authenticated","render_app"]){
    const existing=await one("select 1 as found from pg_roles where rolname=$1",[role]);
    if(!existing) await pool.query("create role "+role+" nologin");
  }
  await pool.query(readFileSync(path.join(root,"database/schema.sql"),"utf8"));
  const migrationsDir=path.join(root,"database/migrations");
  const files=readdirSync(migrationsDir).filter(file=>file.endsWith(".sql")).sort();
  for(const file of files){
    try{
      await pool.query(readFileSync(path.join(migrationsDir,file),"utf8"));
    }catch(error){
      throw new Error("Test schema migration "+file+" failed: "+error.message,{cause:error});
    }
  }
  // The 42P10 regression must be caught by a real partial unique index.
  const indexes=await pool.query("select indexdef from pg_indexes where schemaname='public' and indexname='customers_store_email_unique'");
  assert.equal(indexes.rowCount,1,"Customer email unique index was not created");
  assert.match(indexes.rows[0].indexdef,/email <> ''::text/);
});

beforeEach(async()=>{
  fixture=await seed();
});
after(async()=>{
  await Promise.allSettled([db.onModuleDestroy(),pool.end()]);
});



test("anonymous analytics events require explicit consent and deduplicate retries",async()=>{
 const sessionId=randomUUID(),eventId=randomUUID();
 assert.equal((await analytics.record({type:"product_view",eventId,sessionId,analyticsConsent:false})).recorded,false);
 assert.equal((await one("select count(*)::int n from analytics_events")).n,0);
 for(let i=0;i<2;i++)await analytics.record({type:"product_view",eventId,sessionId,analyticsConsent:true,productHandle:"regression-ring",path:"/product/regression-ring",source:"direct",device:"mobile"});
 assert.equal((await one("select count(*)::int n from analytics_events")).n,1);
 await assert.rejects(()=>analytics.record({type:"product_view",eventId:randomUUID(),sessionId,analyticsConsent:true,productHandle:"some-email@example.com"}),/Invalid product handle/);
 const summary=await analytics.overview();
 assert.equal(summary.funnel.productViews,1);
});

test("checkouts are never subscribed to recovery emails without opt-in",async()=>{
 const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(session.id,customer());
 assert.equal((await one("select count(*)::int n from checkout_recoveries")).n,0);
 assert.equal((await one("select count(*)::int n from checkout_recovery_attempts")).n,0);
});

test("explicit opted-in recovery is suppressed after shopper opts out on quote update",async()=>{
 const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(session.id,customer({recoveryOptIn:true}));
 const row=await one("select status,send_step from checkout_recoveries where checkout_id=$1",[session.id]);
 assert.equal(row.status,"pending");assert.equal(row.send_step,0);
 await checkout.setCustomer(session.id,customer({recoveryOptIn:false}));
 assert.equal((await one("select status from checkout_recoveries where checkout_id=$1",[session.id])).status,"suppressed");
});

test("unchecking consent immediately suppresses recovery without another quote",async()=>{
 const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(session.id,customer({recoveryOptIn:true}));
 await checkout.withdrawRecoveryConsent(session.id);
 const latest=await one("select status,next_send_at from checkout_recoveries where checkout_id=$1",[session.id]);
 assert.equal(latest.status,"suppressed");
 assert.equal(latest.next_send_at,null);
});

test("only the most recently consented checkout stays eligible per email",async()=>{
 const first=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(first.id,customer({recoveryOptIn:true}));
 const second=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(second.id,customer({recoveryOptIn:true}));
 const a=await one("select status from checkout_recoveries where checkout_id=$1",[first.id]);
 const b=await one("select status from checkout_recoveries where checkout_id=$1",[second.id]);
 assert.equal(a.status,"suppressed");
 assert.equal(b.status,"pending");
});

test("recovery consent expires safely after seven days and cannot be redeemed",async()=>{
 const original=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(original.id,customer({recoveryOptIn:true}));
 await pool.query("update checkout_recoveries set consent_at=now()-interval '8 days' where checkout_id=$1",[original.id]);
 await recovery.expireRecoveryConsent();
 assert.equal((await one("select status from checkout_recoveries where checkout_id=$1",[original.id])).status,"expired");
 const digest=createHmac("sha256",process.env.RECOVERY_SIGNING_SECRET)
   .update("recover\n"+original.id+"\nqa-regression@example.invalid").digest("hex");
 await assert.rejects(()=>recovery.redeem(original.id,digest),/no longer recoverable/i);
});

test("no recovery provider means no queued or sent emails",async()=>{
 const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(session.id,customer({recoveryOptIn:true}));
 await pool.query("update checkout_recoveries set next_send_at=now()-interval '2 hours' where checkout_id=$1",[session.id]);
 await recovery.runRecovery();
 assert.equal((await one("select count(*)::int n from checkout_recovery_attempts")).n,0);
});

test("recovery token creates fresh priced checkout and attributes only a confirmed order",async()=>{
 const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(session.id,customer({recoveryOptIn:true}));
 await pool.query("update checkout_sessions set status='expired',expires_at=now()-interval '1 day' where id=$1",[session.id]);
 const token=createHmac("sha256",process.env.RECOVERY_SIGNING_SECRET).update("recover\n"+session.id+"\nqa-regression@example.invalid").digest("hex");
 const {checkoutId}=await recovery.redeem(session.id,token);
 assert.notEqual(checkoutId,session.id);
 const second=await recovery.redeem(session.id,token);
 assert.equal(second.checkoutId,checkoutId);
 assert.equal((await one("select status from checkout_recoveries where checkout_id=$1",[session.id])).status,"pending");
 const quote=await checkout.setCustomer(checkoutId,customer());
 const placed=await checkout.complete(checkoutId,"qa-recovery-order-123",{expectedTotal:quote.total});
 const result=await one("select status,recovered_order_id from checkout_recoveries where checkout_id=$1",[session.id]);
 assert.equal(result.status,"recovered");
 assert.equal(result.recovered_order_id,placed.order.id);
 const data=await recovery.dashboard();
 assert.equal(data.summary.recovered,1);
 assert.equal(data.summary.recoveredValue,placed.order.total);
});

test("unsubscribe suppresses all pending reminders and blocks linked recovery",async()=>{
 const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 await checkout.setCustomer(session.id,customer({recoveryOptIn:true}));
 const token=createHmac("sha256",process.env.RECOVERY_SIGNING_SECRET).update("unsubscribe\n"+session.id+"\nqa-regression@example.invalid").digest("hex");
 await recovery.unsubscribe(session.id,token);
 const row=await one("select status from checkout_recoveries where checkout_id=$1",[session.id]);
 assert.equal(row.status,"suppressed");
 assert.equal((await one("select count(*)::int n from checkout_recovery_optouts")).n,1);
 const redeem=createHmac("sha256",process.env.RECOVERY_SIGNING_SECRET).update("recover\n"+session.id+"\nqa-regression@example.invalid").digest("hex");
 await assert.rejects(()=>recovery.redeem(session.id,redeem),/no longer recoverable/);
});

test("successful regular COD order suppresses any pending reminders",async()=>{
 const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
 const quote=await checkout.setCustomer(session.id,customer({recoveryOptIn:true}));
 await checkout.complete(session.id,"qa-recovery-suppress-123",{expectedTotal:quote.total});
 const row=await one("select status,next_send_at from checkout_recoveries where checkout_id=$1",[session.id]);
 assert.equal(row.status,"suppressed");
 assert.equal(row.next_send_at,null);
});

async function seedPackaging(overrides={}){
  const body={title:"Gift Box QA",sku:"QA-GIFT-BOX",price:450,inventory:2,weightGrams:75,taxable:false,status:"active",position:0,description:"Test only",...overrides};
  const saved=await packaging.save(null,body);
  return saved.id;
}

test("gift packaging price is in the reviewed COD quote and recorded with real SKU deduction",async()=>{
  const optionId=await seedPackaging();
  const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  const quote=await checkout.setCustomer(session.id,customer({isGift:true,giftMessage:"For the special day",giftPackagingId:optionId}));
  assert.equal(quote.total,78450);
  assert.equal(quote.gift_packaging_price,450);
  assert.equal(Number((await one("select inventory from gift_packaging_options where id=$1",[optionId])).inventory),2);
  const placed=await checkout.complete(session.id,"qa-gift-package-123",{expectedTotal:quote.total});
  const saved=await one("select is_gift,gift_message,gift_packaging_sku_snapshot,gift_packaging_price,total from orders where id=$1",[placed.order.id]);
  assert.equal(saved.is_gift,true);
  assert.equal(saved.gift_message,"For the special day");
  assert.equal(saved.gift_packaging_sku_snapshot,"QA-GIFT-BOX");
  assert.equal(Number(saved.gift_packaging_price),450);
  assert.equal(Number(saved.total),78450);
  assert.equal(Number((await one("select inventory from gift_packaging_options where id=$1",[optionId])).inventory),1);
  assert.equal(Number((await one("select count(*)::int n from gift_packaging_movements where order_id=$1 and movement_type='order_sale'",[placed.order.id])).n),1);
  await checkout.complete(session.id,"qa-gift-repeat-123",{expectedTotal:quote.total});
  assert.equal(Number((await one("select inventory from gift_packaging_options where id=$1",[optionId])).inventory),1);
});

test("the last available packaging unit still permits an idempotent completed-checkout retry",async()=>{
  const optionId=await seedPackaging({inventory:1});
  const checkoutSession=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  const quoted=await checkout.setCustomer(checkoutSession.id,customer({isGift:true,giftPackagingId:optionId}));
  const placed=await checkout.complete(checkoutSession.id,"gift-last-box-key-123",{expectedTotal:quoted.total});
  assert.equal(Number((await one("select inventory from gift_packaging_options where id=$1",[optionId])).inventory),0);
  const replay=await checkout.complete(checkoutSession.id,"gift-last-box-key-123",{expectedTotal:quoted.total});
  assert.equal(replay.idempotent,true);
  assert.equal(replay.order.id,placed.order.id);
  assert.equal(await count("orders"),1);
});

test("gift packaging is restored only once when an unpaid order is canceled",async()=>{
  const optionId=await seedPackaging();
  const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  const quote=await checkout.setCustomer(session.id,customer({isGift:true,giftPackagingId:optionId}));
  const placed=await checkout.complete(session.id,"qa-gift-cancel-123",{expectedTotal:quote.total});
  await orders.cancel(placed.order.id,{reason:"QA test canceled"});
  assert.equal(Number((await one("select inventory from gift_packaging_options where id=$1",[optionId])).inventory),2);
  await orders.cancel(placed.order.id,{reason:"QA duplicate"});
  assert.equal(Number((await one("select inventory from gift_packaging_options where id=$1",[optionId])).inventory),2);
  assert.equal(Number((await one("select count(*)::int n from gift_packaging_movements where order_id=$1",[placed.order.id])).n),2);
});

test("changed packaging prices and sold-out boxes cannot complete a stale quote",async()=>{
  const optionId=await seedPackaging();
  const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  const quote=await checkout.setCustomer(session.id,customer({isGift:true,giftPackagingId:optionId}));
  await pool.query("update gift_packaging_options set price=650 where id=$1",[optionId]);
  await assert.rejects(()=>checkout.complete(session.id,"qa-gift-stale-123",{expectedTotal:quote.total}),/Gift packaging details changed/i);
  assert.equal(await count("orders"),0);
  assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});
  await pool.query("update gift_packaging_options set price=450,inventory=0 where id=$1",[optionId]);
  await assert.rejects(()=>checkout.complete(session.id,"qa-gift-soldout-456",{expectedTotal:quote.total}),/packaging is unavailable/i);
  assert.equal(await count("orders"),0);
});

test("packaging cannot be added without gift order, and free gift wrapping has zero added charge",async()=>{
  const optionId=await seedPackaging({price:0});
  const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  await assert.rejects(()=>checkout.setCustomer(session.id,customer({isGift:false,giftPackagingId:optionId})),/Enable gift order/i);
  const quoted=await checkout.setCustomer(session.id,customer({isGift:true,giftPackagingId:optionId}));
  assert.equal(quoted.total,78000);
  assert.equal(quoted.gift_packaging_price,0);
  await assert.rejects(()=>checkout.complete(session.id,"qa-gift-no-quote-123"),/reviewed final total is required/i);
  assert.equal(await count("orders"),0);
});

test("taxable gift packaging price contributes to tax base without discounting product SKUs",async()=>{
  const optionId=await seedPackaging({price:450,taxable:true});
  await pool.query("insert into tax_rules(store_id,name,country,rate,inclusive,active) values($1,'QA Packaging 10%','Pakistan',0.10,false,true)",[fixture.storeId]);
  const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  const quote=await checkout.setCustomer(session.id,customer({isGift:true,giftPackagingId:optionId}));
  assert.equal(quote.exclusive_tax_amount,7845);
  assert.equal(quote.total,86295);
  const placed=await checkout.complete(session.id,"qa-gift-tax-123",{expectedTotal:quote.total});
  assert.equal(placed.order.total,86295);
});

async function seedBundle(){
  const product=await one("insert into products(store_id,handle,title,status,taxable,weight_grams) values($1,'qa-necklace','QA Necklace','active',true,5) returning id",[fixture.storeId]);
  const variant=await one("insert into product_variants(product_id,sku,price,inventory,status,weight_grams) values($1,'QA-NECK-01',12000,4,'active',5) returning id",[product.id]);
  await pool.query("insert into inventory_levels(location_id,variant_id,on_hand,reserved) values($1,$2,4,0)",[fixture.locationId,variant.id]);
  const saved=await bundles.create({
    title:"QA Ring & Necklace Set",handle:"qa-ring-necklace",
    description:"Bundle QA only",status:"active",
    discountKind:"fixed",discountValue:5000,
    components:[{variantId:fixture.variantId,quantity:1},{variantId:variant.id,quantity:1}],
  });
  return {bundleId:saved.id,necklaceVariantId:variant.id};
}

test("fixed-price jewelry bundle checks out real component variants with an audited discount",async()=>{
  const {bundleId,necklaceVariantId}=await seedBundle();
  const session=await checkout.create({items:[],bundles:[{bundleId,quantity:1}]});
  assert.equal(Number(session.subtotal),90000);
  const review=await checkout.setCustomer(session.id,customer());
  assert.equal(review.total,85000);
  assert.equal(Number(review.bundle_discount_amount),5000);
  const completed=await checkout.complete(session.id,"qa-bundle-main-123",{expectedTotal:review.total});
  assert.equal(completed.order.total,85000);
  const saved=await one("select subtotal,discount_amount,bundle_discount_amount,total from orders where id=$1",[completed.order.id]);
  assert.deepEqual([Number(saved.subtotal),Number(saved.discount_amount),Number(saved.bundle_discount_amount),Number(saved.total)],[90000,5000,5000,85000]);
  const orderItems=await pool.query("select sku,quantity from order_items where order_id=$1 order by sku",[completed.order.id]);
  assert.deepEqual(orderItems.rows.map(x=>x.sku).sort(),["QA-DIA-5","QA-NECK-01"]);
  assert.deepEqual(await inventory(),{variant:4,onHand:4,reserved:0});
  assert.equal(Number((await one("select inventory from product_variants where id=$1",[necklaceVariantId])).inventory),3);
  const allocation=await one("select title_snapshot,discount_amount,component_snapshot from order_bundle_allocations where order_id=$1",[completed.order.id]);
  assert.equal(Number(allocation.discount_amount),5000);
  assert.equal(allocation.component_snapshot.length,2);
  await checkout.complete(session.id,"qa-bundle-repeat-123");
  assert.equal(await count("orders"),1);
});

test("regular cart item plus bundles cannot over-consume the same variant stock",async()=>{
  const {bundleId}=await seedBundle();
  await assert.rejects(()=>checkout.create({
    items:[{variantId:fixture.variantId,quantity:4}],
    bundles:[{bundleId,quantity:2}],
  }),/only 5 item/i);
  assert.equal(await count("checkout_sessions"),0);
  assert.equal(await count("inventory_movements"),0);
});

test("bundle tax saving is allocated only to taxable bundle components",async()=>{
  const {bundleId}=await seedBundle();
  await pool.query("update products set taxable=false where store_id=$1 and handle='qa-necklace'",[fixture.storeId]);
  await pool.query("insert into tax_rules(store_id,name,country,rate,inclusive,active) values($1,'QA 10% Tax','Pakistan',0.10,false,true)",[fixture.storeId]);
  // Two taxable rings: one standalone plus one inside the bundle.
  // The non-taxable necklace must not shift bundle savings to the extra ring.
  const session=await checkout.create({
    items:[{variantId:fixture.variantId,quantity:1}],
    bundles:[{bundleId,quantity:1}],
  });
  const quote=await checkout.setCustomer(session.id,customer());
  assert.equal(Number(quote.subtotal),168000);
  assert.equal(Number(quote.discount_amount),5000);
  // Discount taxable share: 5000*(78000/90000)=4333.33.
  // Tax base: 156000-4333.33 = 151666.67, 10% tax = 15166.67.
  assert.equal(Number(quote.exclusive_tax_amount),15166.67);
  assert.equal(Number(quote.total),178166.67);
  const order=await checkout.complete(session.id,"qa-bundle-tax-123",{expectedTotal:quote.total});
  assert.equal(order.order.total,178166.67);
});

test("archived or revised bundles are rejected at completion without creating orders",async()=>{
  const {bundleId}=await seedBundle();
  const session=await checkout.create({bundles:[{bundleId,quantity:1}]});
  const review=await checkout.setCustomer(session.id,customer());
  await pool.query("update jewelry_bundles set status='archived' where id=$1",[bundleId]);
  await assert.rejects(()=>checkout.complete(session.id,"qa-bundle-archive-123",{expectedTotal:review.total}),/Bundle is unavailable/);
  assert.equal(await count("orders"),0);
  assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});
});

test("coupon and bundle discounts cannot be combined",async()=>{
  const {bundleId}=await seedBundle();
  const session=await checkout.create({bundles:[{bundleId,quantity:1}]});
  await assert.rejects(()=>checkout.setCustomer(session.id,customer({discountCode:"WELCOME10"})),/cannot be combined/i);
  assert.equal(await count("orders"),0);
});

test("bundle COD completion requires an explicitly reviewed total",async()=>{
  const {bundleId}=await seedBundle();
  const session=await checkout.create({bundles:[{bundleId,quantity:1}]});
  await checkout.setCustomer(session.id,customer());
  await assert.rejects(()=>checkout.complete(session.id,"qa-unreviewed-bundle-123"),/reviewed final total is required/i);
  assert.equal(await count("orders"),0);
  assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});
});

test("changed component prices invalidate the customer's bundle checkout quote",async()=>{
  const {bundleId}=await seedBundle();
  const session=await checkout.create({bundles:[{bundleId,quantity:1}]});
  const review=await checkout.setCustomer(session.id,customer());
  await pool.query("update product_variants set price=80000 where id=$1",[fixture.variantId]);
  await assert.rejects(()=>checkout.complete(session.id,"qa-bundle-price-123",{expectedTotal:review.total}),/Bundle pricing changed/);
  assert.equal(await count("orders"),0);
});

test("canceling a COD bundle restores every real jewelry variant exactly once",async()=>{
  const {bundleId,necklaceVariantId}=await seedBundle();
  const session=await checkout.create({bundles:[{bundleId,quantity:1}]});
  const reviewed=await checkout.setCustomer(session.id,customer());
  const confirmed=await checkout.complete(session.id,"qa-bundle-cancel-123",{expectedTotal:reviewed.total});
  const canceled=await orders.cancel(confirmed.order.id,{reason:"QA canceled"});
  assert.equal(canceled.ok,true);
  assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});
  assert.equal(Number((await one("select inventory from product_variants where id=$1",[necklaceVariantId])).inventory),4);
  const again=await orders.cancel(confirmed.order.id,{reason:"QA duplicate cancellation"});
  assert.equal(again.idempotent,true);
  assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});
});

test("COD checkout creates exactly one pending order, decrements variant/location stock, and queues confirmation",async()=>{
  const session=await prepare();
  const result=await checkout.complete(session.id,"qa-happy-path-12345");
  assert.equal(result.ok,true);
  assert.equal(result.idempotent,false);
  assert.equal(result.order.paymentStatus,"pending");
  assert.equal(result.order.fulfillmentStatus,"unfulfilled");
  assert.equal(result.order.total,78000);
  assert.match(result.order.orderNumber,/^JS-[0-9]+$/);

  const stored=await one("select status,payment_status,fulfillment_status,total,payment_method from orders where id=$1",[result.order.id]);
  assert.deepEqual([stored.status,stored.payment_status,stored.fulfillment_status,Number(stored.total),stored.payment_method],["confirmed","pending","unfulfilled",78000,"cod"]);
  const item=await one("select sku,quantity,unit_price,line_total from order_items where order_id=$1",[result.order.id]);
  assert.deepEqual([item.sku,item.quantity,Number(item.unit_price),Number(item.line_total)],["QA-DIA-5",1,78000,78000]);
  assert.deepEqual(await inventory(),{variant:4,onHand:4,reserved:0});
  const movement=await one("select movement_type,quantity_delta,quantity_before,quantity_after from inventory_movements where order_id=$1",[result.order.id]);
  assert.deepEqual([movement.movement_type,movement.quantity_delta,movement.quantity_before,movement.quantity_after],["order_sale",-1,5,4]);
  assert.equal(await count("orders"),1);
  assert.equal(await count("payment_transactions"),0);
  const notification=await one("select status,template_key from message_outbox where store_id=$1",[fixture.storeId]);
  assert.deepEqual([notification.status,notification.template_key],["queued","order_confirmation"]);
  const reopened=await checkout.detail(session.id);
  assert.equal(reopened.status,"completed");
  assert.deepEqual(reopened.completed_order,{orderNumber:result.order.orderNumber,total:78000});
  assert.equal(Object.prototype.hasOwnProperty.call(reopened,"customer_email"),false);
});

test("same and different idempotency keys return the existing order without a second stock movement",async()=>{
  const session=await prepare();
  const first=await checkout.complete(session.id,"qa-repeat-key-123");
  const repeat=await checkout.complete(session.id,"qa-repeat-key-123");
  const different=await checkout.complete(session.id,"qa-another-key-456");
  assert.equal(first.idempotent,false);
  assert.equal(repeat.idempotent,true);
  assert.equal(different.idempotent,true);
  assert.equal(repeat.order.id,first.order.id);
  assert.equal(different.order.id,first.order.id);
  assert.equal(await count("orders"),1);
  assert.equal(await count("order_items"),1);
  assert.equal(await count("inventory_movements"),1);
  assert.deepEqual(await inventory(),{variant:4,onHand:4,reserved:0});
});

test("parallel completion of the same checkout serializes to one order",async()=>{
  const session=await prepare();
  const results=await Promise.all([
    checkout.complete(session.id,"qa-parallel-a-123"),
    checkout.complete(session.id,"qa-parallel-b-123"),
  ]);
  assert.equal(new Set(results.map(result=>result.order.id)).size,1);
  assert.deepEqual(results.map(result=>result.idempotent).sort(),[false,true]);
  assert.equal(await count("orders"),1);
  assert.equal(await count("inventory_movements"),1);
  assert.deepEqual(await inventory(),{variant:4,onHand:4,reserved:0});
});

test("two checkout sessions competing for the last unit cannot oversell",async()=>{
  await pool.query("update product_variants set inventory=1 where id=$1",[fixture.variantId]);
  await pool.query("update inventory_levels set on_hand=1 where variant_id=$1",[fixture.variantId]);
  const a=await prepare(1,customer({email:"a@example.invalid"}));
  const b=await prepare(1,customer({email:"b@example.invalid"}));
  const outcomes=await Promise.allSettled([
    checkout.complete(a.id,"qa-last-unit-a-123"),
    checkout.complete(b.id,"qa-last-unit-b-123"),
  ]);
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
  assert.match(outcomes.find(x=>x.status==="rejected").reason.message,/enough stock|enough|stock/i);
  assert.equal(await count("orders"),1);
  assert.equal(await count("inventory_movements"),1);
  assert.deepEqual(await inventory(),{variant:0,onHand:0,reserved:0});
});

test("aggregate quantity across duplicate cart lines is checked before creating a session",async()=>{
  await assert.rejects(
    ()=>checkout.create({items:[
      {variantId:fixture.variantId,quantity:3},
      {variantId:fixture.variantId,quantity:3},
    ]}),
    /only 5 item/i
  );
  assert.equal(await count("checkout_sessions"),0);
  assert.equal(await count("orders"),0);
  assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});
});

test("stock disappearing after checkout preparation rejects completion without side effects",async()=>{
  const session=await prepare();
  await pool.query("update product_variants set inventory=0 where id=$1",[fixture.variantId]);
  await pool.query("update inventory_levels set on_hand=0 where variant_id=$1",[fixture.variantId]);
  await assert.rejects(()=>checkout.complete(session.id,"qa-stock-gone-123"),/enough stock/i);
  assert.equal(await count("orders"),0);
  assert.equal(await count("inventory_movements"),0);
  assert.equal((await checkout.detail(session.id)).status,"open");
  assert.deepEqual(await inventory(),{variant:0,onHand:0,reserved:0});
});

test("non-COD or unaccepted terms is rejected before committing customer details",async()=>{
  const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  await assert.rejects(()=>checkout.setCustomer(session.id,customer({paymentMethod:"card"})),/Only COD/);
  await assert.rejects(()=>checkout.setCustomer(session.id,customer({termsAccepted:false})),/Terms and privacy acceptance/);
  const state=await one("select customer_email,terms_accepted_at from checkout_sessions where id=$1",[session.id]);
  assert.equal(state.customer_email,null);
  assert.equal(state.terms_accepted_at,null);
  assert.equal(await count("orders"),0);
});


test("customer-reviewed total is protected when shipping changes before COD completion",async()=>{
  const session=await checkout.create({items:[{variantId:fixture.variantId,quantity:1}]});
  const reviewed=await checkout.setCustomer(session.id,customer());
  assert.equal(reviewed.total,78000);

  // Rates can change while a buyer is reading the checkout review screen.
  await pool.query("update shipping_rates set amount=450 where zone_id in (select id from shipping_zones where store_id=$1)",[fixture.storeId]);
  await assert.rejects(
    ()=>checkout.complete(session.id,"qa-quote-stale-123",{expectedTotal:reviewed.total}),
    /final total has changed/i
  );
  assert.equal(await count("orders"),0);
  assert.equal(await count("inventory_movements"),0);
  assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});

  const refreshed=await checkout.setCustomer(session.id,customer());
  assert.equal(refreshed.total,78450);
  const completed=await checkout.complete(session.id,"qa-quote-fresh-456",{expectedTotal:refreshed.total});
  assert.equal(completed.order.total,78450);
  assert.equal(await count("orders"),1);
});

test("completion re-prices the latest variant price, not a stale client subtotal",async()=>{
  const session=await prepare();
  await pool.query("update product_variants set price=79000 where id=$1",[fixture.variantId]);
  const result=await checkout.complete(session.id,"qa-reprice-12345");
  assert.equal(result.order.total,79000);
  const stored=await one("select total,subtotal from orders where id=$1",[result.order.id]);
  assert.equal(Number(stored.total),79000);
  assert.equal(Number(stored.subtotal),79000);
});

test("discount and exclusive tax totals match the completion transaction",async()=>{
  await pool.query("insert into discount_codes(store_id,code,kind,value,automatic,active) values($1,'QA10','percentage',10,true,true)",[fixture.storeId]);
  await pool.query("insert into tax_rules(store_id,name,country,rate,inclusive,priority) values($1,'Test Tax','Pakistan',0.15,false,0)",[fixture.storeId]);
  const session=await prepare();
  const detail=await checkout.detail(session.id);
  assert.equal(detail.discount_amount,7800);
  assert.equal(detail.exclusive_tax_amount,10530);
  assert.equal(detail.total,80730);
  const result=await checkout.complete(session.id,"qa-tax-check-123");
  assert.equal(result.order.total,80730);
  const stored=await one("select discount_amount,tax_amount,exclusive_tax_amount,total from orders where id=$1",[result.order.id]);
  assert.deepEqual([Number(stored.discount_amount),Number(stored.tax_amount),Number(stored.exclusive_tax_amount),Number(stored.total)],[7800,10530,10530,80730]);
});

test("a database failure near the end of completion rolls back customer, order, inventory, and checkout state",async()=>{
  const session=await prepare();
  await pool.query("create function checkout_qa_fail_event() returns trigger language plpgsql as $$ begin raise exception 'QA forced failure in order_events'; end $$");
  await pool.query("create trigger checkout_qa_fail_event before insert on order_events for each row execute function checkout_qa_fail_event()");
  try{
    await assert.rejects(()=>checkout.complete(session.id,"qa-rollback-12345"),/QA forced failure/);
    assert.equal(await count("orders"),0);
    assert.equal(await count("order_items"),0);
    assert.equal(await count("customers"),0);
    assert.equal(await count("inventory_movements"),0);
    assert.equal(await count("message_outbox"),0);
    assert.deepEqual(await inventory(),{variant:5,onHand:5,reserved:0});
    assert.equal((await checkout.detail(session.id)).status,"open");
  }finally{
    await pool.query("drop trigger if exists checkout_qa_fail_event on order_events");
    await pool.query("drop function if exists checkout_qa_fail_event()");
  }
});
