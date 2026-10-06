insert into seo_documents(store_id,resource_type,resource_id,locale,title,meta_description,canonical_path,robots_index,robots_follow,schema_type,metadata)
select p.store_id,'product',p.id,'en-PK',p.title||' | Jewelry Store',
  left(coalesce(nullif(p.description,''),'Discover '||p.title||' from Jewelry Store.'),155),
  '/product/'||p.handle,true,true,'Product','{}'::jsonb
from products p join stores s on s.id=p.store_id
where s.domain='jewelry-store-lime.vercel.app'
on conflict(store_id,resource_type,resource_id,locale)
do update set title=excluded.title,meta_description=excluded.meta_description,canonical_path=excluded.canonical_path,robots_index=true,robots_follow=true,schema_type='Product';

insert into seo_documents(store_id,resource_type,resource_id,locale,title,meta_description,canonical_path,robots_index,robots_follow,schema_type,metadata)
select c.store_id,'collection',c.id,'en-PK',c.title||' Jewelry | Jewelry Store',
  left(coalesce(nullif(c.description,''),nullif(c.subtitle,''),'Explore the '||c.title||' jewelry collection.'),155),
  '/collections/'||c.handle,true,true,'CollectionPage','{}'::jsonb
from collections c join stores s on s.id=c.store_id
where s.domain='jewelry-store-lime.vercel.app'
on conflict(store_id,resource_type,resource_id,locale)
do update set title=excluded.title,meta_description=excluded.meta_description,canonical_path=excluded.canonical_path,robots_index=true,robots_follow=true,schema_type='CollectionPage';
