create unique index if not exists customers_store_email_unique
  on customers(store_id,lower(email))
  where email is not null and trim(email)<>'';
