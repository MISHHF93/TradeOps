# TradeOps Product Spec

> **Runtime note:** This is the product vision. Local implementation status is tracked in  
> [IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) (fixture-backed terminal is REAL).

## Identity

**TradeOps** is a predictive multichannel commerce operating system — a **trading terminal for physical products**.

It helps operators discover, evaluate, source, list, sell, fulfill, and monitor physical goods across connected ecommerce ecosystems.

Commerce signals (BUY, SELL, HOLD, SCALE, REDUCE, EXIT, BLOCKED) are **operational recommendations**, not securities or investment advice.

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
