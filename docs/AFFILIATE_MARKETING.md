# Jewelry Store — affiliate marketing (v1)

## Scope
Partner marketing without Shopify or a third-party affiliate platform. The solution adds:
- Customer-account-backed affiliate applications and admin approval.
- First-party links `https://jewelry-store-lime.vercel.app/r/JS...`.
- A 30-day (configurable 1–90 days) signed-in browser attribution journey using an opaque, **HttpOnly SameSite** cookie. Only a SHA-256 digest of the random referral token is stored in PostgreSQL. No raw IP or browser fingerprint is recorded.
- One immutable referral attribution per checkout; one commission per successfully created order.
- A detailed partner earnings portal, payout profile, approval and payout ledger in Jewelry Control admin.
- Manual bank / JazzCash / Easypaisa payout recording, not automatic transfers.

## Security / launch policy
**Program starts disabled.** An authenticated marketing admin goes to `/affiliates`, configures rate/window/hold/minimum, then explicitly enables the program. All public referral routes only recognize **approved** affiliates.

The applicant must use a regular storefront account, then apply on `/affiliate`. The store owner approves or rejects and may set an individual rate (0–30%). Accounts have separate admin/customer identities; affiliates never receive admin session tokens. Referral URLs work only on this store's hostname.

Referral links go to `/r/CODE?to=%2Fcollections` (optional same-site destination). This server-side endpoint records a visit and sets the secure, HttpOnly visit token cookie. Checkout creation runs normally. Before navigating to checkout, the cart calls the same-origin `/api/affiliate/attach` route to link the pending checkout with that valid tracked visit; if attribution is unavailable, COD checkout does not fail.

## Financial rules
- Default **10% commission**, configurable per affiliate. Do not present this as a legal or fixed rate.
- Commission basis: **order merchandise subtotal minus applicable discount** (shipping and all taxes excluded); rate is snapshotted at order completion.
- Commission starts **pending**. Payment is **not automatic** on placement or dispatch.
- Approve commission only when the order is `paid` **and** `fulfilled`, and the configured post-fulfillment hold period has elapsed. Returns, refunds, canceled/failed orders and inactive affiliates are ineligible.
- If a paid commission later receives a refund/return, manual reconciliation flags it as `reversal_due` — the transfer is not silently deleted or refunded.
- Payout: Partner provides bank IBAN or Pakistani wallet destination privately. Admin selects approved eligible commissions, confirms the transfer **already succeeded outside the platform**, and records a unique external transfer reference. Transactional checks and unique constraints prevent double recording.
- Partner dashboards never reveal customers' names, emails, phones or shipping addresses. Admin financial ledger is permission-scoped to `marketing`.
- For data privacy, account IBAN/phone is stored in a restricted table, not returned from public APIs except masked last four characters. Production deployment should additionally consider field-level encryption and retention policies.

## Limitations / further work
This version is click-attribution based; it intentionally doesn't grant commissions from manually typed promo codes or social media impressions without a tracked visit. Advanced fraud detection, identity verification, accounting/withholding taxes, chargeback provider integrations and automatic partner transfers remain future extensions. Country-specific affiliate contract/tax advice is not part of the feature.

Do not run production purchase tests while testing is paused. After testing is authorized, exercise a fresh QA affiliate account and COD order; never ship QA orders or issue actual payouts. Verify post-refund/manual reconciliation and that login credentials remain isolated. Check Vercel and Render build health before saying the feature is live.

## Code locations
- SQL: `database/migrations/023_affiliate_marketing.sql`
- Backend: `services/api/src/affiliates/*`
- Order commission ledger hook: `services/api/src/checkout/checkout.service.ts`
- Partner portal: Jewelry-store `app/affiliate`, `components/affiliate-portal.tsx`
- Referral visits: Jewelry-store `app/r/[code]/route.ts`
- Same-origin checkout attribution: Jewelry-store `app/api/affiliate/attach/route.ts`
- Admin UI/actions: `app/affiliates/*`
