alter table checkout_sessions
  add column if not exists is_gift boolean not null default false,
  add column if not exists gift_message text;

alter table orders
  add column if not exists is_gift boolean not null default false,
  add column if not exists gift_message text;
