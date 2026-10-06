create table if not exists custom_commission_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  signal text,
  preferred_material text,
  budget_range text,
  timeline text,
  notes text not null,
  status text not null default 'new',
  source text not null default 'storefront',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  email text not null,
  status text not null default 'subscribed',
  source text not null default 'storefront',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_store_email_unique
  on newsletter_subscribers(store_id,lower(email));
create index if not exists custom_commission_requests_store_status_idx
  on custom_commission_requests(store_id,status,created_at desc);
create index if not exists newsletter_subscribers_store_status_idx
  on newsletter_subscribers(store_id,status,created_at desc);

alter table custom_commission_requests enable row level security;
alter table newsletter_subscribers enable row level security;
revoke all on table custom_commission_requests from anon,authenticated;
revoke all on table newsletter_subscribers from anon,authenticated;
