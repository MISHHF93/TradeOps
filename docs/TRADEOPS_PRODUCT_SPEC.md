# TradeOps Product Spec

> **Runtime note:** This is the product vision. Local implementation status is tracked in  
> [IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) (fixture-backed terminal is REAL).  
> **Positioning:** [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md) · **Pillars:** [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md)

## Identity

**TradeOps** is **the AI Commerce Operating System for modern merchants**—a unified layer above Shopify, BigCommerce, Amazon, eBay, suppliers, logistics, and analytics. It is **not** another e-commerce platform or investment product.

Merchants **own** stores, payment accounts, and business decisions. TradeOps provides **intelligence, automation, and execution assistance**. Commerce signals (BUY, SELL, HOLD, SCALE, REDUCE, EXIT, BLOCKED) are **operational recommendations**, not securities or investment advice.

### Six pillars

1. **Commerce Intelligence** — proactive discovery, landed cost, margin, risk, recommendations  
2. **Commerce Operations** — one lifecycle: Discover → … → Reconcile → Learn  
3. **Unified Connector Hub** — capability-based connectors, canonical data  
4. **AI Operator** — operational manager; approvals for consequence  
5. **SaaS Billing** — Stripe subscriptions only  
6. **Enterprise Layer** — multi-org, RBAC, audit, governance  

### Core commercial loop

```text
Subscribe (Stripe SaaS) → connect channels/suppliers → AI discover/evaluate
→ merchant approves → prepare listings → merchant operates → measure realized P&L
```

Shopper checkout remains with the merchant’s processors (Shopify Payments, Amazon, eBay, PayPal, etc.).

## Primary questions answered

1. What products appear worth selling?  
2. Where can they be sourced?  
3. Where can they be sold?  
4–6. Expected total cost, selling price, net profit?  
7–8. Confidence and failure modes?  
9. Legal / policy fitness?  
10. Launch, observe, scale, reduce, or exit?

Optimize for **realized net profit and healthy cash flow**, not vanity revenue.

## Primary UI surfaces

- **Terminal / Scanner** — dense opportunity table  
- **Product Detail Terminal** — costs, forecasts, risks, actions  
- **Signal Feed** — new recommendations and exceptions  
- **Portfolio** — active products, capital, P&amp;L, concentration  

## Execution modes

| Mode | Default |
|------|---------|
| Draft | Listing/PO drafts only |
| Simulation | Paper trading of opportunities |
| Approval-required | **Default for real actions** |
| Limited automation | Opt-in later |
| Full automation | **Off by default** |

## Vertical slice goal

One working loop: fixture supplier + fixture marketplace → import → score → signal → simulate → listing draft → approve → order → supplier PO draft → profit + outcome tracking.
