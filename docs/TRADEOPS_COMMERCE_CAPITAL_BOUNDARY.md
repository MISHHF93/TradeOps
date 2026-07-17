# TradeOps Commerce Capital — Regulatory & Product Boundary

**Status:** Deferred architecture / sandbox only — **not the primary product**  
**Primary product:** [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md) — AI Commerce OS (SaaS + intelligence + execution)

**Not:** Pooled investment fund, guaranteed returns, internal bank, securities portal  

## Primary product (what we market)

TradeOps is an **AI commerce intelligence and execution platform**. Merchants pay via **Stripe SaaS**, connect their own channels, and keep ownership of stores and payment processors. Shopper funds never need to flow through TradeOps as investment capital.

Capital / network funding modules exist only as **optional future architecture** with regulated partners—not the default commercial story.

## If capital modules are ever launched (future)

Prefer language:

* commerce budget  
* operating capital  
* commerce performance  
* CommerceMandate  

Avoid until counsel approves:

* investment returns  
* guaranteed yields  
* profit sharing as a public product  
* “wallet” as if TradeOps holds client money  

## Explicit non-claims

| Claim | TradeOps stance |
|-------|-----------------|
| Promises investment returns | **No** |
| Pools client capital into one fund | **No** (`TRADEOPS_POOLED_INVESTMENT_ENABLED` forced off in production) |
| Client owns / controls commerce account | **Yes** (target model) |
| Funds in ordinary TradeOps operating bank | **No** — partner custody / connected accounts only |
| TradeOps role | Commerce automation & orchestration under mandate |
| Consequential actions | Policy + approval; AI cannot bypass |
| Securities / crowdfunding / MSB | **Disabled** until authorized structure |

## Five financial rails (never mix)

1. **SaaS billing** — client pays TradeOps for software  
2. **Shopper commerce payments** — customers buy products  
3. **Client operating capital** — client funds their commerce budget  
4. **Supplier / service payments** — controlled deployment  
5. **Settlements & client payouts** — proceeds out via partner  

## Feature flags

```text
TRADEOPS_CAPITAL_MODE=client_owned   # recommended default product mode
TRADEOPS_POOLED_INVESTMENT_ENABLED=false
TRADEOPS_GUARANTEED_RETURNS_ENABLED=false
TRADEOPS_INTERNAL_CUSTODY_ENABLED=false
```

Production hard-stops: pooled investment, guaranteed returns, and internal custody **cannot** be enabled by env alone.

## Safest first commercial structure

```text
Client-owned account
→ client-funded commerce budget
→ TradeOps automation within CommerceMandate
→ approved procurement / advertising
→ client-owned listings and revenue
→ TradeOps fees (subscription / coordination / application)
```

Not: “1,000 users deposit into one pool and AI invests.”

## Counsel required before

* Public capital marketplace  
* Performance / profit-share fees as investment product  
* FINTRAC MSB / crowdfunding portal registration claims  
* Custody of third-party funds without a licensed partner  

## Related docs

* [TRADEOPS_FINANCIAL_DOMAIN_BOUNDARIES.md](./TRADEOPS_FINANCIAL_DOMAIN_BOUNDARIES.md)  
* [TRADEOPS_COMMERCE_CAPITAL_ARCHITECTURE.md](./TRADEOPS_COMMERCE_CAPITAL_ARCHITECTURE.md)  
* [TRADEOPS_CAPITAL_COMPLIANCE_GATES.md](./TRADEOPS_CAPITAL_COMPLIANCE_GATES.md)  
