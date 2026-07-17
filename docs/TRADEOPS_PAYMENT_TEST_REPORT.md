# TradeOps Payment Test Report

**Date:** 2026-07-17  

## Automated unit tests

| Suite | Coverage |
|-------|----------|
| `apps/api/src/billing/stripe-crypto.test.ts` | Valid/invalid signature, missing header, secret redaction |
| `apps/api/src/billing/billing-plans.test.ts` | Plan catalog, tier mapping, Stripe status map |
| `apps/api/src/billing/commerce-payment-readiness.test.ts` | Captured ready; failed not ready; authorized policy gate |

## Manual / e2e checks (when stack up)

| Scenario | Expected | Live smoke 2026-07-17 |
|----------|----------|------------------------|
| GET `/api/v1/billing/subscription` | 200, domain saas_billing | **Pass** |
| POST `/api/v1/billing/checkout` (no Stripe key) | development_fixture activation | **Pass** → professional → planTier growth |
| Refresh `/app/billing` | Subscription status persists | **Pass** UI 200 |
| POST `/api/v1/webhooks/stripe` bad signature | 400 when secret configured | Unit covered; live when key set |
| Duplicate webhook event id | `{ duplicate: true }` | Code path |
| Fixture order ingest | CommercePayment created; PO only if payment ready | Code path |
| Approve supplier PO after payment cancelled | Blocked by re-assert | Code path |
| POST `/api/v1/finance/payouts/fixture-reconcile` | Payout + reconciliation | **Pass** matched variance 0 |
| Finance UI pages | Load with honesty banners | **Pass** /app/billing, payments, reconciliation 200 |
| AI tool catalog | getBillingStatus, inspectOrderPayment, etc. | **Pass** 15 tools including finance set |

## Security

| Check | Status |
|-------|--------|
| No card fields in schema | Pass |
| Webhook HMAC | Pass (unit) |
| Idempotent webhook | Pass (code path) |
| Tenant org filter on finance lists | Pass (code path) |
| Secrets redacted in webhook store | Pass (unit) |

## Build

Run: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e:smoke` with DB/API/web up.

## Gaps / next

- Full integration tests against live PGlite for webhook end-to-end  
- Channel webhook modules (Shopify HMAC, Amazon SP-API notifications)  
- Metered billing (Stripe Billing Meters) after usage model freeze  
