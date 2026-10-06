alter table products
  add constraint products_status_check check (status in ('draft','active','archived')) not valid;
alter table product_variants
  add constraint product_variants_status_check check (status in ('active','draft')) not valid,
  add constraint product_variants_price_check check (price >= 0) not valid,
  add constraint product_variants_compare_at_price_check check (compare_at_price is null or compare_at_price >= 0) not valid,
  add constraint product_variants_inventory_check check (inventory >= 0) not valid;
alter table collections
  add constraint collections_status_check check (status in ('active','draft','archived')) not valid;
alter table checkout_sessions
  add constraint checkout_sessions_status_check check (status in ('open','completed','expired')) not valid,
  add constraint checkout_sessions_subtotal_check check (subtotal >= 0) not valid,
  add constraint checkout_sessions_shipping_amount_check check (shipping_amount >= 0) not valid;
alter table checkout_lines
  add constraint checkout_lines_unit_price_check check (unit_price >= 0) not valid,
  add constraint checkout_lines_line_total_check check (line_total >= 0) not valid;
alter table orders
  add constraint orders_status_check check (status in ('confirmed','processing','completed','canceled')) not valid,
  add constraint orders_payment_status_check check (payment_status in ('pending','paid','refunded','failed')) not valid,
  add constraint orders_fulfillment_status_check check (fulfillment_status in ('unfulfilled','processing','fulfilled','returned')) not valid,
  add constraint orders_subtotal_check check (subtotal >= 0) not valid,
  add constraint orders_shipping_amount_check check (shipping_amount >= 0) not valid,
  add constraint orders_total_check check (total >= 0) not valid;
alter table order_items
  add constraint order_items_unit_price_check check (unit_price >= 0) not valid,
  add constraint order_items_line_total_check check (line_total >= 0) not valid;
alter table custom_commission_requests
  add constraint custom_commission_requests_status_check check (status in ('new','contacted','qualified','won','closed')) not valid;
alter table newsletter_subscribers
  add constraint newsletter_subscribers_status_check check (status in ('subscribed','unsubscribed')) not valid;

alter table products validate constraint products_status_check;
alter table product_variants validate constraint product_variants_status_check;
alter table product_variants validate constraint product_variants_price_check;
alter table product_variants validate constraint product_variants_compare_at_price_check;
alter table product_variants validate constraint product_variants_inventory_check;
alter table collections validate constraint collections_status_check;
alter table checkout_sessions validate constraint checkout_sessions_status_check;
alter table checkout_sessions validate constraint checkout_sessions_subtotal_check;
alter table checkout_sessions validate constraint checkout_sessions_shipping_amount_check;
alter table checkout_lines validate constraint checkout_lines_unit_price_check;
alter table checkout_lines validate constraint checkout_lines_line_total_check;
alter table orders validate constraint orders_status_check;
alter table orders validate constraint orders_payment_status_check;
alter table orders validate constraint orders_fulfillment_status_check;
alter table orders validate constraint orders_subtotal_check;
alter table orders validate constraint orders_shipping_amount_check;
alter table orders validate constraint orders_total_check;
alter table order_items validate constraint order_items_unit_price_check;
alter table order_items validate constraint order_items_line_total_check;
alter table custom_commission_requests validate constraint custom_commission_requests_status_check;
alter table newsletter_subscribers validate constraint newsletter_subscribers_status_check;
