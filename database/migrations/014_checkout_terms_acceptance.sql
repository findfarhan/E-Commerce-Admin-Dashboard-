alter table checkout_sessions
  add column if not exists terms_accepted_at timestamptz;

alter table orders
  add column if not exists terms_accepted_at timestamptz;
