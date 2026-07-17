# TradeOps Commerce Payments

## Purpose

Normalize **shopper** payment lifecycle from marketplaces and storefronts. TradeOps does **not** become a card processor for Shopify (Payments Partner path intentionally avoided).

```text
Customer → channel checkout → payment provider → order/payment event
→ TradeOps connector → CommercePayment → gate sourcing → fulfillment
```

## Canonical models

| Model | Role |
|-------|------|
| `CommercePayment` | Normalized payment lifecycle per order |
| `CommerceRefund` | Full/partial refunds (idempotent external id) |
| `CommerceDispute` | Chargebacks / disputes |
| `CommercePayout` | Merchant settlement transfer |
| `PaymentReconciliation` | Expected vs actual net |

Statuses: `pending` → `authorized` → `captured` → `partially_refunded` / `refunded` / `failed` / `disputed` / `cancelled`.

Provider-specific status is kept in `rawProviderStatus` + `metadataJson`.

## Source-ready policy

Supplier PO must **not** be submitted merely because an order exists.

`CommercePaymentService.assertOrderPaymentReady`:

1. Order not cancelled/refunded
2. CommercePayment exists
3. Status is `captured`, or `authorized` if `TRADEOPS_ALLOW_AUTHORIZED_SOURCING=true`
4. Positive amount
5. Currency matches order

Called:

- After fixture order ingest (before draft PO)
- On approval of `supplier_purchase_order` (re-check)

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/finance/payments` | orders:read |
| GET | `/api/v1/finance/payments/:id` | orders:read |
| GET | `/api/v1/finance/payouts` | orders:read |
| GET | `/api/v1/finance/reconciliations` | orders:read |
| GET | `/api/v1/finance/disputes` | orders:read |
| POST | `/api/v1/finance/payouts/fixture-reconcile` | orders:write |

## UI

- `/terminal/finance/payments`
- `/terminal/finance/payouts`
- `/terminal/finance/reconciliation`
- `/terminal/finance/disputes`

## Webhooks (pattern)

Endpoints planned: `/api/v1/webhooks/shopify|ebay|amazon|paypal` — same rules as Stripe:

1. Verify signature  
2. Persist raw event  
3. Idempotency key = provider event id  
4. Normalize to CommercePayment  
5. Fast ACK; slow work async  
6. Audit  

Stripe SaaS webhooks are **not** used for channel order payments.

## AI tools

Read-only: `getBillingStatus`, `inspectOrderPayment`, `inspectPayout`, `explainPaymentVariance`, `openBillingPortal`  
Approval-required: `createBillingCheckout`, `reconcilePayout`, `prepareRefundAction`
