-- Seed the first Jewelry Store catalog with a real visual-option variant matrix.
-- This migration is idempotent for option/media-set creation and rebuilds Celestia's seeded variants.

insert into product_options(product_id,name,position,is_visual)
select p.id,'Metal',0,true from products p join stores s on s.id=p.store_id
where s.domain='jewelry-store-lime.vercel.app' and p.handle='celestia-ring'
and not exists(select 1 from product_options o where o.product_id=p.id and o.name='Metal');

insert into product_options(product_id,name,position,is_visual)
select p.id,'Stone',1,true from products p join stores s on s.id=p.store_id
where s.domain='jewelry-store-lime.vercel.app' and p.handle='celestia-ring'
and not exists(select 1 from product_options o where o.product_id=p.id and o.name='Stone');

insert into product_options(product_id,name,position,is_visual)
select p.id,'Size',2,false from products p join stores s on s.id=p.store_id
where s.domain='jewelry-store-lime.vercel.app' and p.handle='celestia-ring'
and not exists(select 1 from product_options o where o.product_id=p.id and o.name='Size');

insert into product_option_values(option_id,value,position,swatch_color)
select o.id,v.value,v.position,v.color
from product_options o join products p on p.id=o.product_id
cross join (values ('Yellow Gold',0,'#D8B56A'),('White Gold',1,'#D8DCE3'),('Rose Gold',2,'#D9A093')) v(value,position,color)
where p.handle='celestia-ring' and o.name='Metal'
and not exists(select 1 from product_option_values x where x.option_id=o.id and x.value=v.value);

insert into product_option_values(option_id,value,position,swatch_color)
select o.id,v.value,v.position,v.color
from product_options o join products p on p.id=o.product_id
cross join (values ('Diamond',0,'#EAF7FF'),('Emerald',1,'#14885F')) v(value,position,color)
where p.handle='celestia-ring' and o.name='Stone'
and not exists(select 1 from product_option_values x where x.option_id=o.id and x.value=v.value);

insert into product_option_values(option_id,value,position)
select o.id,v.value,v.position
from product_options o join products p on p.id=o.product_id
cross join (values ('5',0),('6',1),('7',2),('8',3),('9',4)) v(value,position)
where p.handle='celestia-ring' and o.name='Size'
and not exists(select 1 from product_option_values x where x.option_id=o.id and x.value=v.value);

insert into product_media_sets(product_id,name,match_options,is_default)
select p.id,v.name,v.match_options::jsonb,v.is_default
from products p join stores s on s.id=p.store_id
cross join (values
 ('Yellow Gold + Diamond','{"Metal":"Yellow Gold","Stone":"Diamond"}',true),
 ('White Gold + Diamond','{"Metal":"White Gold","Stone":"Diamond"}',false),
 ('Rose Gold + Diamond','{"Metal":"Rose Gold","Stone":"Diamond"}',false),
 ('Yellow Gold + Emerald','{"Metal":"Yellow Gold","Stone":"Emerald"}',false),
 ('White Gold + Emerald','{"Metal":"White Gold","Stone":"Emerald"}',false),
 ('Rose Gold + Emerald','{"Metal":"Rose Gold","Stone":"Emerald"}',false)
) v(name,match_options,is_default)
where s.domain='jewelry-store-lime.vercel.app' and p.handle='celestia-ring'
and not exists(select 1 from product_media_sets ms where ms.product_id=p.id and ms.name=v.name);

delete from variant_option_values
where variant_id in (select v.id from product_variants v join products p on p.id=v.product_id where p.handle='celestia-ring');

delete from product_variants
where product_id in (select id from products where handle='celestia-ring');

insert into product_variants(product_id,sku,price,inventory,status,media_set_id)
select p.id,'CEL-'||m.code||'-'||st.code||'-'||sz.value,
  case when st.value='Emerald' then 92000 else 78000 end,
  greatest(1,10-sz.value::int-(case when st.value='Emerald' then 2 else 0 end)),
  'active',ms.id
from products p join stores s on s.id=p.store_id
cross join (values ('Yellow Gold','YG'),('White Gold','WG'),('Rose Gold','RG')) m(value,code)
cross join (values ('Diamond','DIA'),('Emerald','EMR')) st(value,code)
cross join (values ('5'),('6'),('7'),('8'),('9')) sz(value)
join product_media_sets ms on ms.product_id=p.id
 and ms.match_options->>'Metal'=m.value and ms.match_options->>'Stone'=st.value
where s.domain='jewelry-store-lime.vercel.app' and p.handle='celestia-ring';

insert into variant_option_values(variant_id,option_value_id)
select v.id,ov.id
from product_variants v join products p on p.id=v.product_id
join product_options o on o.product_id=p.id and o.name='Metal'
join product_option_values ov on ov.option_id=o.id
where p.handle='celestia-ring'
and ((v.sku like 'CEL-YG-%' and ov.value='Yellow Gold')
  or (v.sku like 'CEL-WG-%' and ov.value='White Gold')
  or (v.sku like 'CEL-RG-%' and ov.value='Rose Gold'));

insert into variant_option_values(variant_id,option_value_id)
select v.id,ov.id
from product_variants v join products p on p.id=v.product_id
join product_options o on o.product_id=p.id and o.name='Stone'
join product_option_values ov on ov.option_id=o.id
where p.handle='celestia-ring'
and ((v.sku like '%-DIA-%' and ov.value='Diamond')
  or (v.sku like '%-EMR-%' and ov.value='Emerald'));

insert into variant_option_values(variant_id,option_value_id)
select v.id,ov.id
from product_variants v join products p on p.id=v.product_id
join product_options o on o.product_id=p.id and o.name='Size'
join product_option_values ov on ov.option_id=o.id
where p.handle='celestia-ring' and split_part(v.sku,'-',4)=ov.value;

update product_media pm
set media_set_id=ms.id
from products p,product_media_sets ms
where pm.product_id=p.id and ms.product_id=p.id and p.handle='celestia-ring'
  and ms.name='Yellow Gold + Diamond' and pm.media_set_id is null;

delete from collection_products
where collection_id in (
  select c.id from collections c join stores s on s.id=c.store_id
  where s.domain='jewelry-store-lime.vercel.app'
);

insert into collection_products(collection_id,product_id,position)
select c.id,p.id,x.position
from collections c join stores s on s.id=c.store_id
join (values
 ('bridal','celestia-ring',0),('bridal','noor-earrings',1),('bridal','aurelia-pendant',2),('bridal','sahar-ring',3),
 ('everyday','luma-hoops',0),('everyday','solace-chain',1),('everyday','nova-band',2),
 ('gemstone','sahar-ring',0),('gemstone','vela-gem-ring',1),('gemstone','celestia-ring',2),
 ('gifts','aurelia-pendant',0),('gifts','noor-earrings',1),('gifts','luma-hoops',2),('gifts','solace-chain',3)
) x(collection_handle,product_handle,position) on x.collection_handle=c.handle
join products p on p.store_id=c.store_id and p.handle=x.product_handle
where s.domain='jewelry-store-lime.vercel.app'
on conflict(collection_id,product_id) do update set position=excluded.position;
