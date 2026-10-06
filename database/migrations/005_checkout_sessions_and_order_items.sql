create table if not exists checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  status text not null default 'open',
  currency text not null default 'PKR',
  subtotal numeric(14,2) not null default 0,
  customer_email text,
  customer_name text,
  customer_phone text,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists checkout_lines (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references checkout_sessions(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  variant_id uuid not null references product_variants(id) on delete restrict,
  sku_snapshot text not null,
  title_snapshot text not null,
  selected_options jsonb not null default '{}'::jsonb,
  quantity integer not null check(quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  sku text not null,
  title text not null,
  selected_options jsonb not null default '{}'::jsonb,
  quantity integer not null check(quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);

alter table checkout_sessions enable row level security;
alter table checkout_lines enable row level security;
alter table order_items enable row level security;

revoke all on table checkout_sessions from anon, authenticated;
revoke all on table checkout_lines from anon, authenticated;
revoke all on table order_items from anon, authenticated;

create index if not exists checkout_sessions_store_status_idx on checkout_sessions(store_id,status,created_at desc);
create index if not exists checkout_lines_checkout_idx on checkout_lines(checkout_id);
create index if not exists checkout_lines_variant_idx on checkout_lines(variant_id);
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists order_items_variant_idx on order_items(variant_id);
