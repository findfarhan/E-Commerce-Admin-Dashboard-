alter table products add column if not exists category text;
alter table products add column if not exists material text;
alter table products add column if not exists tag text;
alter table products add column if not exists featured boolean not null default false;

alter table product_media alter column master_object_key drop not null;
alter table product_media add column if not exists source_url text;
alter table product_media add column if not exists role text not null default 'gallery';

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  handle text not null,
  title text not null,
  subtitle text,
  description text,
  image_url text,
  status text not null default 'active',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,handle)
);

create table if not exists collection_products (
  collection_id uuid not null references collections(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  position integer not null default 0,
  primary key(collection_id,product_id)
);

alter table collections enable row level security;
alter table collection_products enable row level security;
revoke all on table collections from anon, authenticated;
revoke all on table collection_products from anon, authenticated;

create index if not exists collections_store_status_idx on collections(store_id,status,position);
create index if not exists collection_products_product_idx on collection_products(product_id);
