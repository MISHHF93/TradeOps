# TradeOps Payment Architecture

**Date:** 2026-07-17  
**Status:** Dual domains implemented (foundations + Stripe SaaS path + commerce normalize/gate)

## Money flows aligned to product positioning

**Primary product** ([TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md)): intelligence + execution SaaS. Merchants own checkout.

```text
1) TradeOps SaaS Billing  ← CORE product revenue
   Merchant organization → Stripe Checkout / Billing → TradeOps
   Models: BillingAccount, BillingSubscription, BillingInvoice, BillingWebhookEvent
   Routes: /api/v1/billing/*, /api/v1/webhooks/stripe
   UI: /app/billing

2) Commerce payment intelligence  ← CORE ops (ingest, not process cards)
   Shopper → merchant’s channel checkout (Shopify / Amazon / eBay / …)
   → payment events → TradeOps connectors → normalize
   Models: CommercePayment, CommerceRefund, CommerceDispute, CommercePayout, PaymentReconciliation
   Routes: /api/v1/finance/*
   UI: /terminal/finance/*
   TradeOps does not become the card processor for merchant storefronts by default.

3) Optional / deferred (not primary product)
   Platform Connect marketplace rails, client operating-capital modules, campaign capital
   Routes: /api/v1/marketplace/*, /api/v1/network/*, /api/v1/capital/*
   UI: /network/*, /capital/*
   Gated, sandbox, or partner-required — not marketed as investment management
```

See also: [TRADEOPS_FINANCIAL_DOMAIN_BOUNDARIES.md](./TRADEOPS_FINANCIAL_DOMAIN_BOUNDARIES.md), [TRADEOPS_COMMERCE_CAPITAL_BOUNDARY.md](./TRADEOPS_COMMERCE_CAPITAL_BOUNDARY.md).

## Design principles

| Principle | Implementation |
|-----------|----------------|
| No card data in TradeOps | Stripe-hosted Checkout only; no PAN/CVV storage |
| Webhooks are source of truth | Stripe signature verify + event.id idempotency |
| Redirect is not payment proof | UI warns; entitlements update on webhook / provider retrieval |
| Order ≠ source-ready | `assertOrderPaymentReady` before supplier PO create/approve |
| Domains stay separate | Different tables, routes, nav labels |
| Tenant isolation | All queries scoped by `organizationId` |

## Architecture diagram

```text
TradeOps Billing
└── Stripe
    ├── Checkout Session (subscription mode)
    ├── Billing Portal
    ├── Subscriptions + Invoices
    └── Webhooks → BillingAccount / Subscription / planTier

Merchant Commerce Payments
├── Fixture / channel order ingest
├── CommercePayment normalize (idempotent)
├── Source gate (captured | authorized+policy)
├── Refund / Dispute records
├── Payout ingest
└── PaymentReconciliation (expected vs actual net)
```

## Lifecycle placement

```text
Publish listing
→ customer places order
→ channel confirms payment
→ TradeOps receives order event
→ verify payment state → CommercePayment
→ create canonical order
→ assert payment ready
→ authorize sourcing (approval)
→ submit supplier order
→ track fulfillment
→ receive marketplace payout
→ match payout → reconciliation
→ calculate realized profit (fees + refunds)
→ update learning model
```

## Planned extensions

- Stripe Billing Meters (usage) after usage model stabilizes
- SettlementLine rows (currently summaryJson on reconciliation)
- PayPal Orders API as optional checkout method
- Channel-specific webhook signature modules (Shopify/eBay/Amazon) with same idempotency pattern

## Related docs

- [TRADEOPS_PAYMENT_AUDIT.md](./TRADEOPS_PAYMENT_AUDIT.md)
- [TRADEOPS_STRIPE_BILLING.md](./TRADEOPS_STRIPE_BILLING.md)
- [TRADEOPS_COMMERCE_PAYMENTS.md](./TRADEOPS_COMMERCE_PAYMENTS.md)
- [TRADEOPS_PAYOUT_RECONCILIATION.md](./TRADEOPS_PAYOUT_RECONCILIATION.md)
