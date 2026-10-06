# Storefront API contract

Public/theme-facing API namespace:

- GET /v1/storefront/products
- GET /v1/storefront/products/:handle
- GET /v1/storefront/collections
- GET /v1/storefront/collections/:handle
- GET /v1/storefront/navigation/:handle
- GET /v1/storefront/content/:type/:handle
- GET /v1/storefront/config

A product response should include semantic fields, option definitions, sellable variants, media sets, resolved responsive rendition URLs, SEO fields and availability.

Do not return CSS class names, React component names or layout instructions from the commerce API.

Admin namespace:

- /v1/admin/products/*
- /v1/admin/orders/*
- /v1/admin/customers/*
- /v1/admin/media/*
- /v1/admin/channels/*
- /v1/admin/seo/*

Admin requests require authenticated, authorized context.
