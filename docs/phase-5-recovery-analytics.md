# Phase 5 — Abandoned Checkout Recovery + Conversion Analytics

**Implementation:** Development branches `feat/phase-5-recovery-analytics` in both repositories. **No main merge, database migration, email send, or production deployment has been initiated.**

## Customer and operations flow
- Cookie-free anonymous analytics require an explicit banner selection, default **declined/unset**. This is independent of checkout and newsletter/email consent. Analytics consent can be revised via a small fixed preference control.
- Product views, add-to-bag actions, Gift Finder visits/results and jewelry set visits send only event type, random event ID, random session-only identifier, optional safe product handle/path, coarse device and allowlisted source. No email, phone, name, cart contents, cookies, fingerprint or browser IP is deliberately stored in the events table.
- Creating a COD checkout writes the anonymous analytics session ID **only if analytics permission has been granted**.
- Delivery quote form offers a **separate default-unchecked reminder consent** ("up to three emails in the next three days"). Consent timestamp/version are saved to the new recovery table. Unchecking the box sends an immediate one-way consent-withdrawal mutation; changing/requoting with unchecked consent also suppresses.
- Existing checkout expires as before after two hours. Recovery links are valid for up to seven days from consent, and mint a **new server-priced checkout** from the original underlying variants/bundle selections. Expired price, shipping, stock and discount are not reused. Customer must re-enter/confirm delivery details.
- Recovery credit occurs **only when the newly recovered checkout results in a confirmed COD order**. Opening an email does not count as a recovered sale.
- Unsubscribe link uses a distinct HMAC-purpose signature and suppresses all pending reminders for that email/store. Email security scanners do not redeem or opt out on GET; the buyer must explicitly click a button.
- A 15-minute scheduler processes due attempts at 1, 24, and 72 hours after opt-in. It checks checkout state, email and opt-outs before sending, uses database unique(checkout_id,step), claims via SKIP LOCKED and sends using Resend native HTTP API with a provider idempotency key. Provider failure stops further automated attempts for operator review rather than risking duplicate sends. Multiple checkouts for one email are deduplicated; reminders are capped at three per email per rolling week. An hourly cleanup expires consented recovery links after seven days.
- **Safe default:** email dispatch is disabled unless `RECOVERY_EMAIL_ENABLED=true` **and** `RESEND_API_KEY`, verified `RECOVERY_FROM_EMAIL`, and `RECOVERY_SIGNING_SECRET` (at least 32 characters) are configured. No existing email provider is presumed or changed.

## Database migration 026
`database/migrations/026_checkout_recovery_analytics.sql` adds:
- `analytics_events` with unique event id, UUID session and strict event categories.
- `checkout_sessions.analytics_session_id` (nullable) and `recovered_from_checkout_id` (nullable).
- `checkout_recoveries` with explicit consent and customer email snapshot, recovery status, scheduling and recovered order attribution.
- `checkout_recovery_optouts` storing only HMAC email digest.
- `checkout_recovery_attempts` audited reminder outcomes with one checkout/step unique constraint.
- Backend-only RLS/privileges and indexes.

**Migration 026 must be applied BEFORE deploying the new API.** Phase 3's 024 and Phase 4's 025 were previously applied to the relevant Supabase jewelry database, but 026 was **not applied** during this feature implementation.

## Admin UX
- New `/abandoned-checkouts`: opted-in pending/recovered/suppressed counts; 30-day confirmed COD order value; consented email list; attempt statuses; operational email-disabled indication.
- Existing `/analytics`: anonymized opt-in browsing funnel shown explicitly apart from operational checkout starts/completions, expired checkout value, product views/adds, acquisition channel, and 30-day conversion.
- Recovery links/tokens are not sent to or rendered in the admin interface.
- Anonymous analytics events are automatically discarded after 90 days (while aggregated operational checkout records remain intact).
- Authorization: CRM permission for recovery and Analytics permission for conversion; staff session required.

## Testing and release gates
Admin/API:
```sh
npm run build:web
npm run build:api
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/jewelry_checkout_test npm --prefix services/api run test:regression
```
Run only on disposable localhost PostgreSQL named `*_test`. Existing regression tests validate normal COD, taxes, bundles and packaging; Phase 5 adds opt-in/withdrawal, email-disabled, anonymous event deduplication, secure recovery token, fresh checkout/order-only attribution, unsubscribe and purchase suppression.

Storefront:
```sh
npx tsc --noEmit
npm run build
npm run test:browser:phase5
```
Browser tests require Playwright and `E2E_BASE_URL=http://localhost:3000`; optional `E2E_CHECKOUT_URL` must be a disposable QA checkout, never a real customer checkout. Tests do **not** place production orders.

**Actual builds, PostgreSQL integration-suite execution and browser E2E checks are NOT yet verified.** Previous GitHub Actions jobs were blocked before steps started, and Vercel storefront suffered a build-rate-limit. Do not claim Phase 5 production-ready without independently running these gates.

## Email activation checklist
1. Verify owned sender domain with Resend, configure a verified `RECOVERY_FROM_EMAIL`.
2. Set `RECOVERY_SIGNING_SECRET` to 32+ random characters; never commit to GitHub.
3. Configure `RESEND_API_KEY`, check sending rate limits and unsubscribe link URLs.
4. Ensure `RECOVERY_STOREFRONT_URL` points to the actually LIVE updated storefront with `/recover` and `/recovery-unsubscribe` (no premature sends).
5. After production 026 migration, backend+frontend successful deployments, and disposable QA, set `RECOVERY_EMAIL_ENABLED=true`.
5a. On Render free/sleeping services the in-process 15-minute timer only runs while the service is awake. For reliable delivery connect an external scheduler to `POST /v1/internal/recovery/tick` with the `X-Recovery-Cron-Secret` header and a **32+ character** `RECOVERY_CRON_SECRET` configured in the API environment. Keep the endpoint secret private; never publish it or commit it to GitHub.
6. Review regional messaging/consent requirements and sending-domain setup. This recovery list is **not** the general newsletter list.

No AI/model or paid email provider is required for local algorithmic ranking; actual automated external email delivery requires a connected/configured sender.
