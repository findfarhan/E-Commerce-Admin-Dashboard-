-- Phase 3: variant-specific bundles, separately audited discount allocation.
-- Do not apply directly to production without migration review and backup.
create table if not exists jewelry_bundles(
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references stores(id) on delete cascade,
 handle text not null,
 title text not null,
 description text not null default '',
 status text not null default 'draft' check(status in ('draft','active','archived')),
 discount_kind text not null check(discount_kind in ('percentage','fixed')),
 discount_value numeric(14,2) not null check(discount_value>=0),
 starts_at timestamptz,
 ends_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id,handle),
 check(handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 check(char_length(title) between 2 and 150),
 check(starts_at is null or ends_at is null or starts_at<ends_at),
 check(discount_kind <> 'percentage' or discount_value<=100)
);
create table if not exists jewelry_bundle_components(
 id uuid primary key default gen_random_uuid(),
 bundle_id uuid not null references jewelry_bundles(id) on delete cascade,
 variant_id uuid not null references product_variants(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 25),
 position integer not null default 0,
 unique(bundle_id,variant_id)
);
create table if not exists checkout_bundle_allocations(
 id uuid primary key default gen_random_uuid(),
 checkout_id uuid not null references checkout_sessions(id) on delete cascade,
 bundle_id uuid not null references jewelry_bundles(id) on delete restrict,
 quantity integer not null check(quantity between 1 and 25),
 title_snapshot text not null,
 component_snapshot jsonb not null,
 gross_amount numeric(14,2) not null check(gross_amount>=0),
 discount_amount numeric(14,2) not null check(discount_amount>=0),
 created_at timestamptz not null default now()
);
create table if not exists order_bundle_allocations(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references orders(id) on delete cascade,
 bundle_id uuid references jewelry_bundles(id) on delete set null,
 title_snapshot text not null,
 component_snapshot jsonb not null,
 quantity integer not null check(quantity>0),
 gross_amount numeric(14,2) not null check(gross_amount>=0),
 discount_amount numeric(14,2) not null check(discount_amount>=0),
 created_at timestamptz not null default now()
);
alter table checkout_sessions add column if not exists bundle_discount_amount numeric(14,2) not null default 0;
alter table orders add column if not exists bundle_discount_amount numeric(14,2) not null default 0;
create index if not exists jewelry_bundles_store_status on jewelry_bundles(store_id,status,created_at desc);
create index if not exists jewelry_bundle_components_variant on jewelry_bundle_components(variant_id);
create index if not exists checkout_bundle_allocations_checkout on checkout_bundle_allocations(checkout_id);
create index if not exists order_bundle_allocations_order on order_bundle_allocations(order_id);
alter table jewelry_bundles enable row level security;
alter table jewelry_bundle_components enable row level security;
alter table checkout_bundle_allocations enable row level security;
alter table order_bundle_allocations enable row level security;
revoke all on jewelry_bundles,jewelry_bundle_components,checkout_bundle_allocations,order_bundle_allocations from anon,authenticated;
