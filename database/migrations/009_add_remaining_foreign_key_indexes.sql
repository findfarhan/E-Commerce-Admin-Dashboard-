create index if not exists checkout_lines_product_id_idx on checkout_lines(product_id);
create index if not exists checkout_sessions_completed_order_id_idx on checkout_sessions(completed_order_id);
create index if not exists inventory_movements_store_id_idx on inventory_movements(store_id);
create index if not exists order_items_product_id_idx on order_items(product_id);
