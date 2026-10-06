create unique index if not exists customers_store_email_unique
  on customers(store_id, lower(email))
  where email is not null and email <> '';

alter table checkout_sessions
  add column if not exists shipping_address jsonb not null default '{}'::jsonb,
  add column if not exists billing_address jsonb not null default '{}'::jsonb,
  add column if not exists shipping_method text,
  add column if not exists shipping_amount numeric(14,2) not null default 0,
  add column if not exists payment_method text not null default 'cod',
  add column if not exists payment_reference text,
  add column if not exists completed_order_id uuid references orders(id) on delete set null;

alter table orders
  add column if not exists shipping_address jsonb not null default '{}'::jsonb,
  add column if not exists billing_address jsonb not null default '{}'::jsonb,
  add column if not exists shipping_method text,
  add column if not exists shipping_amount numeric(14,2) not null default 0,
  add column if not exists payment_method text,
  add column if not exists fulfillment_status text not null default 'unfulfilled',
  add column if not exists notes text;

create sequence if not exists jewelry_order_number_seq start 2049;

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  movement_type text not null,
  quantity_delta integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  reason text,
  actor text,
  created_at timestamptz not null default now()
);

create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  note text not null,
  author text,
  created_at timestamptz not null default now()
);

alter table inventory_movements enable row level security;
alter table order_events enable row level security;
alter table customer_notes enable row level security;

revoke all on table inventory_movements from anon, authenticated;
revoke all on table order_events from anon, authenticated;
revoke all on table customer_notes from anon, authenticated;

create index if not exists inventory_movements_variant_idx on inventory_movements(variant_id,created_at desc);
create index if not exists inventory_movements_order_idx on inventory_movements(order_id);
create index if not exists order_events_order_idx on order_events(order_id,created_at);
create index if not exists customer_notes_customer_idx on customer_notes(customer_id,created_at desc);
