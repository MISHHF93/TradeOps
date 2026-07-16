# TradeOps — Working Plan (current truth)

**Product:** TradeOps — The AI Operating System for Global Commerce  
**Updated:** 2026-07-16  
**Status:** Dual-surface launch prep **operational** — public website + authenticated workspace + capability honesty board; live marketplaces still credential-blocked  

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
7. No silent auto-publish to live marketplaces without policy + human approval.  

---

## What works today (local)

| Area | Status | How to use |
|------|--------|------------|
| API + Web | REAL | `npm start` → http://localhost:3000 |
| Public website | REAL | `/`, `/product`, `/how-it-works`, `/integrations`, `/pricing`, `/security`, `/docs`, `/contact`, `/status` |
| Public free tools | REAL | `/tools`, `/tools/profit\|score\|policy` |
| Merchant register / sign-in | REAL | `/register`, `/login` → session cookies |
| Capability honesty board | REAL | `/status` · `GET /api/v1/public/capabilities` |
| Local AUTH_BYPASS | ADMIN | Dev only; off in production |
| PGlite DB path | REAL | `pnpm run bootstrap:local` or `db:pglite` |
| Fixture supplier/marketplace | FIXTURE | Seeded DEV connectors |
| Scanner + scores + signals | REAL | `/terminal` |
| Pipeline board | REAL | `/terminal/pipeline` |
| Fixture development loop | REAL | UI “Run fixture development loop” or `pnpm run demo:loop` (fixture-labeled) |
| AI operator workspace | REAL (shadow) | `/terminal/ai` · typed tools + critic/auditor |
| Identity harmonization | REAL | `/api/v1/ai/harmonize` — confidence-scored; no title-only auto-merge |
| Event fabric | REAL | commerce events + webhook receipts with loop-mode labels |
| Profit / policy / forecast baselines | REAL | `@tradeops/commerce-engine` |
| Google weekend automation | REAL (shadow) | `/terminal/automations` · `pnpm run google:weekend` · Sat/Sun 09:00 scheduler |
| Real Google live post | BLOCKED | Needs `GOOGLE_MERCHANT_*` OAuth + Content API client |
| Real Shopify/Amazon | BLOCKED | Needs merchant credentials + authorized OAuth |
| Neural forecasting | STUB | Baseline MA only |
| Automation engine (M5) | Partial | Weekend Google + AI operator tools; general rules engine pending |

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
| http://localhost:3000 | Public landing (free tools + terminal entry) |
| http://localhost:3000/tools | Free public calculators |
| http://localhost:3000/terminal | Operator terminal (no login) |
| http://localhost:3000/terminal/automations | Weekend Google automation |
| http://localhost:3000/terminal/pipeline | Pipeline board |
| http://localhost:4000/api/v1/health/live | API liveness |
| http://localhost:4000/api/v1/public/tools/catalog | Public tools API catalog |
| http://localhost:4000/api/v1/automation/google/weekend/status | Weekend job status |
| http://localhost:4000/api/v1/auth/me | Demo identity (bypass) |

Details: [docs/FIRST_RUN.md](docs/FIRST_RUN.md) · [docs/TRADEOPS_LOCAL_SETUP.md](docs/TRADEOPS_LOCAL_SETUP.md) · [docs/WINDOWS_APP_CONTROL.md](docs/WINDOWS_APP_CONTROL.md)

### Env highlights

- `AUTH_BYPASS=true` — local demo owner without cookies  
- `DATABASE_URL=...pgbouncer=true&connection_limit=5` — PGlite-friendly  
- `API_TIMEOUT_MS=60000` — web client must not use 4s timeouts  
- `GOOGLE_MERCHANT_ACCESS_TOKEN` + `GOOGLE_MERCHANT_ID` — optional; without them weekend job stays **shadow**  
- `GOOGLE_MERCHANT_DATA_SOURCE_ID` — optional data source for live ProductInput  

### Weekend Google automation (honest modes)

1. **Shadow (default):** prepare Merchant feed from org products, skip policy-blocked SKUs, never claim live success.  
2. **Scheduler:** hourly check; runs once Sat/Sun 09:00–10:59 local.  
3. **Manual:** UI buttons on `/terminal/automations` or `pnpm run google:weekend -- --shadow`.  
4. **Live:** only when OAuth credentials are set **and** Content API client is fully wired — until then credentials present still report prepared-only (no fabricated post).  

### Public benefit web app

- Same math as the operator terminal (`@tradeops/commerce-engine`).  
- No private store data; pure calculators at `/api/v1/public/tools/*`.  
- Landing at `/` links Free tools + Terminal + Automations.  

---

## Milestone status

| ID | Name | Status |
|----|------|--------|
| M0 | Platform foundation | **Complete** |
| M1 | Auth, orgs, RBAC (API) | **Complete** (web login UI removed for local-first) |
| M2a | Connector framework + fixtures | **Complete** |
| M2b | Real Shopify | **Next** — credentials |
| M3 | Commerce domain + terminal | **Complete** (fixture-backed) |
| M4 | Profit + cash flow + pricing | **Partial** — unit economics + portfolio REAL + public tools |
| M5 | Automation engine | **Partial** — weekend Google + event fabric + AI operator REAL; rules engine pending |
| M6 | AI intelligence | **Partial** — operator tools + critic/auditor + evaluation REAL; LLM/neural optional STUB |
| M7 | Second connector + marketplace manager | Pending |
| M8 | Suppliers, shipping, payments depth | Pending |
| M9 | Developer platform | Pending |
| M10 | Production hardening | Pending |

---

## Loop modes (honest)

| Mode | Meaning |
|------|---------|
| **fixture** | Deterministic fake products/events for tests — never labeled live |
| **development** | Real DB, contracts, sandbox/dev credentials, production-compatible paths |
| **shadow** | Real data + real AI decisions; consequential execution approval-controlled |
| **controlled_live** | Production APIs with policy limits + human approval |
| **automated_live** | Only proven low-risk workflows auto-execute within limits |

Shadow is **not** a decorative demo — it is live evaluation without immediate money risk.

## Next work

1. **Wire live Google Merchant Content API** when OAuth scopes + merchant ID exist (never claim success without authorized HTTP).  
2. **M2b Shopify GraphQL Admin** when merchant credentials + app config exist ([SHOPIFY_CREDENTIALS](docs/TRADEOPS_SHOPIFY_CREDENTIALS.md)).  
3. Optional SpaceXAI (`XAI_API_KEY`) for free-form objective interpretation — operator already works deterministically without it.  
4. Keep fixture development loop green as regression baseline.  
5. Optional Redis for worker jobs when Docker/service available.  
6. Publish/public deploy of free tools site when ready for external users.  

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
