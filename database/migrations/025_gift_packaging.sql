-- Phase 4: paid/free gift packaging options with independent physical SKU stock.
-- Apply after migration 024; never auto-execute against production during development.
create table if not exists gift_packaging_options(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  sku text not null,
  title text not null,
  description text not null default '',
  image_url text,
  price numeric(14,2) not null default 0 check(price >= 0),
  inventory integer not null default 0 check(inventory >= 0),
  weight_grams integer not null default 0 check(weight_grams >= 0),
  taxable boolean not null default false,
  status text not null default 'draft' check(status in ('draft','active','archived')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,sku),
  check(length(trim(sku)) between 2 and 80),
  check(length(trim(title)) between 2 and 130),
  check(length(description) <= 1200)
);
alter table checkout_sessions add column if not exists gift_packaging_id uuid references gift_packaging_options(id) on delete set null;
alter table checkout_sessions add column if not exists gift_packaging_price numeric(14,2) not null default 0;
alter table checkout_sessions add column if not exists gift_packaging_sku_snapshot text;
alter table checkout_sessions add column if not exists gift_packaging_title_snapshot text;
alter table orders add column if not exists gift_packaging_id uuid references gift_packaging_options(id) on delete set null;
alter table orders add column if not exists gift_packaging_price numeric(14,2) not null default 0;
alter table orders add column if not exists gift_packaging_sku_snapshot text;
alter table orders add column if not exists gift_packaging_title_snapshot text;
create table if not exists gift_packaging_movements(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  gift_packaging_id uuid not null references gift_packaging_options(id) on delete restrict,
  order_id uuid not null references orders(id) on delete cascade,
  movement_type text not null check(movement_type in ('order_sale','order_cancel')),
  quantity_delta integer not null check(quantity_delta in (-1,1)),
  quantity_before integer not null check(quantity_before>=0),
  quantity_after integer not null check(quantity_after>=0),
  actor text not null default 'checkout',
  created_at timestamptz not null default now(),
  unique(order_id,gift_packaging_id,movement_type)
);
create index if not exists gift_packaging_store_status on gift_packaging_options(store_id,status,position);
create index if not exists gift_packaging_movements_order on gift_packaging_movements(order_id);
alter table gift_packaging_options enable row level security;
alter table gift_packaging_movements enable row level security;
revoke all on gift_packaging_options,gift_packaging_movements from anon,authenticated;
