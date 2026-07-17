# TradeOps Commerce Capital Architecture

## Product intent

```text
Capital provider funds approved e-commerce campaign
→ purpose-restricted budget
→ controlled disbursements (prefer supplier direct pay)
→ commerce lifecycle produces realized sales/costs
→ waterfall calculates principal/profit/loss
→ distributions only when legally and operationally enabled
```

## Launch phases (product)

1. **Commerce Network** — verified merchants, Connect, expense controls (no outside investors)  
2. **Private capital workspace** — ledger for existing private agreements  
3. **Licensed capital network** — counsel + portal + custody + AML partners  
4. **Public marketplace** — only after full compliance  

Current code implements **Phase 1 architecture + Phase 2/4 scaffolding in sandbox**.

## Legal models (A–E)

| Model | Gate | Default |
|-------|------|---------|
| A Pre-purchase | prepurchase funding model | blocked outside sandbox without gates |
| B Merchant financing | commercial_financing | blocked outside sandbox |
| C Revenue share | `PROFIT_SHARING_ENABLED` | **OFF** |
| D Equity | `EQUITY_OFFERINGS_ENABLED` | **OFF** |
| E Managed portfolio | `POOLED_INVESTMENT_ENABLED` | **OFF** |

## Core tables

- `CapitalProvider`
- `CommerceCampaign` + `CampaignBudget`
- `CapitalCommitment`
- `CapitalLedgerEntry` (double-entry)
- `CapitalDisbursement`
- `CampaignDistribution`

## Fund-handling assumption (requires legal confirmation)

Investor/campaign money must **not** land in TradeOps ordinary operating bank accounts.  
Design target: provider-controlled or legally safeguarded balances (`CAPITAL_CUSTODY_ENABLED`).

Sandbox may simulate ledger entries with explicit labels — never presented as live custody.
