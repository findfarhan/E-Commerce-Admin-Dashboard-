alter table admin_users add column if not exists password_hash text;
alter table admin_users add column if not exists updated_at timestamptz not null default now();

insert into admin_roles(store_id,name,permissions)
select s.id,r.name,r.permissions
from stores s
cross join (values
  ('Owner',array['*']::text[]),
  ('Manager',array['dashboard','catalog','orders','inventory','crm','marketing','analytics']::text[]),
  ('Catalog Manager',array['dashboard','catalog']::text[]),
  ('Fulfillment',array['dashboard','orders','inventory']::text[]),
  ('Customer Support',array['dashboard','orders','crm']::text[]),
  ('Marketing',array['dashboard','catalog','marketing','analytics']::text[]),
  ('Read Only',array['dashboard','read']::text[])
) as r(name,permissions)
on conflict(store_id,name) do update set permissions=excluded.permissions;

create index if not exists admin_users_store_status_idx on admin_users(store_id,status);
create index if not exists admin_roles_store_name_idx on admin_roles(store_id,name);