alter table product_media_sets
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists product_media_sets_product_default_created_idx
  on product_media_sets(product_id,is_default desc,created_at);
