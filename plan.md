# TradeOps — Working Plan (current truth)

**Product:** TradeOps — The AI Operating System for Global Commerce  
**Updated:** 2026-07-16  
**Status:** Local vertical slice **operational**; real marketplaces next when credentials exist  

> **TradeOps owns the intelligence. External platforms own the transactions. TradeOps orchestrates.**

Long-form vision and design still live under `docs/` (see [docs/README.md](docs/README.md)).  
This file is the **execution truth** for what runs today and what is next.

---

## Binding principles (always)

1. Marketplace SDKs only under `packages/connectors/*` — never in web or core domain.  
2. Canonical multi-tenant models (`organizationId` on business rows).  
3. Money as integer minor units + currency.  
4. Fail closed on severe policy risk.  
5. Human approval before first listing publish and supplier PO execution.  
6. Commerce signals are operational recommendations — not securities advice.  
7. No silent auto-publish to live marketplaces without policy + approval.  

---

## What works today (local)

| Area | Status | How to use |
|------|--------|------------|
| API + Web | REAL | `npm start` → http://localhost:3000 |
| No login UI | REAL | `/` → `/terminal`; `AUTH_BYPASS` |
| PGlite DB path | REAL | `pnpm run bootstrap:local` or `db:pglite` |
| Fixture supplier/marketplace | FIXTURE | Seeded DEV connectors |
| Scanner + scores + signals | REAL | `/terminal` |
| Pipeline board | REAL | `/terminal/pipeline` |
| Demo loop | REAL | UI button or `pnpm run demo:loop` |
| Profit / policy / forecast baselines | REAL | `@tradeops/commerce-engine` |
| Real Shopify/Amazon | BLOCKED | Needs merchant credentials |
| Neural forecasting | STUB | Baseline MA only |
| Automation engine (M5) | Pending | — |

Ledger: [docs/TRADEOPS_IMPLEMENTATION_LEDGER.md](docs/TRADEOPS_IMPLEMENTATION_LEDGER.md)  
Verified: [docs/TRADEOPS_TEST_REPORT.md](docs/TRADEOPS_TEST_REPORT.md)

---

## How to run (source of truth)

```powershell
cd C:\Users\borah\TradeOps
pnpm install          # or: pnpm install --ignore-scripts
copy .env.example .env
pnpm setup
pnpm run bootstrap:local   # PGlite + migrate + seed
npm start
pnpm run demo:loop         # optional full commerce loop
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Terminal (no login) |
| http://localhost:3000/terminal/pipeline | Pipeline board |
| http://localhost:4000/api/v1/health/live | API liveness |
| http://localhost:4000/api/v1/auth/me | Demo identity (bypass) |

Details: [docs/FIRST_RUN.md](docs/FIRST_RUN.md) · [docs/TRADEOPS_LOCAL_SETUP.md](docs/TRADEOPS_LOCAL_SETUP.md) · [docs/WINDOWS_APP_CONTROL.md](docs/WINDOWS_APP_CONTROL.md)

### Env highlights

- `AUTH_BYPASS=true` — local demo owner without cookies  
- `DATABASE_URL=...pgbouncer=true&connection_limit=5` — PGlite-friendly  
- `API_TIMEOUT_MS=60000` — web client must not use 4s timeouts  

---

## Milestone status

| ID | Name | Status |
|----|------|--------|
| M0 | Platform foundation | **Complete** |
| M1 | Auth, orgs, RBAC (API) | **Complete** (web login UI removed for local-first) |
| M2a | Connector framework + fixtures | **Complete** |
| M2b | Real Shopify | **Next** — credentials |
| M3–M4 | Commerce terminal + profit | **Partial / largely complete** via fixtures |
| M5 | Automation engine | Pending |
| M6 | AI (beyond baselines) | Partial baselines; neural STUB |
| M7–M10 | Second connector … hardening | Pending |

Full table: [docs/architecture/MILESTONES.md](docs/architecture/MILESTONES.md)

---

## Next work (after local slice)

1. **M2b Shopify** when merchant credentials + app config exist ([SHOPIFY_CREDENTIALS](docs/TRADEOPS_SHOPIFY_CREDENTIALS.md)).  
2. Keep fixture loop green as regression baseline.  
3. Optional Redis for worker jobs when Docker/service available.  
4. Re-introduce multi-tenant login UI only when needed for multi-user SaaS demos.  

---

## Doc map

| Kind | Files |
|------|--------|
| Run the product | `docs/FIRST_RUN.md`, `docs/TRADEOPS_LOCAL_SETUP.md`, root `README.md` |
| What is real | `docs/TRADEOPS_IMPLEMENTATION_LEDGER.md`, `docs/TRADEOPS_TEST_REPORT.md` |
| Design / vision | `docs/TRADEOPS_PRODUCT_SPEC.md`, `TRADEOPS_ARCHITECTURE.md`, signal/pipeline/risk docs |
| Decisions | `docs/architecture/ADR-*.md` |
| Index | [docs/README.md](docs/README.md) |

---

## Will not do

- Marketplace logic in the dashboard or core domain  
- Big-bang microservices before scale pressure  
- AI auto-publishing without policy + human approval  
- Pretending neural models exist when only baselines run  
- Documenting `/login` as the primary path while local mode is AUTH_BYPASS-only  
