-- Payment provider idempotency and lookup hardening.
create unique index if not exists payment_transactions_provider_ref_uidx
  on payment_transactions(store_id,provider,provider_transaction_id)
  where provider_transaction_id is not null and trim(provider_transaction_id)<>'';

create index if not exists return_items_order_item_idx on return_items(order_item_id);
create index if not exists discount_redemptions_customer_idx on discount_redemptions(customer_id,created_at desc);
