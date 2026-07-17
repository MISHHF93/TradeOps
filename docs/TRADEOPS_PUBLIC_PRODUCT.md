# TradeOps Public Product

**Positioning:** The AI Commerce Operating System for modern merchants.

**Supporting statement:** Not another e-commerce platform—the layer above Shopify, Amazon, eBay, suppliers, and logistics. Discover opportunities, run one operations spine, connect systems via a capability hub, and use an AI operator with human approval. Merchants own stores and payment processors. SaaS billing only via Stripe. Not investment management or fund custody.

See [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md) · [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md).

## Surfaces

| Surface | URL prefix | Data |
|---------|------------|------|
| Public website | `/product`, `/solutions/*`, `/tools`, `/platform`, … | No private catalogs |
| Root `/` | Depends on access mode | `founder_direct` → terminal cockpit; `authenticated` → marketing home |
| Merchant workspace | `/app`, `/terminal/*` | Organization-scoped; `noindex` |

## Access modes (honesty)

| Mode | Public claim |
|------|----------------|
| `founder_direct` (default local) | Single-operator workspace; no multi-user signup required |
| `authenticated` / `multi_tenant` | Register/sign-in available for multi-user SaaS |

## Accurate claims only

We **do** claim: contribution profit math, explainable scores, shadow automation, approval gates, connector honesty board, SaaS foundations (packs, quotas, control tower, ATP), Stripe SaaS billing path when configured.

We **do not** claim: guaranteed profit/sales, perfect predictions, live integrations without credentials, autonomous purchasing without approval, investment management, pooling of client capital, custody of merchant operating funds, certifications not obtained.

## Free evaluation

Public tools work without account. Under multi-user mode, registration creates a real org. SaaS billing uses Stripe Checkout when keys are set; otherwise development fixture only.
