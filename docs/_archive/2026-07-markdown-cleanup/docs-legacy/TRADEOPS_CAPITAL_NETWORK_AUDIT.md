# TradeOps Commerce Capital Network — Financial Audit

**Date:** 2026-07-17  
**Scope:** Three financial domains + readiness for campaign-based capital  

## What exists (operational / foundations)

| Area | Status | Notes |
|------|--------|-------|
| SaaS Billing (Stripe Checkout/Portal/webhooks) | **Operational foundations** | `BillingAccount`, fixture when no keys |
| Channel commerce payments | **Operational foundations** | `CommercePayment`, source gate, payouts, reconciliation |
| Entitlements / plan tiers | **Operational** | `saas-entitlements` |
| Approvals | **Operational** | Listing + supplier PO |
| Audit events | **Operational** | `AuditEvent` |
| Multi-tenant org isolation | **Operational** | RBAC + org scoping |
| Identity (session / founder_direct) | **Operational** | Not investor KYC |

## What was missing (pre this work)

| Area | Status before |
|------|---------------|
| Platform Connect accounts | Missing |
| Commerce Capital models | Missing |
| Campaign budgets / disbursements | Missing |
| Double-entry capital ledger | Missing |
| Distribution waterfall | Missing |
| Regulatory feature gates | Missing |
| Capital UI | Missing |
| Separation of capital vs SaaS vs channel pay | Documented as dual only |

## What this change adds

| Area | Status now |
|------|------------|
| Feature gates (`packages/config` financial-gates) | **Done** — sensitive defaults OFF |
| Platform connected accounts + transfers | **Architected / sandbox** |
| Capital campaigns, budgets, commitments, disbursements, distributions | **Sandbox** |
| Double-entry journal helpers + tables | **Done** |
| Waterfall calculator | **Done** (deterministic, no return promises) |
| Capital UI `/capital/*` | **Done** with disabled messaging |
| Docs suite | **Done** |

## Must remain disabled pending legal approval

- Public campaign solicitation (`PUBLIC_CAMPAIGNS_ENABLED`)
- Investor onboarding as accredited flow (`INVESTOR_ONBOARDING_ENABLED`)
- Profit-sharing offerings (`PROFIT_SHARING_ENABLED`)
- Equity offerings (`EQUITY_OFFERINGS_ENABLED`)
- Pooled / managed portfolios (`POOLED_INVESTMENT_ENABLED`)
- Automated investment advice (`AUTOMATED_INVESTMENT_ADVICE_ENABLED`)
- Live custody of investor funds (`CAPITAL_CUSTODY_ENABLED`)
- Executing distributions (`DISTRIBUTIONS_ENABLED`)
- Live Stripe Connect (`MARKETPLACE_CONNECT_ENABLED`)

## Honest product claim

TradeOps is the **operational and ledger layer** between commerce execution and (eventually) regulated capital. It is **not** a licensed investment portal, dealer, or crowdfunding platform unless that status is separately obtained.
