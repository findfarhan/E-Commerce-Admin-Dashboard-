# Architecture

## Phase 1 topology

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
  +-- PostgreSQL
  +-- Cloudflare R2
  +-- Postgres job queue
  +-- external channels/connectors

## Separation

The storefront is a presentation client. Its design can change completely without changing product identity, variants, orders, customers, media or SEO records.

The admin is the operating interface. The Render API is the trusted boundary. Browsers never receive database or R2 secret credentials.

## Later scale path

When more stores arrive:

1. keep store_id on commerce records
2. add organization/membership authorization
3. add dedicated workers
4. move job queue to Redis/Key Value only when load justifies it
5. partition high-volume event/order tables if necessary
6. add per-store channel rate limits

The canonical domain model does not need to be replaced.
