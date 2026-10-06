-- Enterprise commerce platform expansion
-- Additive migration: preserves current storefront/order compatibility while adding enterprise capabilities.

create sequence if not exists jewelry_quote_number_seq start 1001;
create sequence if not exists jewelry_purchase_order_seq start 1001;
create sequence if not exists jewelry_return_number_seq start 1001;

alter table stores
  add column if not exists prices_include_tax boolean not null default false,
  add column if not exists default_location_id uuid;

alter table products
  add column if not exists vendor text,
  add column if not exists product_type text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists published_at timestamptz,
  add column if not exists search_attributes jsonb not null default '{}'::jsonb,
  add column if not exists taxable boolean not null default true,
  add column if not exists weight_grams numeric(12,3);

alter table product_variants
  add column if not exists cost_amount numeric(14,2) not null default 0,
  add column if not exists weight_grams numeric(12,3);

alter table orders
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists discount_code text,
  add column if not exists location_id uuid,
  add column if not exists draft_order_id uuid;

alter table order_items
  add column if not exists unit_cost numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0;

alter table customers
  add column if not exists updated_at timestamptz not null default now();

alter table checkout_sessions
  add column if not exists discount_code text,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists shipping_rate_id uuid;

alter table collections
  add column if not exists collection_type text not null default 'manual',
  add column if not exists publish_at timestamptz,
  add column if not exists unpublish_at timestamptz;

create table if not exists metafield_definitions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  owner_type text not null check(owner_type in ('product','variant','collection','customer','order')),
  namespace text not null,
  key text not null,
  name text not null,
  description text,
  value_type text not null check(value_type in ('text','multiline_text','number_integer','number_decimal','boolean','date','datetime','url','json')),
  validation jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,owner_type,namespace,key)
);

create table if not exists metafield_values (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  definition_id uuid not null references metafield_definitions(id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(definition_id,owner_id)
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  address_type text not null default 'shipping' check(address_type in ('shipping','billing','both')),
  label text,
  recipient_name text,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text,
  country text not null default 'Pakistan',
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_tags (
  customer_id uuid not null references customers(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key(customer_id,tag)
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  code text not null,
  address jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_fulfillment boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,code)
);

alter table stores
  drop constraint if exists stores_default_location_fk;
alter table stores
  add constraint stores_default_location_fk
  foreign key(default_location_id) references locations(id) on delete set null;

alter table orders
  drop constraint if exists orders_location_fk;
alter table orders
  add constraint orders_location_fk
  foreign key(location_id) references locations(id) on delete set null;

create table if not exists inventory_levels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  available integer not null default 0 check(available >= 0),
  reserved integer not null default 0 check(reserved >= 0),
  incoming integer not null default 0 check(incoming >= 0),
  reorder_point integer not null default 0 check(reorder_point >= 0),
  updated_at timestamptz not null default now(),
  unique(location_id,variant_id)
);

create table if not exists inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  from_location_id uuid not null references locations(id),
  to_location_id uuid not null references locations(id),
  status text not null default 'draft' check(status in ('draft','in_transit','received','canceled')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  check(from_location_id <> to_location_id)
);

create table if not exists inventory_transfer_items (
  transfer_id uuid not null references inventory_transfers(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  quantity integer not null check(quantity > 0),
  received_quantity integer not null default 0 check(received_quantity >= 0),
  primary key(transfer_id,variant_id)
);

create table if not exists draft_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  quote_number text not null,
  customer_id uuid references customers(id) on delete set null,
  status text not null default 'draft' check(status in ('draft','sent','accepted','converted','expired','canceled')),
  currency text not null default 'PKR',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  shipping_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  price_override_reason text,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  shipping_method text,
  discount_code text,
  notes text,
  expires_at timestamptz,
  converted_order_id uuid references orders(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,quote_number)
);

create table if not exists draft_order_items (
  id uuid primary key default gen_random_uuid(),
  draft_order_id uuid not null references draft_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  sku text not null,
  title text not null,
  selected_options jsonb not null default '{}'::jsonb,
  quantity integer not null check(quantity > 0),
  unit_price numeric(14,2) not null check(unit_price >= 0),
  unit_cost numeric(14,2) not null default 0,
  line_total numeric(14,2) not null check(line_total >= 0),
  price_overridden boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

alter table orders
  drop constraint if exists orders_draft_order_fk;
alter table orders
  add constraint orders_draft_order_fk
  foreign key(draft_order_id) references draft_orders(id) on delete set null;

create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  code text,
  discount_type text not null check(discount_type in ('percentage','fixed_amount','automatic')),
  value numeric(14,4) not null check(value >= 0),
  minimum_subtotal numeric(14,2) not null default 0,
  usage_limit integer,
  usage_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  target_type text not null default 'order' check(target_type in ('order','product','collection')),
  target_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists discounts_store_code_unique
  on discounts(store_id,lower(code))
  where code is not null and trim(code) <> '';

create table if not exists discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references discounts(id) on delete restrict,
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  draft_order_id uuid references draft_orders(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists shipping_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  countries text[] not null default '{}',
  regions text[] not null default '{}',
  cities text[] not null default '{}',
  active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references shipping_zones(id) on delete cascade,
  name text not null,
  rate_type text not null default 'flat' check(rate_type in ('flat','free','weight','order_value')),
  amount numeric(14,2) not null default 0 check(amount >= 0),
  min_order_value numeric(14,2),
  max_order_value numeric(14,2),
  min_weight_grams numeric(14,3),
  max_weight_grams numeric(14,3),
  carrier text,
  service_code text,
  active boolean not null default true,
  priority integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table checkout_sessions
  drop constraint if exists checkout_sessions_shipping_rate_fk;
alter table checkout_sessions
  add constraint checkout_sessions_shipping_rate_fk
  foreign key(shipping_rate_id) references shipping_rates(id) on delete set null;

create table if not exists tax_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  country text,
  region text,
  city text,
  rate numeric(8,6) not null check(rate >= 0 and rate <= 1),
  priority integer not null default 0,
  active boolean not null default true,
  product_types text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  draft_order_id uuid references draft_orders(id) on delete cascade,
  transaction_type text not null check(transaction_type in ('authorization','capture','payment','refund','adjustment')),
  provider text not null default 'manual',
  status text not null check(status in ('pending','succeeded','failed','canceled')),
  amount numeric(14,2) not null check(amount >= 0),
  currency text not null default 'PKR',
  external_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists payment_transactions_idempotency_unique
  on payment_transactions(store_id,idempotency_key)
  where idempotency_key is not null;

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null references orders(id) on delete restrict,
  return_number text not null,
  status text not null default 'requested' check(status in ('requested','approved','received','completed','rejected','canceled')),
  reason text,
  refund_amount numeric(14,2) not null default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(store_id,return_number)
);

create table if not exists return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references returns(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete restrict,
  quantity integer not null check(quantity > 0),
  action text not null default 'return' check(action in ('return','exchange')),
  exchange_variant_id uuid references product_variants(id) on delete set null,
  item_condition text not null default 'resellable' check(item_condition in ('resellable','damaged','repair')),
  restock boolean not null default true,
  refund_amount numeric(14,2) not null default 0
);

create table if not exists collection_rules (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  field text not null,
  operator text not null check(operator in ('equals','not_equals','contains','in','gte','lte')),
  value jsonb not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  po_number text not null,
  status text not null default 'draft' check(status in ('draft','ordered','partially_received','received','canceled')),
  currency text not null default 'PKR',
  subtotal numeric(14,2) not null default 0,
  notes text,
  expected_at timestamptz,
  ordered_at timestamptz,
  received_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,po_number)
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete restrict,
  quantity integer not null check(quantity > 0),
  received_quantity integer not null default 0 check(received_quantity >= 0),
  unit_cost numeric(14,2) not null check(unit_cost >= 0),
  line_total numeric(14,2) not null check(line_total >= 0)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  actor text not null default 'system',
  actor_type text not null default 'admin',
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  slug text not null,
  permissions text[] not null default '{}',
  system_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,slug)
);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  auth_subject uuid,
  email text not null,
  display_name text,
  role_id uuid references roles(id) on delete set null,
  password_hash text,
  password_salt text,
  password_iterations integer not null default 210000,
  status text not null default 'active' check(status in ('invited','active','suspended')),
  last_seen_at timestamptz,
  last_login_at timestamptz,
  invited_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_users_store_email_unique on admin_users(store_id,lower(email));

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  severity text not null default 'info' check(severity in ('info','success','warning','critical')),
  status text not null default 'unread' check(status in ('unread','read','archived')),
  resource_type text,
  resource_id uuid,
  channels text[] not null default '{admin}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists outbound_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  channel text not null check(channel in ('email','sms','whatsapp','push')),
  recipient text not null,
  template_key text not null,
  subject text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check(status in ('queued','sending','sent','failed','canceled')),
  provider text,
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists metafield_values_owner_idx on metafield_values(store_id,owner_type,owner_id);
create index if not exists customer_addresses_customer_idx on customer_addresses(customer_id);
create index if not exists inventory_levels_variant_idx on inventory_levels(variant_id);
create index if not exists inventory_levels_location_idx on inventory_levels(location_id,available);
create index if not exists draft_orders_store_status_idx on draft_orders(store_id,status,created_at desc);
create index if not exists discounts_store_active_idx on discounts(store_id,active,starts_at,ends_at);
create index if not exists shipping_zones_store_idx on shipping_zones(store_id,active,priority);
create index if not exists tax_rules_store_idx on tax_rules(store_id,active,priority);
create index if not exists payment_transactions_order_idx on payment_transactions(order_id,created_at desc);
create index if not exists returns_order_idx on returns(order_id,created_at desc);
create index if not exists purchase_orders_store_status_idx on purchase_orders(store_id,status,created_at desc);
create index if not exists audit_logs_store_created_idx on audit_logs(store_id,created_at desc);
create index if not exists notifications_store_status_idx on notifications(store_id,status,created_at desc);
create index if not exists outbound_messages_ready_idx on outbound_messages(status,available_at);
create index if not exists products_search_attributes_gin on products using gin(search_attributes);
create index if not exists products_tags_gin on products using gin(tags);

-- Seed an internal default location for every store and mirror existing variant stock.
insert into locations(store_id,name,code,address,is_active,is_fulfillment,priority)
select s.id,'Primary Location','PRIMARY',jsonb_build_object('country','Pakistan'),true,true,0
from stores s
where not exists(select 1 from locations l where l.store_id=s.id and l.code='PRIMARY');

update stores s
set default_location_id=l.id
from locations l
where l.store_id=s.id and l.code='PRIMARY' and s.default_location_id is null;

insert into inventory_levels(store_id,location_id,variant_id,available,reserved,incoming,reorder_point)
select p.store_id,s.default_location_id,v.id,greatest(v.inventory,0),0,0,0
from product_variants v
join products p on p.id=v.product_id
join stores s on s.id=p.store_id
where s.default_location_id is not null
on conflict(location_id,variant_id) do nothing;

insert into roles(store_id,name,slug,permissions,system_role)
select id,'Owner','owner',array['*']::text[],true from stores
on conflict(store_id,slug) do nothing;


insert into roles(store_id,name,slug,permissions,system_role)
select id,'Manager','manager',array['orders.read','orders.write','returns.read','returns.write','payments.read','payments.write','crm.read','crm.write','catalog.read','catalog.write','inventory.read','inventory.write','purchasing.read','purchasing.write','discounts.read','discounts.write','settings.read','analytics.read','notifications.read','audit.read']::text[],true from stores
on conflict(store_id,slug) do nothing;
insert into roles(store_id,name,slug,permissions,system_role)
select id,'Catalog Manager','catalog-manager',array['catalog.read','catalog.write','inventory.read','inventory.write','analytics.read']::text[],true from stores
on conflict(store_id,slug) do nothing;
insert into roles(store_id,name,slug,permissions,system_role)
select id,'Fulfillment','fulfillment',array['orders.read','orders.write','returns.read','returns.write','payments.read','inventory.read','inventory.write','notifications.read']::text[],true from stores
on conflict(store_id,slug) do nothing;
insert into roles(store_id,name,slug,permissions,system_role)
select id,'Customer Support','customer-support',array['orders.read','crm.read','crm.write','returns.read','notifications.read']::text[],true from stores
on conflict(store_id,slug) do nothing;
insert into roles(store_id,name,slug,permissions,system_role)
select id,'Marketing','marketing',array['catalog.read','discounts.read','discounts.write','analytics.read','notifications.read']::text[],true from stores
on conflict(store_id,slug) do nothing;
insert into roles(store_id,name,slug,permissions,system_role)
select id,'Read Only','read-only',array['orders.read','returns.read','payments.read','crm.read','catalog.read','inventory.read','purchasing.read','discounts.read','settings.read','analytics.read','notifications.read','audit.read']::text[],true from stores
on conflict(store_id,slug) do nothing;

insert into metafield_definitions(store_id,owner_type,namespace,key,name,description,value_type,validation,position)
select s.id,'product','jewelry','stone_type','Stone type','Primary gemstone or material','text','{}'::jsonb,10 from stores s
on conflict(store_id,owner_type,namespace,key) do nothing;
insert into metafield_definitions(store_id,owner_type,namespace,key,name,description,value_type,validation,position)
select s.id,'product','jewelry','karat','Karat','Metal purity / karat','text','{"allowedValues":["9K","14K","18K","21K","22K","24K"]}'::jsonb,20 from stores s
on conflict(store_id,owner_type,namespace,key) do nothing;
insert into metafield_definitions(store_id,owner_type,namespace,key,name,description,value_type,validation,position)
select s.id,'product','jewelry','weight','Weight','Finished item weight in grams','number_decimal','{"min":0}'::jsonb,30 from stores s
on conflict(store_id,owner_type,namespace,key) do nothing;
insert into metafield_definitions(store_id,owner_type,namespace,key,name,description,value_type,validation,position)
select s.id,'product','jewelry','certificate','Certificate','Certificate or authenticity reference','text','{}'::jsonb,40 from stores s
on conflict(store_id,owner_type,namespace,key) do nothing;
insert into metafield_definitions(store_id,owner_type,namespace,key,name,description,value_type,validation,position)
select s.id,'product','jewelry','care_instructions','Care instructions','Jewelry care and maintenance guidance','multiline_text','{"maxLength":2000}'::jsonb,50 from stores s
on conflict(store_id,owner_type,namespace,key) do nothing;
insert into metafield_definitions(store_id,owner_type,namespace,key,name,description,value_type,validation,position)
select s.id,'product','jewelry','gender','Gender / audience','Merchandising audience','text','{"allowedValues":["Women","Men","Unisex","Kids"]}'::jsonb,60 from stores s
on conflict(store_id,owner_type,namespace,key) do nothing;

-- Internal data is server-owned. Keep RLS enabled and remove browser roles.
alter table metafield_definitions enable row level security;
alter table metafield_values enable row level security;
alter table customer_addresses enable row level security;
alter table customer_tags enable row level security;
alter table locations enable row level security;
alter table inventory_levels enable row level security;
alter table inventory_transfers enable row level security;
alter table inventory_transfer_items enable row level security;
alter table draft_orders enable row level security;
alter table draft_order_items enable row level security;
alter table discounts enable row level security;
alter table discount_redemptions enable row level security;
alter table shipping_zones enable row level security;
alter table shipping_rates enable row level security;
alter table tax_rules enable row level security;
alter table payment_transactions enable row level security;
alter table returns enable row level security;
alter table return_items enable row level security;
alter table collection_rules enable row level security;
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table audit_logs enable row level security;
alter table roles enable row level security;
alter table admin_users enable row level security;
alter table notifications enable row level security;
alter table outbound_messages enable row level security;

revoke all on table metafield_definitions,metafield_values,customer_addresses,customer_tags,locations,inventory_levels,inventory_transfers,inventory_transfer_items,draft_orders,draft_order_items,discounts,discount_redemptions,shipping_zones,shipping_rates,tax_rules,payment_transactions,returns,return_items,collection_rules,suppliers,purchase_orders,purchase_order_items,audit_logs,roles,admin_users,notifications,outbound_messages from anon,authenticated;

do $$
begin
  if exists(select 1 from pg_roles where rolname='render_app') then
    execute 'grant select,insert,update,delete on metafield_definitions,metafield_values,customer_addresses,customer_tags,locations,inventory_levels,inventory_transfers,inventory_transfer_items,draft_orders,draft_order_items,discounts,discount_redemptions,shipping_zones,shipping_rates,tax_rules,payment_transactions,returns,return_items,collection_rules,suppliers,purchase_orders,purchase_order_items,audit_logs,roles,admin_users,notifications,outbound_messages to render_app';
    execute 'grant usage,select on sequence jewelry_quote_number_seq,jewelry_purchase_order_seq,jewelry_return_number_seq to render_app';
  end if;
end $$;
