-- Phase 5: privacy-aware cart analytics and explicitly opted-in checkout recovery.
-- Additive migration; no legacy order mutation. No default outreach consent.
create table if not exists analytics_events(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  event_id uuid not null,
  anonymous_session_id uuid not null,
  event_type text not null check(event_type in ('page_view','product_view','add_to_cart','gift_finder_opened','gift_finder_results','bundle_viewed')),
  product_handle text,
  page_path text,
  source_channel text not null default 'direct' check(source_channel in ('direct','instagram','facebook','google','other')),
  device_type text not null default 'unknown' check(device_type in ('mobile','desktop','tablet','unknown')),
  occurred_at timestamptz not null default now(),
  unique(store_id,event_id),
  check(product_handle is null or (char_length(product_handle)<=120 and product_handle ~ '^[a-z0-9-]+$')),
  check(page_path is null or (length(page_path)<=160 and left(page_path,1)='/'))
);
create index if not exists analytics_events_store_date_idx on analytics_events(store_id,occurred_at desc);
create index if not exists analytics_events_session_idx on analytics_events(store_id,anonymous_session_id,occurred_at desc);

alter table checkout_sessions add column if not exists analytics_session_id uuid;
alter table checkout_sessions add column if not exists recovered_from_checkout_id uuid references checkout_sessions(id) on delete set null;

create table if not exists checkout_recoveries(
 checkout_id uuid primary key references checkout_sessions(id) on delete cascade,
 store_id uuid not null references stores(id) on delete cascade,
 email_snapshot text not null,
 consent_at timestamptz not null,
 consent_version text not null default 'v1',
 status text not null default 'pending' check(status in ('pending','recovered','suppressed')),
 next_send_at timestamptz,
 send_step smallint not null default 0 check(send_step between 0 and 3),
 last_sent_at timestamptz,
 recovered_order_id uuid references orders(id) on delete set null,
 recovered_checkout_id uuid references checkout_sessions(id) on delete set null,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(length(email_snapshot) between 3 and 254)
);
create index if not exists checkout_recoveries_due_idx on checkout_recoveries(next_send_at,checkout_id) where status='pending' and send_step<3;

create table if not exists checkout_recovery_optouts(
 store_id uuid not null references stores(id) on delete cascade,
 email_digest text not null,
 opted_out_at timestamptz not null default now(),
 primary key(store_id,email_digest)
);
create table if not exists checkout_recovery_attempts(
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references stores(id) on delete cascade,
 checkout_id uuid not null references checkout_sessions(id) on delete cascade,
 step smallint not null check(step between 1 and 3),
 status text not null default 'claimed' check(status in ('claimed','sent','failed','skipped')),
 attempted_at timestamptz not null default now(),
 completed_at timestamptz,
 provider_message_id text,
 error_text text,
 unique(checkout_id,step)
);
create index if not exists checkout_recovery_attempts_store_idx on checkout_recovery_attempts(store_id,attempted_at desc);

alter table analytics_events enable row level security;
alter table checkout_recoveries enable row level security;
alter table checkout_recovery_optouts enable row level security;
alter table checkout_recovery_attempts enable row level security;
revoke all on analytics_events,checkout_recoveries,checkout_recovery_optouts,checkout_recovery_attempts from anon,authenticated;
grant select,insert,update,delete on analytics_events,checkout_recoveries,checkout_recovery_optouts,checkout_recovery_attempts to render_app;
