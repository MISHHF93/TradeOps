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

Open:

| URL | What |
|-----|------|
| http://localhost:3000 | Public website (marketing + free tools) |
| http://localhost:3000/tools | Free calculators (profit · score · policy) |
| http://localhost:3000/login · `/register` | Real session auth (optional; AUTH_BYPASS also works in dev) |
| http://localhost:3000/status | Capability honesty board |
| http://localhost:3000/terminal | Operator terminal |
| http://localhost:3000/terminal/ai | AI operator (shadow by default) |
| http://localhost:3000/terminal/automations | Weekend Google automation (shadow by default) |
| http://localhost:3000/terminal/pipeline | Commerce pipeline board |

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
