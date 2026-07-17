# TradeOps Product Positioning

**Canonical commercial and architecture stance**

**Six pillars (product architecture):** [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md)

---

## One-line positioning

> **The AI Commerce Operating System for modern merchants.**

Supporting statement:

> TradeOps helps businesses discover profitable products, evaluate opportunities, automate commerce workflows, and operate across multiple sales channels. It sits **above** Shopify, Amazon, eBay, suppliers, and logistics—not as another storefront. It provides **intelligence and execution tools**—not investment management or custody of customer funds.

**Guiding question:** *How do I run my commerce business better?*

---

## Six pillars (summary)

| # | Pillar | Role |
|---|--------|------|
| 1 | Commerce Intelligence | Brain: continuous discover / cost / margin / risk / recommend |
| 2 | Commerce Operations | Single lifecycle spine (Discover → Learn) |
| 3 | Unified Connector Hub | Capability-based adapters (commerce, supply, logistics, ads, finance) |
| 4 | AI Operator | Operational manager; human approves consequence |
| 5 | SaaS Billing | Stripe subscriptions only—simple, no custody wallet |
| 6 | Enterprise Layer | Multi-org, RBAC, audit, SSO, governance (as you scale) |

---

## Primary product model (what we build and sell)

```text
Merchant signs up
→ Stripe subscription (pay TradeOps for software access)
→ Connects Shopify, eBay, Amazon, suppliers, etc.
→ AI discovers opportunities
→ AI evaluates products
→ AI compares suppliers
→ AI estimates costs, margins, and risks
→ Merchant approves actions
→ TradeOps prepares listings / workflows
→ Merchant publishes and operates their business
```

### Who owns what

| Asset | Owner |
|-------|--------|
| Stores / channel accounts | Merchant |
| Payment processors (Shopify Payments, Stripe, PayPal, Amazon, eBay, …) | Merchant / channel |
| Inventory and purchasing decisions | Merchant |
| Customer card data and checkout | Merchant’s processors — never TradeOps |
| Subscription revenue for the product | TradeOps (SaaS billing) |
| Recommendations, automation, orchestration | TradeOps |

### What merchants pay TradeOps for

- Software access (subscriptions, seats, AI usage, storage, automation)
- Optional operational coordination fees only if separately contracted later  
- **Not** for managing pooled investment capital or custody of deposits

### What TradeOps does **not** do (primary product)

- Take custody of client investment capital  
- Pool merchant funds into a fund  
- Promise or guarantee investment returns  
- Operate as a securities portal or investment manager  
- Replace Shopify Payments / Amazon / eBay checkout as the merchant of record for shopper sales  

---

## Financial domains that match this model

| Domain | Role in primary product |
|--------|-------------------------|
| **1. SaaS billing** | Merchant → Stripe → TradeOps subscription. **Core.** |
| **2. Commerce payment intelligence** | Ingest *events* from merchant channels (order paid, refund, payout). Normalize for ops and P&amp;L. **Not** processing shopper cards. |
| **3. Capital / “commerce network funding”** | **Not the primary product.** Architected only as optional future modules with regulated partners. Default: disabled / sandbox / not marketed as investment. |

Customer (shopper) money continues through whatever processor the merchant already uses.

---

## Why this architecture is preferred

1. **Commercially clear** — “AI operating system for multichannel commerce.”  
2. **Easier to sell** — SaaS + connectors + approvals, not an investment story.  
3. **Lower regulatory surface** — not managing client investment money or pooling deposits.  
4. **Still responsible** — privacy, tax, consumer protection, and other applicable laws remain.  
5. **Scalable** — execution and intelligence can deepen without becoming a bank or fund.  

FINTRAC / payment-service registration depends on **actual activities**, not merely using Stripe for SaaS. Selling software and orchestrating workflows while regulated processors move shopper funds is a simpler posture than accepting deposits, transmitting money for others, or running a wallet. **If** TradeOps later holds client funds, facilitates third-party transfers, or offers financial services, obligations must be reassessed **before** launch—with counsel and partners.

---

## Language guide

| Prefer | Avoid (primary product) |
|--------|-------------------------|
| AI commerce operating system | Investment platform |
| Operating recommendations / signals | Investment advice / guaranteed yields |
| Contribution profit / realized P&amp;L | Guaranteed returns |
| Channel payment intelligence | TradeOps wallet for shoppers |
| Merchant-owned stores and checkout | We hold your capital and deploy it for returns |
| Commerce budget (if any internal ops tool) | Pooled investor capital marketplace |

Commerce signals (BUY, SELL, HOLD, SCALE, …) are **operational recommendations**, not securities advice.

---

## Future modules (explicitly separate)

If TradeOps later adds:

- embedded financial products  
- lending  
- capital / funding services  

…those must be **separate product modules**, with:

- regulated partners (payments, custody, portal as required)  
- dedicated legal and AML work  
- feature gates remaining off until approved  
- no mixing with SaaS billing or ordinary shopper payment records  

Existing technical scaffolding under `/capital` and `/network` is **architecture reserve / sandbox**, not the marketed core product, until that counsel path is complete.

---

## Public claim checklist

**We claim:** intelligence, evaluation, workflows, approvals, multichannel orchestration, profit math that distinguishes forecast vs realized, honest connector status.

**We do not claim:** guaranteed profit or sales, perfect forecasts, live APIs without credentials, autonomous purchasing without approval, investment management, fund custody, or licenses we have not obtained.

---

## Related docs

- [TRADEOPS_PRODUCT_SPEC.md](./TRADEOPS_PRODUCT_SPEC.md)  
- [TRADEOPS_PUBLIC_PRODUCT.md](./TRADEOPS_PUBLIC_PRODUCT.md)  
- [TRADEOPS_PAYMENT_ARCHITECTURE.md](./TRADEOPS_PAYMENT_ARCHITECTURE.md)  
- [TRADEOPS_COMMERCE_CAPITAL_BOUNDARY.md](./TRADEOPS_COMMERCE_CAPITAL_BOUNDARY.md) (deferred capital rails)  
