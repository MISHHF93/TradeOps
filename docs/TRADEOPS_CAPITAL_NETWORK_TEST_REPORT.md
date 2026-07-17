# Commerce Capital Network — Test Report

**Date:** 2026-07-17  

## Unit tests

| Suite | Coverage |
|-------|----------|
| `packages/config` financial-gates | Defaults OFF; sandbox ON; assert throws; catalog domains |
| `capital-ledger.test.ts` | Balance check; funding/disbursement journals; derive balances |
| `distribution-waterfall.test.ts` | Profit path; loss path; determinism |

## Expected integration scenarios

| Scenario | Expected |
|----------|----------|
| GET `/capital/status` | writeMode sandbox; isLicensedInvestmentPortal false |
| Create sandbox campaign | draft + budget |
| Budget overrun disbursement | 400 |
| Profit-share model without gate | 403 |
| Public opportunities UI | Unavailable copy when gate off |
| Dry-run waterfall | calculated; executionAllowed false by default |
| SaaS billing still separate | `/billing/*` unchanged |
| Channel payments still separate | `/finance/*` unchanged |

## Build

`pnpm test` (api + config) · `pnpm build` · migrate `20260717120000_platform_and_capital_network`
