alter table checkout_sessions add column if not exists discount_code text;
alter table checkout_sessions add column if not exists discount_amount numeric(14,2) not null default 0;
alter table checkout_sessions add column if not exists tax_amount numeric(14,2) not null default 0;
alter table checkout_sessions add column if not exists total numeric(14,2);

alter table collections add column if not exists collection_type text not null default 'manual';
alter table collections add column if not exists rules jsonb not null default '[]'::jsonb;
alter table collections add column if not exists match_type text not null default 'all';
alter table collections add column if not exists publish_at timestamptz;
alter table collections add column if not exists unpublish_at timestamptz;
alter table collections add column if not exists merchandising jsonb not null default '{}'::jsonb;

create table if not exists admin_roles(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(store_id,name)
);
create table if not exists admin_users(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  external_user_id uuid,
  email text not null,
  name text,
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(store_id,email)
);
create table if not exists admin_user_roles(
  user_id uuid not null references admin_users(id) on delete cascade,
  role_id uuid not null references admin_roles(id) on delete cascade,
  primary key(user_id,role_id)
);
create table if not exists message_outbox(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  channel text not null,
  template_key text,
  recipient text not null,
  subject text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  provider text,
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists message_outbox_ready_idx on message_outbox(status,available_at);
do $$ declare t text; begin
  foreach t in array array['admin_roles','admin_users','admin_user_roles','message_outbox'] loop
    execute format('alter table %I enable row level security',t);
    execute format('revoke all on table %I from anon, authenticated',t);
  end loop;
end $$;