alter table product_media
  add column if not exists storage_provider text not null default 'cloudflare-r2',
  add column if not exists storage_bucket text,
  add column if not exists external_asset_id text;

update product_media
set storage_provider='external-url'
where master_object_key is null
  and source_url is not null
  and storage_provider='cloudflare-r2';

create index if not exists product_media_storage_provider_idx
  on product_media(storage_provider,product_id);
