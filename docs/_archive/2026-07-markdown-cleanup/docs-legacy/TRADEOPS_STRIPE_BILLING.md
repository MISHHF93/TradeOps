# TradeOps Stripe SaaS Billing

## Purpose

Organizations pay **TradeOps** for the SaaS product. This is **not** shopper checkout on Shopify/Amazon/eBay.

## Configuration

| Env | Required for live | Purpose |
|-----|-------------------|---------|
| `STRIPE_SECRET_KEY` | Yes | API auth |
| `STRIPE_WEBHOOK_SECRET` | Yes when secret key set | Signature verification |
| `STRIPE_PRICE_*_MONTHLY/ANNUAL` | Per plan | Checkout line items |
| `WEB_ORIGIN` | Recommended | success/cancel/return URLs |

Without `STRIPE_SECRET_KEY`, **development fixture** mode activates a local subscription without collecting cards.

## Plans

| Plan ID | Display | Entitlement tier | Notes |
|---------|---------|------------------|-------|
| founder | Founder | starter | Solo |
| professional | Professional | growth | Multichannel |
| agency | Agency | agency | Seats / clients |
| enterprise | Enterprise | enterprise | Sales-assisted if no Price ID |

## API

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/billing/plans` | analytics:read | Catalog |
| GET | `/api/v1/billing/subscription` | analytics:read | Status + invoices |
| POST | `/api/v1/billing/checkout` | org:write | Checkout session or fixture activate |
| POST | `/api/v1/billing/portal` | org:write | Customer portal |
| POST | `/api/v1/webhooks/stripe` | public + signature | Idempotent lifecycle sync |

## Webhook handling

1. Require raw body (`NestFactory` `rawBody: true`)
2. Verify `Stripe-Signature` HMAC (tolerance 300s)
3. Upsert `BillingWebhookEvent` by `(provider, externalEventId)`
4. Skip if already `processed`
5. Handle: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
6. Update `BillingSubscription`, `BillingAccount`, `Organization.planTier`
7. Redact secrets in stored payload

**Never** unlock entitlements solely from `?checkout=success` query params.

## Access control

- `BillingService.assertBillingAccess` — no-op in `founder_direct`; otherwise past_due/cancelled blocks
- Wired into `SaasService.assertAiEvaluationAllowed`
- Plan tier drives existing `saas-entitlements` packs

## UI

- `/app/billing` — status, plans, checkout, portal, invoices

## Security checklist

- [x] No raw card storage
- [x] Server-side secrets only
- [x] Webhook signature verification
- [x] Replay protection (timestamp tolerance)
- [x] Idempotency via Stripe event id
- [x] Tenant isolation on org-scoped reads
- [x] Secret redaction in webhook payloads
