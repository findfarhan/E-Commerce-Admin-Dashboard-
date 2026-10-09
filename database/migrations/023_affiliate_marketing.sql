-- Affiliate marketing v1. No changes to pre-existing orders, stock, or payments.
-- Accounts are existing authenticated storefront accounts. Payment transfers remain manual.
create table if not exists affiliate_program_settings (
  store_id uuid primary key references stores(id) on delete cascade,
  enabled boolean not null default false,
  default_rate numeric(5,2) not null default 10.00 check(default_rate between 0 and 30),
  cookie_days integer not null default 30 check(cookie_days between 1 and 90),
  hold_days integer not null default 14 check(hold_days between 0 and 90),
  min_payout numeric(12,2) not null default 2000 check(min_payout >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  account_id uuid not null references storefront_accounts(id) on delete cascade,
  code text not null check(code ~ '^[A-Z0-9]{5,20}$'),
  status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
  rate numeric(5,2) not null default 10 check(rate between 0 and 30),
  channel_name text,
  channel_url text,
  notes text,
  payout_method text check(payout_method in ('bank','jazzcash','easypaisa')),
  payout_recipient text,
  payout_destination text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(store_id,account_id),
  unique(store_id,code)
);
create index if not exists affiliates_store_status_idx on affiliates(store_id,status,created_at desc);

create table if not exists affiliate_visits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  token_hash text not null unique,
  landing_path text not null default '/collections',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint affiliate_visit_expiry_check check(expires_at > created_at)
);
create index if not exists affiliate_visits_partner_idx on affiliate_visits(affiliate_id,created_at desc);

create table if not exists affiliate_checkout_attributions (
  checkout_id uuid primary key references checkout_sessions(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  visit_id uuid not null references affiliate_visits(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_attributions_partner_idx on affiliate_checkout_attributions(affiliate_id,created_at desc);

create table if not exists affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  order_id uuid not null unique references orders(id) on delete cascade,
  checkout_id uuid not null unique references checkout_sessions(id) on delete cascade,
  rate numeric(5,2) not null check(rate between 0 and 30),
  basis_amount numeric(12,2) not null check(basis_amount >= 0),
  amount numeric(12,2) not null check(amount >= 0),
  currency text not null default 'PKR',
  status text not null default 'pending' check(status in ('pending','approved','paid','reversed','reversal_due')),
  eligible_at timestamptz not null,
  approved_at timestamptz,
  paid_at timestamptz,
  reversed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_commissions_partner_status_idx on affiliate_commissions(affiliate_id,status,created_at desc);
create index if not exists affiliate_commissions_store_status_idx on affiliate_commissions(store_id,status,created_at desc);

create table if not exists affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  amount numeric(12,2) not null check(amount > 0),
  currency text not null default 'PKR',
  method text not null check(method in ('bank','jazzcash','easypaisa')),
  transfer_reference text not null,
  recipient_snapshot text not null,
  destination_last4 text not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(store_id,method,transfer_reference)
);
create index if not exists affiliate_payouts_partner_idx on affiliate_payouts(affiliate_id,recorded_at desc);

create table if not exists affiliate_payout_items (
  payout_id uuid not null references affiliate_payouts(id) on delete restrict,
  commission_id uuid not null unique references affiliate_commissions(id) on delete restrict,
  amount numeric(12,2) not null check(amount > 0),
  primary key(payout_id,commission_id)
);

-- All affiliate data is accessed only through server-side NestJS API with
-- app-level account/admin authorization; no public Supabase Data API exposure.
do $$
declare t text;
begin
  foreach t in array array[
    'affiliate_program_settings','affiliates','affiliate_visits',
    'affiliate_checkout_attributions','affiliate_commissions',
    'affiliate_payouts','affiliate_payout_items'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    if exists(select 1 from pg_roles where rolname='anon') then
      execute format('revoke all on table public.%I from anon',t);
    end if;
    if exists(select 1 from pg_roles where rolname='authenticated') then
      execute format('revoke all on table public.%I from authenticated',t);
    end if;
    if exists(select 1 from pg_roles where rolname='render_app') then
      execute format('grant select,insert,update,delete on table public.%I to render_app',t);
    end if;
  end loop;
end $$;
