# Production status

## Working core

- NestJS + Fastify API on Render
- Supabase PostgreSQL canonical commerce database
- Vercel Jewelry Store frontend
- Product and collection Storefront APIs
- Product options, variants, visual media sets and inventory
- Server-priced cart checkout sessions
- Cash on Delivery order completion
- Idempotent checkout completion
- Atomic inventory deduction
- Inventory restoration on pre-fulfillment cancellation
- Order items and operational timeline
- Customer CRM history and internal notes
- Curated collections
- Product + collection SEO documents
- URL redirect registry
- Storefront live search
- Rate limiting on public commerce endpoints
- Backend-only Supabase posture with RLS and revoked client grants
- Bespoke commission requests stored in Supabase and managed from Admin
- Newsletter/private-frequency subscribers stored in Supabase
- Guest order lookup with rate limiting and identity verification
- Live Admin analytics, channels, settings, automations and SEO status
- External channels shown as disconnected until real provider credentials exist

## Intentionally deferred external providers

These require account credentials or a provider choice and are not faked:

- Cloudflare R2 / Image Resizing credentials
- Online payment gateway
- Google Merchant
- Meta / Instagram catalog
- WhatsApp Business messaging
- Email provider / Gmail bridge

COD lets the current store accept real orders before an online payment provider is connected.

## Required deployment secrets

Render:
- DATABASE_URL
- ADMIN_API_KEY
- APP_RUNTIME=api
- STORE_DOMAIN
- STOREFRONT_ALLOWED_ORIGINS

Admin Vercel:
- NEXT_PUBLIC_API_URL
- ADMIN_API_KEY
- ADMIN_UI_USERNAME
- ADMIN_UI_PASSWORD

Storefront Vercel:
- NEXT_PUBLIC_API_URL

Cloudflare variables are optional until the media phase is enabled.

Current media mode:
- `MEDIA_STORAGE_PROVIDER=source-url`
- existing `product_media.source_url` images remain fully usable
- managed upload/rendition endpoints return a clear service-unavailable response until Cloudflare is enabled
