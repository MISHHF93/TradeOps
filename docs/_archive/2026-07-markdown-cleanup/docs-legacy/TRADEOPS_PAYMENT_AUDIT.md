# TradeOps Payment Audit

**Date:** 2026-07-17  
**Scope:** SaaS billing vs commerce payment intelligence  

## Findings (pre-implementation)

| Area | Status (before) |
|------|-----------------|
| Stripe / Checkout / Portal | Missing |
| BillingAccount / Subscription models | Missing (only `Organization.planTier`) |
| Plan entitlements | Present — `saas-entitlements` packs + limits |
| Usage meters | Present — `UsageMeter` (ai_evaluations, workflow_runs) |
| Server-side AI/workflow quotas | Present — `SaasService.assertAiEvaluationAllowed` |
| Pricing pages | Marketing `/pricing`, `/platform/plans` only |
| `/app/billing` | No page |
| CommercePayment / Payout / Refund | Missing |
| Order → source payment gate | Missing |
| Stripe webhooks | No signature verify |
| Card data storage | None (correct) |

## Post-implementation status

| Area | Status (after) |
|------|----------------|
| Stripe Checkout + Portal | **Done** (`BillingService`; live keys or dev fixture) |
| Billing models | **Done** — migration `20260717060000_billing_and_commerce_payments` |
| Commerce payment models | **Done** — Payment, Refund, Dispute, Payout, Reconciliation |
| Entitlement sync | **Done** — planId → `Organization.planTier` |
| Webhook verify + idempotency | **Done** — `stripe-crypto` + `BillingWebhookEvent` |
| Source payment gate | **Done** — ingest + PO approval re-assert |
| UI | **Done** — `/app/billing`, `/terminal/finance/*` |
| AI finance tools | **Done** — inspect free; checkout/refund/reconcile approval-gated |
| Docs | **Done** — architecture, Stripe, commerce, payout, test report |

## Domains (must stay separate)

1. **SaaS billing** — orgs pay TradeOps (Stripe).  
2. **Commerce payments** — shoppers pay channels; TradeOps normalizes events.

## Remaining gaps

- Live Stripe Price IDs and webhook endpoint registration in Dashboard  
- Channel-specific webhook signature modules (Shopify/eBay/Amazon/PayPal)  
- SettlementLine first-class rows (summaryJson today)  
- Stripe Billing Meters for usage once usage model is stable  
