# TradeOps Implementation Ledger

Living record of what is **real**, **fixture/simulated**, **incomplete**, or **blocked by credentials**.

## Legend

| Tag | Meaning |
|-----|---------|
| REAL | Production-intent logic, runs locally |
| FIXTURE | Explicit development adapter, labeled as such |
| SIM | Commerce simulation mode (paper trading) |
| STUB | Interface present, not operational |
| BLOCKED | Requires merchant credentials / official API approval |

## Vertical slice (this execution) — shipped 2026-07-16

Verified live on this Windows host with **Prisma Dev (PGlite)** when system Postgres/Docker are blocked. Local product path: **no login UI**; `AUTH_BYPASS` + seed identity.

| Capability | Status | Notes |
|------------|--------|-------|
| Local API + web boot | REAL | Nest + Next; `npm start` |
| Postgres schema + migrations | REAL | Identity + commerce; PGlite URL uses `pgbouncer=true` |
| Local DB without Docker | REAL | `pnpm run db:pglite` (Prisma Dev / PGlite) |
| Session auth / RBAC | REAL | API preserved; web login UI removed for local-first |
| AUTH_BYPASS demo identity | REAL | `founder@tradeops.local` / org `demo-commerce` |
| Connector capability contracts | REAL | `packages/connector-core` |
| Fixture supplier connector | FIXTURE | `fixture-supplier` — DEV labeled |
| Fixture marketplace connector | FIXTURE | `fixture-marketplace` — DEV labeled |
| Product import via fixtures | REAL | Seed + `POST /commerce/import/fixture-supplier` |
| Market Scanner UI | REAL | `/terminal` dense table — 5 seeded rows live |
| Product detail terminal | REAL | `/terminal/products/[id]` |
| Opportunity score (explainable) | REAL | `opportunity-weighted-v1` components shown |
| Demand forecast baseline | REAL | `baseline-ma-v1` 7/14/30 |
| Commerce signals BUY/SELL/… | REAL | Signal feed + badges |
| Policy/safety gate | REAL | Fail-closed; weapon SKU BLOCKED (live) |
| Profit calculation (minor units) | REAL | Unit economics + cash-before-payout |
| Simulation mode | SIM | Paper trading + predicted vs actual |
| Listing draft | REAL | Pending approval before fixture publish |
| Human approval | REAL | `/terminal/approvals` — default on |
| Customer order model | REAL | Fixture order ingest |
| Supplier PO draft | REAL | Draft + approval gate |
| Fulfillment status | REAL | `awaiting_supplier` on ingest |
| Portfolio / cash flow views | REAL | Capital, revenue ≠ profit labels |
| Pipeline board | REAL | 12 stages; early stages complete after seed |
| Prediction vs outcome | REAL | `simulation_runs` + evaluation endpoints |
| Tests + production web build | REAL | See TRADEOPS_TEST_REPORT.md |
| Shopify / Amazon / real APIs | BLOCKED | Need merchant credentials + app setup |
| Live advertising APIs | BLOCKED | Not in slice |
| Neural forecasting | STUB | Intentionally not started |

## Credentials

No live marketplace or supplier secrets required for the vertical slice.  
Real connectors: configure later via encrypted vault (M2+); status never shows “Connected” without successful auth probe.

## Hardening (2026-07-16 refresh)

| Item | Status |
|------|--------|
| Seed loads scored products (not user/org only) | REAL |
| Scanner sort + filter + STALE marker | REAL |
| Cash flow page (revenue ≠ profit) | REAL |
| Shopify credential runbook | DOC only — connector BLOCKED |
| Docker on this Windows host | Unavailable — Compose files still REAL |
| Full pipeline board `/terminal/pipeline` | REAL |
| Complete fulfillment → actual profit | REAL |
| PredictionOutcome + ModelVersion evaluation | REAL |
| Auto model swap / neural upgrade | STUB — human decision via evaluation metrics only |
| Demo full loop script | REAL — `pnpm run demo:loop` + UI button |
| Demo loop API | REAL — `POST /api/v1/terminal/demo-loop` |
| Local bootstrap | REAL — `pnpm run bootstrap:local` (PGlite + migrate + seed) |
