# TradeOps — Six Pillars of the AI Commerce Operating System

**Strategic north star.** TradeOps is **not** another storefront or marketplace. It sits **above** Shopify, BigCommerce, Amazon, eBay, suppliers, logistics, and analytics as the unified intelligence and execution layer.

**Positioning:** *The AI Commerce Operating System for modern merchants.*

**Guiding question:** *How do I run my commerce business better?*

Canonical commercial stance: [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md).

---

## What TradeOps is not

| Not | Why |
|-----|-----|
| Another e-commerce platform | Merchants keep Shopify / Amazon / eBay as channels of record |
| Investment / custody product | Merchants pay SaaS only; no pooled funds, no client investment wallet |
| Raw API console | Connectors expose **capabilities**, not SDK sprawl in the UI |
| Manual marketplace browser | Intelligence is proactive, continuous, and mandate-aware |

Industry direction supports **unified commerce**: one operational layer across channels, centralized data, not siloed channel admin. Shopify and peers push multi-channel operations into a single control plane rather than isolated storefront tools.

---

## The six pillars

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Commerce Intelligence          (brain)                  │
│  2. Commerce Operations            (lifecycle spine)        │
│  3. Unified Connector Hub          (capability adapters)    │
│  4. AI Operator                    (operational manager)    │
│  5. SaaS Billing                   (simple Stripe subs)     │
│  6. Enterprise Layer               (scale & governance)     │
└─────────────────────────────────────────────────────────────┘
         ↑ sits above channels, suppliers, logistics, ads, finance
```

### 1. Commerce Intelligence (the brain)

Continuously (not only on demand):

* discover products  
* analyze suppliers  
* estimate demand  
* estimate landed cost  
* estimate margins  
* identify risks  
* recommend actions  

**Reactive (weak):** “Find products.”  
**Proactive (target):** “I found 14 products matching your criteria. Three exceed your 35% minimum margin.”

Maps to: opportunity scoring, signals, forecasts, policy, supplier offers, portfolio views.

### 2. Commerce Operations (one procedure)

Every product / case follows one operating spine—not a pile of disconnected pages:

```text
Discover → Evaluate → Supplier Comparison → Listing Draft → Approval
→ Publish → Monitor → Optimize → Reconcile → Learn
```

Maps to: `CommerceCase`, process board, stage transitions, tasks, approvals, reconcile → learn.

### 3. Unified Connector Hub

One architecture; many providers. Each connector **advertises capabilities** (read products, publish listing, sync orders, …)—not raw vendor APIs in the dashboard.

| Family | Examples (roadmap + fixtures) |
|--------|--------------------------------|
| Commerce | Shopify, Amazon, eBay, BigCommerce, WooCommerce |
| Suppliers | Alibaba, AliExpress, Faire, CJ, Inventory Source, custom APIs |
| Logistics | ShipStation, EasyPost, UPS, FedEx, DHL |
| Marketing | Google Ads, Meta, TikTok, Pinterest |
| Finance | Stripe (SaaS + optional merchant Connect later), PayPal, QuickBooks, Xero |

**Implementation rules:**

* Connectors live under `packages/connectors/*` only.  
* Prefer durable webhooks: verify → ack fast → queue → process async.  
* Canonical product / inventory / order models—not per-marketplace silos as source of truth.  
* New Shopify public-app work should target **GraphQL** product APIs (platform requirement for App Store acceptance).

### 4. AI Operator (operational manager)

Example objective: *“Launch a Canadian electronics business under $20,000.”*

AI should:

* discover suppliers and products  
* evaluate economics and risk  
* prepare listing drafts  
* identify required approvals  
* create / drive workflows  
* **explain** every recommendation  

Human **reviews and approves** consequential actions. AI does not bypass policy, invent live credentials, or move funds.

Maps to: AI Operator, typed tools, live examples, approval gates.

### 5. SaaS Billing (intentionally simple)

```text
User → Stripe Checkout → Subscription → Organization → Workspace → Entitlements
```

* Stripe only for **TradeOps subscriptions** (and usage later if needed).  
* **No** investment wallet, client capital custody, or pooled funds.  
* Shopper payments stay on the merchant’s existing processors.

Maps to: `/app/billing`, `BillingAccount` / subscription webhooks, plan entitlements.

### 6. Enterprise Layer (after foundation is stable)

* multi-organization / agency  
* role-based permissions  
* approval chains  
* audit logs  
* workflow templates  
* SSO  
* API keys  
* custom integrations  
* AI governance  
* compliance reporting  

Maps to: multi-tenancy, RBAC, audit events, agency clients, control tower—expand over time.

---

## Natural product expansion (from one question)

*How do I run my commerce business better?* expands into:

| Capability | Pillar |
|------------|--------|
| AI product discovery | Intelligence |
| Supplier intelligence | Intelligence + Connectors |
| Listing automation | Operations + AI |
| Inventory management | Operations + Connectors |
| Multichannel publishing | Operations + Connectors |
| Order orchestration | Operations |
| Fulfillment monitoring | Operations + Logistics connectors |
| Financial reconciliation | Operations + payment intelligence |
| Analytics / executive reporting | Intelligence + Enterprise |
| Workflow automation | AI + Enterprise |

---

## Industry alignment checklist

| Priority | TradeOps response |
|----------|-------------------|
| Unified commerce across channels | Canonical models + process spine + connector hub |
| Centralized product / inventory / order data | Prisma domain models scoped by `organizationId` |
| GraphQL for modern Shopify apps | Connector package direction for live Shopify |
| Durable webhooks | Signature verify, idempotency, queue slow work |
| Merchant retains MoR / processors | Commerce payment **intelligence**, not card gateway |

---

## Build priority (aligned to pillars)

1. **Intelligence + Operations spine** — discover → evaluate → approve → publish → learn (fixture then live).  
2. **Connector hub** — capability registry, honest readiness, Shopify GraphQL path when credentials exist.  
3. **AI Operator** — typed tools, explainability, approval-required actions.  
4. **SaaS Billing** — Stripe Checkout + entitlements (keep simple).  
5. **Enterprise** — deepen tenancy, audit, SSO, API keys as customers need them.  
6. **Capital modules** — remain off / sandbox / partner-gated; never the core identity.

---

## Related docs

| Doc | Role |
|-----|------|
| [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md) | Commercial / legal product stance |
| [TRADEOPS_PRODUCT_SPEC.md](./TRADEOPS_PRODUCT_SPEC.md) | Product questions & modes |
| [TRADEOPS_COMMERCE_LIFECYCLE.md](./TRADEOPS_COMMERCE_LIFECYCLE.md) | Lifecycle detail |
| [TRADEOPS_PROCESS_ARCHITECTURE.md](./TRADEOPS_PROCESS_ARCHITECTURE.md) | Process spine |
| [TRADEOPS_CONNECTOR_STANDARD.md](./TRADEOPS_CONNECTOR_STANDARD.md) | Connector contracts |
| [TRADEOPS_AI_OPERATOR.md](./TRADEOPS_AI_OPERATOR.md) | AI operator |
| [TRADEOPS_STRIPE_BILLING.md](./TRADEOPS_STRIPE_BILLING.md) | SaaS billing |
| [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) | Built vs aspirational |
