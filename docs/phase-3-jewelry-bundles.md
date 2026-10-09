# Phase 3 — Variant-Accurate Jewelry Bundles

**Status:** Implemented on development branches only; no production migration or deployment. Full TypeScript build, PostgreSQL integration tests, and browser QA are not yet verified. Do not merge/deploy until the release gates below pass.

## Customer experience

- A distinct `/bundles` page displays published, currently available curated sets.
- Each set contains **2–10 exact product variants** with their own SKU, options (such as colour/size), image, and required quantities.
- Shopper sees the regular component total, the set discount and set price before delivery and taxes. Quantity obeys the *lowest component inventory* and the per-SKU checkout limit.
- A bundle is added to a separate persisted set selection, but the cart combines it with ordinary jewelry products in one COD checkout.
- Checkout expands each bundle into its underlying variant SKUs; there is no independent "bundle inventory" that can diverge from real stock.
- Promo codes and automatic discounts **do not stack** with bundle offers. This restriction is enforced server-side for the entire order.
- The shipping/tax-inclusive payable total is presented to the shopper for explicit approval before COD order creation.

## Admin experience

- New **Jewelry Bundles** area in the catalog navigation.
- Variant/SKU search, component quantity selection, draft/active/archive status, effective date window, descriptions and handles.
- Fixed-PKR and percentage-based savings with a live preview calculated from admin catalog values.
- Archiving is idempotent and audited; edits and creation write an audit event.
- Orders present a bundle-allocation section showing set name, quantity, regular total and savings. Original SKU-level order items remain visible for picking, inventory and cancellation.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/v1/admin/bundles` | List including draft and archived |
| GET | `/v1/admin/bundles/variants` | Searchable admin variant choices (up to 1200) |
| GET | `/v1/admin/bundles/:id` | Detail |
| POST | `/v1/admin/bundles` | Create |
| PATCH | `/v1/admin/bundles/:id` | Replace editable bundle definition |
| DELETE | `/v1/admin/bundles/:id` | Archive, never delete order history |
| GET | `/v1/storefront/bundles` | Only active, in-window, purchasable sets |
| POST | `/v1/storefront/checkout` | `{items:[...],bundles:[{bundleId,quantity}]}` |
| POST | `/v1/storefront/checkout/:id/customer` | Server-priced final tax, shipping and total |
| POST | `/v1/storefront/checkout/:id/complete` | Bundle orders require `{expectedTotal: <reviewed total>}` and idempotency key |

The admin routes are protected by staff-signed session plus **catalog permission**; the public bundles route has a public rate-limit guard. Existing non-bundle checkout payloads continue to be accepted.

## SQL migration — BLOCKING dependency

**`database/migrations/024_jewelry_bundles.sql` MUST be installed before any new API build is deployed.** The bundle implementation queries `checkout_bundle_allocations` even when a customer buys only ordinary products; deploying the new API without the migration would break existing COD checkouts.

Migration creates:
- `jewelry_bundles` and `jewelry_bundle_components`;
- `checkout_bundle_allocations` and `order_bundle_allocations` with immutable snapshots;
- `bundle_discount_amount` in `checkout_sessions` and `orders`;
- FK indexes, constraints, RLS and revocation for `anon` and `authenticated` roles.

It contains **no production data deletion**. Before production execution, take a backup, review existing objects and migration order, and apply through the approved migration runner. Do not apply this migration to the live database during normal development/testing.

## Financial and fulfillment integrity

- Values and stock are recalculated by the API; the browser is not trusted for prices, bundle definitions, or inventory.
- At checkout creation, bundle components are expanded and checked **in aggregate with ordinary cart lines** to prevent double-sell of the same SKU.
- At checkout completion, all distinct variant rows are locked in stable order. Existing order ID/checkout idempotency prevents duplicate order writes, inventory deductions and notifications.
- Bundle snapshot includes variant IDs, per-set quantities, gross and discount; the API re-verifies it before review and completion. JSONB arrays are compared semantically, not by object serialization order.
- Prices, components, or promotional eligibility changing after cart preparation **require a new checkout**; stock changes reject the order.
- Bundle discount is persisted on both checkout and order and included in order-level discount. Tax discounts are prorated only across the **taxable bundle components**, not unrelated standalone items.
- COD cancellation restores the real SKU quantities through the existing per-order-line restock workflow, and is idempotent.
- Generic order-item/discount/tax edits of bundle-backed orders are disabled, preserving the bundle audit trail; use the existing cancellation/return workflow for post-order changes.
- No unsupported promise about shipping price, gift packaging, or refunds; those are handled separately.

**Caution on partial returns/refunds:** The order retains gross SKU line prices with an order-level bundle discount. Staff must consider the saved discount allocation when setting partial refund amounts; a dedicated per-component refund-proration UI is **not** included in Phase 3. The existing payment ledger protects against refunds exceeding captured funds.

## Isolated verification

In the admin repo, after installing Node and npm dependencies:

```bash
npm run build:web
npm run build:api
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/jewelry_checkout_test npm --prefix services/api run test:regression
```

Run against an **isolated disposable PostgreSQL** database named `*_test` at `localhost`; the regression test intentionally refuses any other database and creates its own test schema/migrations. It NEVER uses production credentials. The suite includes ordinary COD regressions plus bundle-specific cases (pricing, shared variant stock, archived offer, coupon conflict, stale pricing, idempotency, taxable vs tax-exempt discounts, and stock restoration after cancellation).

Storefront repo:

```bash
npm run test:recommendations
npx tsc --noEmit
npm run build
```

Manual browser acceptance:
- 320/375/390/768px desktop and dark/light screens: navigation, `/bundles`, cart, checkout and order confirmation.
- Create/edit/archive a bundle, preview understock/draft status, check date windows, handle uniqueness and staff permissions.
- Buy set only, ordinary jewelry only and mixed cart; verify real stock, duplicate SKU quantities, discount/taxes and cancelled orders.
- Browser refresh across cart and checkout; unavailable SKU, temporary API outage, retries, external checkout session expiration.

## Release sequence

1. **Do not deploy yet**. Finish QA and resolve storefront Vercel build-rate-limit (last known blocker).
2. Back up production DB and migrate **024**.
3. Deploy updated Render API and verify health/regular COD before enabling active bundles.
4. Deploy admin Vercel and storefront Vercel; verify all `READY`, then test authorized and guest flows.
5. Publish real catalog bundles in admin once backend/frontend are confirmed. Do not seed arbitrary fake jewelry SKUs.

No migration or production rollout was run as part of Phase 3 development.
