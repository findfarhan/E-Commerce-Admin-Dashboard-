-- Enterprise pricing breakdown + reproducible Jewelry Control defaults.

alter table checkout_sessions add column if not exists inclusive_tax_amount numeric(14,2) not null default 0;
alter table checkout_sessions add column if not exists exclusive_tax_amount numeric(14,2) not null default 0;
alter table orders add column if not exists inclusive_tax_amount numeric(14,2) not null default 0;
alter table orders add column if not exists exclusive_tax_amount numeric(14,2) not null default 0;
alter table draft_orders add column if not exists inclusive_tax_amount numeric(14,2) not null default 0;
alter table draft_orders add column if not exists exclusive_tax_amount numeric(14,2) not null default 0;

-- Historical rows predate split tax accounting. Preserve their prior total semantics.
update checkout_sessions
set exclusive_tax_amount=tax_amount
where tax_amount<>0 and inclusive_tax_amount=0 and exclusive_tax_amount=0;

update orders
set exclusive_tax_amount=tax_amount
where tax_amount<>0 and inclusive_tax_amount=0 and exclusive_tax_amount=0;

update draft_orders
set exclusive_tax_amount=tax_amount
where tax_amount<>0 and inclusive_tax_amount=0 and exclusive_tax_amount=0;

-- Default inventory location. Existing location stock is never overwritten.
with target_store as (
  select id from stores where domain='jewelry-store-lime.vercel.app' limit 1
)
insert into locations(store_id,name,code,location_type,address,active,is_default)
select id,'Main Location','MAIN','warehouse','{}'::jsonb,true,true
from target_store
on conflict(store_id,code) do nothing;

insert into inventory_levels(location_id,variant_id,on_hand,reserved)
select l.id,v.id,v.inventory,0
from locations l
join stores s on s.id=l.store_id
join products p on p.store_id=l.store_id
join product_variants v on v.product_id=p.id
where s.domain='jewelry-store-lime.vercel.app' and l.code='MAIN'
on conflict(location_id,variant_id) do nothing;

-- Jewelry-specific metafield definitions.
with target_store as (
  select id from stores where domain='jewelry-store-lime.vercel.app' limit 1
)
insert into metafield_definitions(
  store_id,resource_type,namespace,key,name,value_type,description,validations,filterable,searchable,position
)
select target_store.id,'product','jewelry',d.key,d.name,d.value_type,d.description,d.validations::jsonb,d.filterable,d.searchable,d.position
from target_store
cross join (values
  ('stone_type','Stone type','text','Primary gemstone or material','{}',true,true,10),
  ('karat','Metal karat','text','Metal purity such as 18K or 22K','{}',true,true,20),
  ('stone_carat','Stone carat','number','Gemstone carat weight','{"min":0}',true,false,30),
  ('certificate','Certificate','text','Certificate or authenticity reference','{}',false,true,40),
  ('gender','Gender / audience','single_select','Primary intended audience','{"options":["Women","Men","Unisex","Kids"]}',true,true,50),
  ('care_instructions','Care instructions','text','Cleaning, storage and handling guidance','{}',false,true,60)
) as d(key,name,value_type,description,validations,filterable,searchable,position)
on conflict(store_id,resource_type,namespace,key) do update
set name=excluded.name,
    value_type=excluded.value_type,
    description=excluded.description,
    validations=excluded.validations,
    filterable=excluded.filterable,
    searchable=excluded.searchable,
    position=excluded.position;

-- Keep the current storefront behavior: Pakistan standard shipping is free until configured otherwise.
insert into shipping_zones(store_id,name,countries,regions,cities,active)
select s.id,'Pakistan',array['Pakistan']::text[],array[]::text[],array[]::text[],true
from stores s
where s.domain='jewelry-store-lime.vercel.app'
  and not exists (
    select 1 from shipping_zones z where z.store_id=s.id and z.name='Pakistan'
  );

insert into shipping_rates(zone_id,name,rate_type,amount,active)
select z.id,'Standard','flat',0,true
from shipping_zones z
join stores s on s.id=z.store_id
where s.domain='jewelry-store-lime.vercel.app'
  and z.name='Pakistan'
  and not exists (
    select 1 from shipping_rates r where r.zone_id=z.id and r.name='Standard'
  );
