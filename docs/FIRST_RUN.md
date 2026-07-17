# First run — TradeOps

## Correct commands

| Goal | Command |
|------|---------|
| First-time install + build | `pnpm setup` |
| DB + seed (auto PGlite if needed) | `pnpm run bootstrap:local` |
| Start product (API + web) | `npm start` or `pnpm start` |
| Full commerce demo loop | `pnpm run demo:loop` (or UI button) |
| Weekend Google feed (shadow) | `pnpm run google:weekend -- --shadow` |
| Stop apps (free ports) | `npm run stop` |
| Development hot rebuild | `pnpm dev` |
| Keep PGlite DB process only | `pnpm run db:pglite` |

`npm starrt` is a typo — use `npm start`.

## Direct Founder Access (default)

With `TRADEOPS_ACCESS_MODE=founder_direct` (default):

1. `npm start`
2. Open **http://localhost:3000** → **`/terminal/workspace`** → active **persona home** (intelligence surface)
3. No login, register, or onboarding

See [TRADEOPS_DIRECT_FOUNDER_ACCESS.md](./TRADEOPS_DIRECT_FOUNDER_ACCESS.md).

## Prerequisites

1. **Node.js ≥ 20** and **pnpm 9** (`npm install -g pnpm@9.15.0`)
2. **A database** (pick one):
   - **A. Prisma Dev / PGlite (recommended on this Windows host):** `pnpm run db:pglite` or via `bootstrap:local` / `npm start` auto-start  
   - **B. Docker:** `docker compose up -d` (if Docker is allowed)  
   - **C. System PostgreSQL** on 5432 — see [WINDOWS_APP_CONTROL.md](./WINDOWS_APP_CONTROL.md)  
   - **D. Hosted Postgres** (Neon/Supabase) — set `DATABASE_URL` in `.env`  
   - **E. Embedded** (`pnpm run db:local`) — only if policy allows Postgres binaries (often **blocked**)
3. **Redis** optional for first UI (health may show `degraded`)

> **This Windows host:** Application Control blocks system/embedded Postgres binaries and Docker may be missing. Use **PGlite** (`bootstrap:local`).

## Recommended sequence (App Control / no Docker)

```powershell
cd C:\Users\borah\TradeOps
pnpm install
# If native addons are blocked:
# pnpm install --ignore-scripts
copy .env.example .env
pnpm setup
pnpm run bootstrap:local
npm start
```

Optional — fill the full pipeline after start:

```powershell
pnpm run demo:loop
```

Open (with default `founder_direct`):

| URL | What |
|-----|------|
| http://localhost:3000 | → `/terminal/workspace` → **persona home** (intelligence) |
| http://localhost:3000/terminal/workspace | Resolver entry (redirects to persona home) |
| http://localhost:3000/terminal/workspace?switch=1 | Switch persona |
| http://localhost:3000/terminal/process | Commerce Process board (shared spine) |
| http://localhost:3000/terminal/ai | AI Execution Navigator + **RAG Engine** (train/query) |
| http://localhost:3000/terminal/objectives | Durable objective / Execution Package history |
| http://localhost:3000/terminal/connectors | Connector Ops Center |
| http://localhost:3000/terminal | Discover / product scan |
| http://localhost:3000/terminal/cockpit | Redirect → executive workspace |
| http://localhost:3000/tools | Free calculators (profit · score · policy) |
| http://localhost:3000/status | Capability honesty board |
| http://localhost:4000/api/v1/health/live | API process liveness |

### See intelligence + AI objective quickly

1. Open persona home — ranked priorities + health score  
2. Click **Resolve focus objective** or **Ask AI** on an insight  
3. Optional RAG: open `/terminal/ai` → **Train / reindex** → **Query knowledge**  
4. Optional free-form grounded answers: set `XAI_API_KEY` (server-side only) — see [TRADEOPS_RAG_ENGINE.md](./TRADEOPS_RAG_ENGINE.md)  

### Verify package tests (after pull)

```powershell
pnpm --filter @tradeops/connector-core test
pnpm --filter @tradeops/connector-live-http test
pnpm --filter @tradeops/commerce-engine test
pnpm --filter @tradeops/ai-runtime test
pnpm --filter @tradeops/workflow-engine test
pnpm --filter @tradeops/api build
pnpm --filter @tradeops/web typecheck
```

3. Or: `GET http://localhost:4000/api/v1/workspace/intelligence` (with session/cookies)  

Optional simulation: `TRADEOPS_SIMULATION_MODE=1` labels fixture data.  
Optional live connectors: set `SHOPIFY_*`, `STRIPE_SECRET_KEY`, etc., then `POST /api/v1/ops/connectors/live-sync`.

Set `TRADEOPS_ACCESS_MODE=authenticated` to restore marketing `/` + login/register UX.

## Sequence (Docker)

```powershell
cd C:\Users\borah\TradeOps
pnpm install
copy .env.example .env
# Set DATABASE_URL to compose Postgres (see .env.example option A)
docker compose up -d
pnpm setup
pnpm run setup:db
npm start
```

## Local access

`/` is the **public website**. Operators use `/terminal` (workspace). Auth options:

1. **Register / sign in** at `/register` and `/login` (real session cookies), or  
2. **`AUTH_BYPASS=true`** (default in development) → API acts as seeded demo owner without a cookie  

- Seeded identity: `founder@tradeops.local` / `TradeOps-Demo-2026!` / org **demo-commerce**  
- Bypass is **never** active when API runs with `NODE_ENV=production` (local `npm start` keeps API on development for bypass)

### Full commerce loop

```powershell
pnpm run demo:loop
```

Or click **Run fixture development loop** on Scanner / Pipeline.

Flow: simulate → listing draft → approve → ingest orders → PO approve → fulfill → evaluate.

### Weekend Google automation

```powershell
pnpm run google:weekend -- --shadow
```

- **Shadow (default):** prepares a Google Merchant product feed, skips policy-blocked SKUs, never claims live success.  
- **Schedule:** API arms an hourly scheduler; runs once Sat/Sun 09:00–10:59 local.  
- **Live:** only with `GOOGLE_MERCHANT_ACCESS_TOKEN` + `GOOGLE_MERCHANT_ID` and a wired Content API client — no fabricated posts.  
- UI: http://localhost:3000/terminal/automations  

### Public free tools API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/public/tools/catalog` | Tool list |
| POST | `/api/v1/public/tools/unit-economics` | Contribution profit |
| POST | `/api/v1/public/tools/opportunity-score` | Explainable 0–100 score |
| POST | `/api/v1/public/tools/policy-check` | Fail-closed policy gate |

Same math as the terminal (`@tradeops/commerce-engine`). No private store data.
Then open http://localhost:3000/terminal/pipeline.

### API timeouts

Web client default is **60s** (`API_TIMEOUT_MS` / `NEXT_PUBLIC_API_TIMEOUT_MS`).  
PGlite can exceed 4s; do not set timeouts below ~15s on this host.

## If start fails

| Symptom | Fix |
|---------|-----|
| `Missing script: start` | Run from repo root `C:\Users\borah\TradeOps` |
| `npm starrt` | Typo — use `npm start` |
| `EADDRINUSE … 3000/4000` | `npm run stop` then `npm start` |
| `API is not built yet` / `Web is not built yet` | `pnpm setup` or `pnpm build` |
| `API timeout after …ms` | Raise `API_TIMEOUT_MS`; ensure PGlite is up; rebuild web |
| Postgres / DB unreachable | `pnpm run db:pglite` or `pnpm run bootstrap:local` |
| Redis `ECONNREFUSED` | Optional for first UI; health may be `degraded` |
| Health `degraded` | Apps can boot; terminal data needs working Postgres/PGlite |
| Empty scanner | `pnpm run setup:db` or toolbar **Import fixtures** |

### Clean restart

```powershell
cd C:\Users\borah\TradeOps
npm run stop
npm start
```
