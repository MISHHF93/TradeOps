# TradeOps Financial Domain Boundaries

## Three domains (never mix tables or UX labels)

```text
1) SaaS Billing
   Who pays: merchant organization → TradeOps
   Why: subscription / usage for the product
   Models: BillingAccount, BillingSubscription, BillingInvoice
   UI: /app/billing
   Provider: Stripe Billing

2) Commerce / Platform Payments
   Who pays: shoppers → channels OR platform checkout → merchants/suppliers
   Why: sell goods, pay sellers, platform fees
   Models: CommercePayment*, PlatformConnectedAccount, PlatformTransfer
   UI: /terminal/finance/*, marketplace status
   Provider: channel processors; optional Stripe Connect later

3) Commerce Capital
   Who pays: capital provider → safeguarded campaign budget
   Why: finance inventory/ads/ops with possible return under a legal structure
   Models: CapitalProvider, CommerceCampaign, CapitalCommitment, CapitalLedgerEntry, …
   UI: /capital/*
   Status: sandbox / gated — not public solicitation by default
```

## Forbidden mixes

| Do not | Why |
|--------|-----|
| Store investor capital in SaaS `BillingAccount` | Wrong domain; operating revenue ≠ custody |
| Treat channel `CommercePayment` as investment return | Shopper payment ≠ capital distribution |
| Use one `paymentStatus` for all three | Confuses lifecycle and compliance |
| Mark commitment `funded` without provider evidence (live mode) | False custody claim |
| AI-move capital or promise returns | Regulatory + product integrity |

## Feature-gate enforcement

Backend: `assertFinancialGate` / `capitalWriteMode()` in `@tradeops/config`.  
UI: clear “unavailable pending legal approval” copy — not just hidden buttons.
