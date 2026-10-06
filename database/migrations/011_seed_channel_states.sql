insert into sales_channels(store_id,channel_key,name,channel_type,status,external_account_id,settings,last_sync_at)
select
  s.id,
  x.channel_key,
  x.name,
  x.channel_type,
  x.status,
  null,
  x.settings::jsonb,
  case when x.channel_key='storefront' then now() else null end
from stores s
cross join (values
  ('storefront','Online Store','storefront','connected','{"capabilities":["catalog","variants","inventory","checkout","seo"]}'),
  ('google_merchant','Google Merchant','feed','not_connected','{"capabilities":["catalog_feed","shopping"]}'),
  ('meta_catalog','Meta Catalog','social','not_connected','{"capabilities":["catalog","instagram","facebook"]}'),
  ('whatsapp','WhatsApp Business','messaging','not_connected','{"capabilities":["catalog","messaging"]}'),
  ('email','Email','messaging','not_connected','{"capabilities":["transactional","campaigns"]}')
) as x(channel_key,name,channel_type,status,settings)
where not exists(
  select 1
  from sales_channels sc
  where sc.store_id=s.id and sc.channel_key=x.channel_key
);
