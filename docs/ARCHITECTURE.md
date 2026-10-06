# Architecture

## Current topology

Browser
  |
  +-- Admin UI (Vercel)
  |      |
  |      +-- /v1/admin/* -> Render API
  |
  +-- Jewelry Store (Vercel)
         |
         +-- /v1/storefront/* -> Render API

Render API
  |
  +-- Supabase PostgreSQL (canonical commerce data)
  +-- Postgres-backed operational jobs
  +-- existing source media URLs
  +-- optional external providers when credentials are connected

## Separation

The storefront is a presentation client. Its design can change completely without changing product identity, variants, orders, customers, media references or SEO records.

The admin is the operating interface. The Render API is the trusted boundary. Browsers never receive database credentials, admin API secrets, or future provider credentials.

## Media phase

Cloudflare R2 / Image Resizing is intentionally deferred. Current live catalog media uses provider-independent source URLs stored in `product_media`. When Cloudflare is enabled, the same product/media model can switch delivery providers without changing storefront contracts.

## Current single-store mode

The schema keeps `store_id` on commerce and operational records, but the current production UI is single-store and single-owner. No fake multi-user or multi-store state is presented.

## Later scale path

When more stores arrive:

1. add organization/membership authorization
2. keep store-scoped authorization around the existing `store_id` model
3. add dedicated workers when queue volume justifies it
4. move high-throughput queue workloads only when Postgres job throughput becomes a real constraint
5. partition event/order tables only after measured volume requires it
6. add per-store channel and provider rate limits

The canonical domain model does not need to be replaced.
