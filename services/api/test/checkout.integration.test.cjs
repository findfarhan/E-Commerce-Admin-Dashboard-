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
const checkout=new CheckoutService(db,new CollectionsService(db));
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
