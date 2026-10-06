# Jewelry Commerce Admin / CRM

A headless commerce admin and CRM for the Jewelry Store storefront.

## Current phase

This repository is intentionally optimized for one store and free-tier infrastructure first:

- Admin frontend: Next.js on Vercel
- Storefront: separate Next.js app on Vercel
- Backend/API: Render web service (planned implementation)
- Database: PostgreSQL
- Product media: Cloudflare R2
- Queue/retries: PostgreSQL-backed jobs initially
- No Redis or separate worker required in phase 1

The data model keeps a store_id boundary so a later multi-store phase can be added without redesigning products, variants, orders, customers or channel mappings.

## Included admin modules

- Command Center
- Orders
- Customer CRM
- Products
- Variant Studio
- Visual option rules
- Variant media sets
- Single master image -> responsive renditions
- Cloudflare R2 storage model
- Unified Inbox
- Automations
- Analytics
- Storefront Channel
- Multichannel Hub
- SEO / Discovery Operating System
- Team / role foundation
- Infrastructure settings

## Variant model

Sellable variants and imagery are separate concerns.

Example:

Metal x Stone x Size = 30 sellable variants.

Metal and Stone are visual options; Size is non-visual. Five ring sizes can therefore share the same Metal + Stone media set.

## Image model

The user uploads one high quality master image.

The system keeps the original in R2 and generates renditions for admin thumbnails, product cards, PDP mobile/desktop, zoom, hero mobile/desktop and social previews. A focal point protects the jewelry subject across crops.

## Headless rule

Admin and backend never own storefront CSS, JSX or theme layout.

Admin/API owns semantic commerce data:

products -> options -> variants -> inventory -> media -> SEO -> channel overlays

Storefronts consume /v1/storefront/* and decide presentation independently.

## Multichannel rule

There is one canonical product and variant identity. Google Merchant, Meta, Instagram, WhatsApp and future marketplaces use overlays/mappings rather than duplicate products.

## SEO / Discovery OS

The admin model covers:

- on-page SEO
- technical SEO
- ecommerce SEO
- GEO / AI discovery
- entity facts
- authority / digital PR tracking
- community opportunities
- visual search
- video metadata
- voice/conversational query coverage
- local SEO (only when a real eligible business profile exists)
- future ASO
- white-hat policy guardrails

The system must not automate fake reviews, fake backlinks, fake community personas, location spam or deceptive structured data.

## Local development

1. Copy .env.example to .env.local
2. npm install
3. npm run dev

The current screens use mock data. Render API wiring is the next implementation phase.

## Secrets

Never commit Render database credentials or Cloudflare R2 secret keys. Keep them in Render environment variables.
