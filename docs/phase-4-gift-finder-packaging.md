# Phase 4 — Gift Finder + Gift Packaging

**Development only:** storefront and admin/API changes are on `feat/phase-4-gift-finder` in their respective repositories. Neither branch has been merged or deployed.

## Customer journey
1. `/gift-finder`: select occasion (birthday, anniversary, wedding, Eid, thank-you, everyday), recipient, style and maximum jewelry budget.
2. A deterministic, no-paid-AI matcher ranks **real in-stock** products from `getStorefrontProducts()`; the budget is a hard ceiling. Price and stock must be checked again at checkout. Results link to the actual product page.
3. Shopper may add items to regular cart, or use an existing jewelry bundle; Gift Finder itself does not automatically add anything to the cart.
4. COD checkout: mark as a gift, optionally add a private 500-character gift message and select one packaging presentation, including an option with no extra charge.
5. Checkout displays packaging fee and shipping/tax-inclusive payable amount for explicit customer confirmation.
6. Admin fulfillment order shows stored packaging SKU, title, price and private note. Message is not automatically printed or sent to recipient.

## Admin
- New **Gift Packaging** catalog section at `/gift-packaging`.
- Up to 300 store-scoped packaging SKUs, with photo URL, name, description, fixed PKR price, physical stock quantity, grams, taxable flag, ordering and `draft/active/archived` status.
- Packaging is selectable publicly only when active with positive stock. No fake preset catalog items are seeded.
- All admin modifications use authenticated staff session and catalog-scoped RBAC, with an audit-log event.

## Backend API
- `GET /v1/storefront/gift-packaging`: public available packaging options.
- `GET /v1/admin/gift-packaging`: staff list, `{ready:false,items:[]}` until schema migration.
- `POST /v1/admin/gift-packaging`: create option.
- `PATCH /v1/admin/gift-packaging/:id`: update.
- `DELETE /v1/admin/gift-packaging/:id`: archive.
- `POST /v1/storefront/checkout/:id/customer`: accepts `isGift`, optional `giftMessage`, and `giftPackagingId` (only when `isGift=true`), recalculates postage weight, taxable base, packaging charge and total.
- `POST /v1/storefront/checkout/:id/complete`: revalidates packaging stock, active status, price, SKU and title; requires a previously approved total for gift-packaged orders; consumes **one** packaging SKU inside the existing atomic order transaction. Retries remain idempotent.
- `GET /v1/storefront/checkout/:id`: exposes packaging price and title (not private gift message).
- Cancelling an unfulfilled/unpaid COD order restores packaging stock once, with audited `gift_packaging_movements`.

## Database migration — mandatory before enabling gifting
- `database/migrations/025_gift_packaging.sql`: packaging SKU catalog, checkout/order frozen SKU/price/title snapshots, inventory movements and constraints.
- **Apply migration 024 first** if still pending. Phase 4 API uses a `to_regclass` guard so existing ordinary COD checkout works without migration 025; gift packaging stays disabled until activation.
- Never apply schema changes in production without backup, migration review and rollback plan. No production database change was performed in this development session.
- New price contributes to customer total; packaging taxable flag controls its applicable tax base. Weight contributes to courier eligibility.

## QA acceptance and prerequisites
API/admin repository:
```bash
npm install --no-audit --no-fund
npm run build:web
npm run build:api
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/jewelry_checkout_test npm --prefix services/api run test:regression
```

The integration suite guards against connecting to a non-local or non-`_test` database and runs all SQL migrations in filename order. Phase 4 test cases include paid/free packaging, tax, price change, sold-out inventory, mandatory reviewed payable amount, cancellation restoration and idempotent retries.

Storefront repository:
```bash
npm install --no-audit --no-fund
npx tsc --noEmit
npm run build
```
Browser tests: 320/375/390/768/desktop light/dark; no products in budget, sold-out catalog entries, product variant selection, gift/personal note toggle, free/paid package, unavailable package or API, shipping weight thresholds, persisted checkout URL and review invalidation, order confirmation, refund/return and cancellation.

**Verification performed**: source-contract checks for stock/budget gating, module wiring, packaging tax/weight/total formula, immutable price and SKU checks, SQL migration tables, JS test-file syntax and CSS brace balance. **Not performed:** live Next/Nest builds, PostgreSQL test execution or end-to-end browser tests; network access to clone GitHub was unavailable. Do not call Phase 4 production-ready until these pass.

**Important deployment dependency:** At the last check, Phase 3 storefront Vercel deployment was in ERROR/build-limit state. Phase 4 must not be merged or deployed to `main` until authorized and the previous failure has been repaired.
