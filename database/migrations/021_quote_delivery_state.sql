alter table draft_orders add column if not exists quote_sent_at timestamptz;
create index if not exists draft_orders_quote_status_idx on draft_orders(store_id,status,quote_sent_at);
