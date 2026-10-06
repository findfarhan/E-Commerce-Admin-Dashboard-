alter table custom_commission_requests
  add column if not exists reference_url text;
