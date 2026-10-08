# Checkout regression tests

This suite exercises the **compiled NestJS CheckoutService** against **real PostgreSQL 17**. It uses the repository's `database/schema.sql` and **all** `database/migrations/*.sql` files. The tests never call the hosted Render API or storefront.

## Coverage

| Case | Regression asserted |
| --- | --- |
| COD happy path | Exactly one pending/confirmed order, correct item, inventory -1, one movement, queued confirmation, no payment charge |
| Same/different key retries | Same order ID and no further stock decrease |
| Parallel same-checkout calls | Row lock serializes completion and prevents duplicates |
| Two competing checkouts | Only one may buy the last unit |
| Duplicate cart lines | Aggregate quantity cannot exceed available stock |
| Stock change after cart | Completion fails with no order or stock movement |
| Terms / payment method | Reject missing acceptance and unsupported online methods |
| Repricing | Database live price wins over stale checkout amount |
| Discount/tax | Quoted discounts and tax match completed order |
| Forced SQL failure | Transaction rolls back order, customer, stock changes and notifications |

## Isolated execution

**Never run tests against a production database.** The runner refuses any URL whose host is not `localhost` or `127.0.0.1`, and whose database does not end in `_test`. It also refuses a separately configured production `DATABASE_URL`.

GitHub Actions starts a disposable `postgres:17` service with database `jewelry_checkout_test`. The suite initializes the schema and migrations and resets stores between cases. The `TRUNCATE ... CASCADE` statements run **only** against that disposable database.

For local development, create an empty, disposable PostgreSQL database named `jewelry_checkout_test` on `localhost`, then:

```sh
npm --prefix services/api install --no-audit --no-fund
npm --prefix services/api run build
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/jewelry_checkout_test \
  npm --prefix services/api run test:regression
```

For convenience, a local Docker PostgreSQL instance can be started with:

```sh
docker run --rm --name jewelry-regression-pg -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jewelry_checkout_test \
  -p 127.0.0.1:5432:5432 postgres:17
```

Keep Docker running in a separate terminal while the tests execute. Use a different local port if 5432 is already occupied.

## CI requirements

The `Commerce CI` workflow runs the suite in its `api` job on pull requests and pushes to `main`. A green test job verifies the source build and this suite. A green frontend Vercel build alone **does not** establish passing regression tests.

The tests intentionally do not make real orders, send email, charge a card, issue refunds, or call fulfillment providers. The confirmation message remains an isolated database outbox row.

## Separate browser checks

Also test the storefront in a browser after deployment: variant selection, cart persistence, checkout form validation, completed-checkout redirect, and accessibility. These browser/UI cases are not covered by this backend integration suite.
