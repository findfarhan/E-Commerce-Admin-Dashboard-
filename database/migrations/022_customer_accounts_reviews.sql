-- Independent storefront customer identity. Guest checkout/customer records remain unchanged.
-- A customer must explicitly claim an order with order number + matching email + phone;
-- registration alone never exposes historic guest orders.
create table if not exists storefront_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  email text not null,
  password_hash text not null,
  display_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,email),
  constraint storefront_accounts_email_lower_check check (email=lower(trim(email)))
);

create table if not exists storefront_account_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references storefront_accounts(id) on delete cascade,
  token_digest text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists storefront_sessions_account_idx on storefront_account_sessions(account_id,expires_at);

create table if not exists storefront_account_addresses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references storefront_accounts(id) on delete cascade,
  label text not null default 'Home',
  recipient text not null,
  phone text,
  line1 text not null,
  line2 text not null default '',
  city text not null,
  region text not null default '',
  postal_code text not null default '',
  country text not null default 'Pakistan',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists storefront_addresses_account_idx on storefront_account_addresses(account_id,created_at desc);
create unique index if not exists storefront_addresses_one_default_idx on storefront_account_addresses(account_id) where is_default;

create table if not exists storefront_account_orders (
  account_id uuid not null references storefront_accounts(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key(account_id,order_id),
  unique(order_id)
);
create index if not exists storefront_account_orders_order_idx on storefront_account_orders(order_id);

create table if not exists storefront_product_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  account_id uuid not null references storefront_accounts(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  title text not null,
  body text not null,
  status text not null default 'published' check(status in ('published','hidden')),
  verified_purchase boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,account_id)
);
create index if not exists storefront_reviews_product_status_idx on storefront_product_reviews(product_id,status,created_at desc);

do $$
declare t text;
begin
  foreach t in array array['storefront_accounts','storefront_account_sessions',
    'storefront_account_addresses','storefront_account_orders','storefront_product_reviews'] loop
    execute format('alter table %I enable row level security',t);
    execute format('revoke all on table %I from anon, authenticated',t);
    if exists(select 1 from pg_roles where rolname='render_app') then
      execute format('grant select,insert,update,delete on table %I to render_app',t);
    end if;
  end loop;
end $$;
