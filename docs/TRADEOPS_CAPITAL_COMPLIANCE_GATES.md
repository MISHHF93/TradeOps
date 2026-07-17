# Capital Compliance Gates

Source: `packages/config/src/financial-gates.ts`

| Gate | Default | Category |
|------|---------|----------|
| CAPITAL_SANDBOX_ENABLED | **true** | sandbox |
| PRIVATE_AGREEMENT_LEDGER_ENABLED | false | private_agreement |
| CAPITAL_NETWORK_ENABLED | false | legal_review_required |
| PUBLIC_CAMPAIGNS_ENABLED | false | legal_review_required |
| INVESTOR_ONBOARDING_ENABLED | false | legal_review_required |
| PROFIT_SHARING_ENABLED | false | legal_review_required |
| EQUITY_OFFERINGS_ENABLED | false | legal_review_required |
| POOLED_INVESTMENT_ENABLED | false | disabled |
| AUTOMATED_INVESTMENT_ADVICE_ENABLED | false | disabled |
| CAPITAL_CUSTODY_ENABLED | false | legal_review_required |
| DISTRIBUTIONS_ENABLED | false | legal_review_required |
| MARKETPLACE_CONNECT_ENABLED | false | provider_blocked |

Set via env booleans (`true`/`1`/`yes`/`on`). Backend throws if a disabled gate is required for an action.

## AI boundaries

AI **may**: economics summary, risk listing, inconsistency checks, scenario math, report drafts.  
AI **must not** (without approved framework): guarantee returns, fabricate forecasts as fact, determine eligibility alone, move funds, approve disbursements/distributions, hide losses.
