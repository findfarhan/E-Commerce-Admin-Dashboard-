create extension if not exists pgcrypto;

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  currency text not null default 'PKR',
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  handle text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,handle)
);

create table if not exists product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  position integer not null,
  is_visual boolean not null default false
);

create table if not exists product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references product_options(id) on delete cascade,
  value text not null,
  position integer not null,
  swatch_color text,
  swatch_media_id uuid
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null,
  price numeric(14,2) not null,
  compare_at_price numeric(14,2),
  inventory integer not null default 0,
  status text not null default 'active',
  media_set_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,sku)
);

create table if not exists variant_option_values (
  variant_id uuid not null references product_variants(id) on delete cascade,
  option_value_id uuid not null references product_option_values(id) on delete cascade,
  primary key(variant_id,option_value_id)
);

create table if not exists product_media_sets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  match_options jsonb not null default '{}'::jsonb,
  is_default boolean not null default false
);

alter table product_variants
  add constraint product_variants_media_set_fk
  foreign key(media_set_id) references product_media_sets(id) on delete set null;

create table if not exists product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  media_set_id uuid references product_media_sets(id) on delete set null,
  master_object_key text not null,
  mime_type text not null,
  width integer,
  height integer,
  focal_x numeric(5,4) not null default .5,
  focal_y numeric(5,4) not null default .5,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists media_renditions (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references product_media(id) on delete cascade,
  preset text not null,
  format text not null,
  object_key text not null,
  width integer not null,
  height integer not null,
  bytes bigint,
  status text not null default 'queued',
  unique(media_id,preset,format)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  email text,
  name text,
  phone text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  order_number text not null,
  status text not null,
  payment_status text not null,
  currency text not null default 'PKR',
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  source_channel text not null default 'online_store',
  external_id text,
  created_at timestamptz not null default now(),
  unique(store_id,order_number)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  channel text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  kind text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists seo_documents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  resource_type text not null,
  resource_id uuid,
  locale text not null default 'en-PK',
  title text,
  meta_description text,
  canonical_path text not null,
  robots_index boolean not null default true,
  robots_follow boolean not null default true,
  schema_type text,
  metadata jsonb not null default '{}'::jsonb,
  unique(store_id,resource_type,resource_id,locale)
);

create table if not exists url_redirects (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  source_path text not null,
  target_path text not null,
  status_code integer not null default 301,
  enabled boolean not null default true,
  unique(store_id,source_path)
);

create table if not exists sales_channels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  channel_key text not null,
  name text not null,
  channel_type text not null,
  status text not null default 'disconnected',
  external_account_id text,
  settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  unique(store_id,channel_key)
);

create table if not exists channel_publications (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references sales_channels(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  status text not null default 'draft',
  external_id text,
  title_override text,
  description_override text,
  external_category_id text,
  price_override numeric(14,2),
  media_set_id uuid references product_media_sets(id) on delete set null,
  sync_status text not null default 'not_synced',
  sync_error text,
  last_sync_at timestamptz,
  unique(channel_id,product_id)
);

create table if not exists external_resource_mappings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  channel_id uuid not null references sales_channels(id) on delete cascade,
  resource_type text not null,
  internal_id uuid not null,
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(channel_id,resource_type,external_id)
);

create table if not exists seo_work_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  pillar text not null,
  title text not null,
  reason text,
  priority text not null default 'medium',
  status text not null default 'open',
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists entity_facts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  field text not null,
  value text,
  source_type text,
  source_url text,
  verified boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists authority_mentions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  source text not null,
  mention_type text not null,
  url text,
  status text not null default 'prospect',
  quality text,
  metadata jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now()
);

create index if not exists products_store_status_idx on products(store_id,status);
create index if not exists variants_product_idx on product_variants(product_id);
create index if not exists media_product_idx on product_media(product_id,position);
create index if not exists orders_store_created_idx on orders(store_id,created_at desc);
create index if not exists customers_store_email_idx on customers(store_id,email);
create index if not exists jobs_ready_idx on jobs(status,available_at);
create index if not exists channel_publications_sync_idx on channel_publications(channel_id,sync_status);
