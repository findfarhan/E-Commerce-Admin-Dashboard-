-- Enterprise commerce core for Jewelry Control
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  code text not null,
  location_type text not null default 'warehouse',
  address jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,code)
);

create table if not exists inventory_levels (
  location_id uuid not null references locations(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  on_hand integer not null default 0 check(on_hand>=0),
  reserved integer not null default 0 check(reserved>=0),
  updated_at timestamptz not null default now(),
  primary key(location_id,variant_id)
);

create table if not exists inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  from_location_id uuid references locations(id) on delete restrict,
  to_location_id uuid not null references locations(id) on delete restrict,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists inventory_transfer_items (
  transfer_id uuid not null references inventory_transfers(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete restrict,
  quantity integer not null check(quantity>0),
  primary key(transfer_id,variant_id)
);

create table if not exists metafield_definitions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  resource_type text not null,
  namespace text not null default 'custom',
  key text not null,
  name text not null,
  value_type text not null,
  description text,
  validations jsonb not null default '{}'::jsonb,
  filterable boolean not null default false,
  searchable boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(store_id,resource_type,namespace,key)
);

create table if not exists resource_metafields (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  definition_id uuid references metafield_definitions(id) on delete set null,
  namespace text not null default 'custom',
  key text not null,
  value_type text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique(store_id,resource_type,resource_id,namespace,key)
);

alter table products add column if not exists product_type text;
alter table products add column if not exists vendor text;
alter table products add column if not exists published_at timestamptz;
alter table products add column if not exists taxable boolean not null default true;
alter table products add column if not exists weight_grams integer;
alter table product_variants add column if not exists cost_price numeric(14,2);
alter table product_variants add column if not exists weight_grams integer;

create table if not exists product_tags (
  product_id uuid not null references products(id) on delete cascade,
  tag text not null,
  primary key(product_id,tag)
);

create table if not exists draft_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  status text not null default 'draft',
  currency text not null default 'PKR',
  email text,
  phone text,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  shipping_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  quote_expires_at timestamptz,
  converted_order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists draft_order_items (
  id uuid primary key default gen_random_uuid(),
  draft_order_id uuid not null references draft_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  title text not null,
  sku text,
  quantity integer not null check(quantity>0),
  unit_price numeric(14,2) not null check(unit_price>=0),
  line_total numeric(14,2) not null check(line_total>=0),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  code text not null,
  name text,
  kind text not null,
  value numeric(14,4) not null,
  applies_to text not null default 'order',
  product_ids uuid[] not null default '{}',
  collection_ids uuid[] not null default '{}',
  minimum_order numeric(14,2),
  usage_limit integer,
  usage_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  automatic boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(store_id,code)
);

create table if not exists discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references discount_codes(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
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
  created_at timestamptz not null default now()
);

create table if not exists shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references shipping_zones(id) on delete cascade,
  name text not null,
  rate_type text not null default 'flat',
  amount numeric(14,2) not null default 0,
  minimum_order numeric(14,2),
  maximum_order numeric(14,2),
  minimum_weight_grams integer,
  maximum_weight_grams integer,
  courier text,
  service_code text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tax_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  country text,
  region text,
  rate numeric(8,6) not null,
  inclusive boolean not null default false,
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  provider text not null,
  provider_transaction_id text,
  transaction_type text not null,
  status text not null,
  amount numeric(14,2) not null,
  currency text not null default 'PKR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  status text not null default 'requested',
  return_type text not null default 'return',
  reason text,
  refund_amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references returns(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete restrict,
  quantity integer not null check(quantity>0),
  disposition text not null default 'restock',
  exchange_variant_id uuid references product_variants(id) on delete set null,
  refund_amount numeric(14,2) not null default 0
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text,
  address_type text not null default 'shipping',
  is_default boolean not null default false,
  name text,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text,
  country text not null default 'Pakistan',
  created_at timestamptz not null default now()
);

create table if not exists customer_tags (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  unique(store_id,name)
);

create table if not exists customer_tag_links (
  customer_id uuid not null references customers(id) on delete cascade,
  tag_id uuid not null references customer_tags(id) on delete cascade,
  primary key(customer_id,tag_id)
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
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  status text not null default 'draft',
  currency text not null default 'PKR',
  subtotal numeric(14,2) not null default 0,
  expected_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete restrict,
  quantity integer not null check(quantity>0),
  received_quantity integer not null default 0 check(received_quantity>=0),
  unit_cost numeric(14,2) not null default 0
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  kind text not null,
  severity text not null default 'info',
  title text not null,
  message text,
  resource_type text,
  resource_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table orders add column if not exists discount_amount numeric(14,2) not null default 0;
alter table orders add column if not exists tax_amount numeric(14,2) not null default 0;
alter table orders add column if not exists discount_code text;
alter table orders add column if not exists fulfillment_location_id uuid references locations(id) on delete set null;
alter table orders add column if not exists gross_profit numeric(14,2);

create index if not exists inventory_levels_variant_idx on inventory_levels(variant_id);
create index if not exists resource_metafields_resource_idx on resource_metafields(store_id,resource_type,resource_id);
create index if not exists drafts_store_created_idx on draft_orders(store_id,created_at desc);
create index if not exists discounts_store_active_idx on discount_codes(store_id,active);
create index if not exists payment_tx_order_idx on payment_transactions(order_id,created_at desc);
create index if not exists returns_order_idx on returns(order_id,created_at desc);
create index if not exists customer_addresses_customer_idx on customer_addresses(customer_id);
create index if not exists purchase_orders_store_idx on purchase_orders(store_id,created_at desc);
create index if not exists audit_store_created_idx on audit_log(store_id,created_at desc);
create index if not exists notifications_store_read_idx on notifications(store_id,read_at,created_at desc);

-- Backend-only tables: defense-in-depth for Supabase Data API.
do $$ declare t text; begin
  foreach t in array array[
    'locations','inventory_levels','inventory_transfers','inventory_transfer_items',
    'metafield_definitions','resource_metafields','product_tags','draft_orders','draft_order_items',
    'discount_codes','discount_redemptions','shipping_zones','shipping_rates','tax_rules',
    'payment_transactions','returns','return_items','customer_addresses','customer_tags',
    'customer_tag_links','suppliers','purchase_orders','purchase_order_items','audit_log','notifications'
  ] loop
    execute format('alter table %I enable row level security',t);
    execute format('revoke all on table %I from anon, authenticated',t);
  end loop;
end $$;
