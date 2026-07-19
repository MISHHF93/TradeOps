# TradeOps Release Close-Out

**AI Commerce Operating System** — close-out of Live Connectors · AI Navigator · Persona Workspaces · Intelligence.

---

## What shipped

### Live operational data
- Production connector registry (35+ providers)
- Credential-gated live HTTP (**12 adapters**): Shopify, Stripe, FX, WooCommerce, EasyPost, SerpAPI, BigCommerce, eBay Inventory, PayPal balances, ShipStation, Keepa, Square
- Webhook queue + normalizer + Ops scheduler (orgs-with-installs + per-provider cooldown)
- Ops Center health, live-sync, capability resolve
- Production isolation on scanner/portfolio (`TRADEOPS_PRODUCTION_WORKSPACE`)
- Demand forecast **baseline-ma-v2** (trend-aware SMA; still labeled non-neural)
- No `connected` status without env credentials; stubs never fabricate payloads

### AI Execution Navigator
- Objectives → 10-section Execution Packages
- Evidence, ranked options, engineering tasks, verification
- Knowledge deltas on OperatorRun for continuous learning
- `POST /ai/navigator/resolve` · operator run navigates by default

### One User · One Workspace · One Objective · One AI
- Dynamic Focus + More sidebar per persona
- Landing: `/` → `/terminal/workspace` → **persona home** (intelligence surface)
- Persona switch: `/terminal/workspace?switch=1`
- AI-first command bar navigation

### Operational Intelligence
- Live signals ranked by persona (blockers, approvals, orders, opportunities, connectors, fixtures…)
- Attention score + health label
- Focus objective drives AI panel and “Resolve focus objective”
- `GET /workspace/intelligence`

---

## How to run locally and see intelligence + AI

```powershell
cd C:\Users\borah\TradeOps
pnpm install
pnpm run bootstrap:local   # if DB needed
npm start                  # or pnpm start
```

1. Open **http://localhost:3000**  
2. You land on your **persona workspace home** (researcher by default for founder).  
3. Read **Today’s priorities**, **Intelligence insights**, health score.  
4. Click **Resolve focus objective** or **Ask AI** on an insight.  
5. Optional: `TRADEOPS_SIMULATION_MODE=1` for labeled simulation.  
6. Optional live: set `SHOPIFY_SHOP_DOMAIN` + `SHOPIFY_ACCESS_TOKEN` (and/or `STRIPE_SECRET_KEY`), then:

```http
POST /api/v1/ops/connectors/ensure-registry
POST /api/v1/ops/connectors/live-sync
GET  /api/v1/ops/connectors/health
GET  /api/v1/workspace/intelligence
```

---

## Verify

```powershell
pnpm --filter @tradeops/connector-core test
pnpm --filter @tradeops/connector-live-http test
pnpm --filter @tradeops/ai-runtime test
pnpm --filter @tradeops/commerce-engine test
pnpm --filter @tradeops/api build
pnpm --filter @tradeops/web typecheck
```

Core package tests (2026-07-17 verification re-run): **all green** — config 25, auth 4, connector-core 14, live-http 5, commerce-engine 56, ai-runtime 19 (incl. RAG), workflow-engine 4, saas 3, fixtures 1+1, google-merchant 3, harmonization 3, logging 1, database 2, contracts 3.  
API build + web typecheck + worker build green.

---

## Residual backlog (not hidden)

| Item | Status |
|------|--------|
| HTTP adapters for Amazon SP-API, carriers, ads, analytics, accounting | PARTIAL — registry ready |
| OAuth install UIs per provider | PARTIAL — env/token path works |
| Prometheus/Grafana/Sentry production hard-wire | PARTIAL — registry + telemetry hooks |
| Multi-org live-sync rate limiting | **DONE foundations** — cooldown + install-targeted orgs |
| Scanner/portfolio production isolation | **DONE** — env-gated filter |

See `TRADEOPS_CLOSEOUT_AUDIT.md` for the full matrix.

---

## Principle (non-negotiable)

- **No fabricated production KPIs**  
- **Fixtures and simulation always labeled**  
- **AI starts from objectives, not chat**  
- **Navigation shows what matters now, not everything the platform can do**  

---

## Key docs

| Doc | Purpose |
|-----|---------|
| `TRADEOPS_CLOSEOUT_AUDIT.md` | Gap matrix |
| `TRADEOPS_WRAP_UP_PROMPT.md` | Re-runnable wrap-up prompt |
| `TRADEOPS_CONNECTOR_ECOSYSTEM.md` | Connectors |
| `TRADEOPS_AI_EXECUTION_NAVIGATOR.md` | AI packages |
| `TRADEOPS_WORKSPACE_IA.md` | Persona IA |
| `TRADEOPS_INTELLIGENCE_ENGINE.md` | Smart ranking |
| `FIRST_RUN.md` | Local bootstrap |
