# Database

Production database: Supabase Postgres.

Project ref: `trbkyvwmdhhldifoezgw`

The database is used as managed PostgreSQL only. The admin and storefront must not connect directly with privileged credentials.

## Runtime path

Vercel Admin / Storefront
→ Render API
→ Supabase Postgres

Cloudflare R2 remains the durable object store for product masters and generated image renditions.

## Render connection

For the Render backend, use the Supabase connection string from the project dashboard **Connect** dialog and store it as `DATABASE_URL` in Render environment variables.

On free tier, if the Render runtime cannot reach the direct IPv6 database hostname, use the Supabase shared pooler session-mode connection string instead.

Do not put `DATABASE_URL` in Vercel public environment variables.

## Security posture

All commerce tables have RLS enabled and direct `anon` / `authenticated` grants revoked. No public RLS policies are defined because phase 1 uses Render as the trusted API boundary.

If direct Supabase client access is intentionally added later, create explicit least-privilege policies before exposing any table.

## Migrations

- `init_jewelry_commerce_core`
- `secure_backend_only_and_add_fk_indexes`
