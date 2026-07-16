# TradeOps

**The AI Operating System for Global Commerce.**

TradeOps is a marketplace-independent commerce control center. External platforms own the transactions. TradeOps owns orchestration, intelligence, automation, and operational visibility through a **connector framework** and **canonical domain models**.

> Philosophy: *TradeOps owns the intelligence. External platforms own the transactions. TradeOps orchestrates everything.*

---

## Current milestone

**M0 — Platform foundation** ✅ complete  
**M1 — Auth, organizations, RBAC** ✅ complete (API; local web uses `AUTH_BYPASS`, no login UI)  
**M2a — Fixture connectors + commerce terminal** ✅ complete  
**M2b — Real Shopify** — next when merchant credentials available  

**Local product:** open http://localhost:3000 → **Commerce Terminal** (no login).

| Component | Status |
|-----------|--------|
| Monorepo (pnpm workspaces) | Yes |
| API (`apps/api` NestJS) | Health + identity + commerce terminal APIs |
| Worker (`apps/worker` BullMQ) | Platform heartbeat queue |
| Web (`apps/web` Next.js) | Terminal (scanner, pipeline, portfolio, …) — no `/login` |
| Postgres / PGlite | Identity + full commerce schema + seed |
| Redis | Optional for first UI; health may be degraded |
| CI | GitHub Actions |
| Docs index | [docs/README.md](docs/README.md) |

Docs index: [docs/README.md](docs/README.md) · Milestones: [docs/architecture/MILESTONES.md](docs/architecture/MILESTONES.md)

---

## Repository layout

```text
apps/
  api/       NestJS HTTP API (/api/v1 health, identity, commerce)
  worker/    Background jobs (BullMQ)
  web/       Next.js commerce terminal
packages/
  config/ logging/ contracts/ domain/ auth/
  database/          Prisma schema + migrations + seed
  commerce-engine/   Profit, score, forecast, policy, signals
  connector-core/    Connector capability contracts
  connectors/        fixture-supplier, fixture-marketplace
infra/docker/        Postgres + Redis Compose stack
scripts/             start, bootstrap:local, db:pglite, demo:loop, …
docs/                See docs/README.md
```

**Rule:** Marketplace SDKs and provider types belong only under `packages/connectors/*`. Never import them from the dashboard or core domain.

---

## Prerequisites

- Node.js **≥ 20.11**
- pnpm **9.x** (`npm install -g pnpm@9.15.0`)
- Docker (recommended) for Postgres + Redis  

### Restricted Windows (Application Control)

Some hosts block native Node addons (Turbo, Rollup, esbuild, SWC). This repo is designed to still **typecheck, test, and build** using:

- `pnpm -r` instead of Turborepo
- Node built-in `node:test` instead of Vitest
- `tsc` + `node` instead of `tsx`
- Next.js WASM SWC fallback when native SWC is blocked

If optional native postinstall scripts fail:

```bash
pnpm install --ignore-scripts
pnpm db:generate
```

Details: [docs/architecture/ADR-0003-tooling-without-native-binaries.md](docs/architecture/ADR-0003-tooling-without-native-binaries.md)

---

## Quick start (first time)

```powershell
# From C:\Users\borah\TradeOps

# 1) Install JS dependencies (use pnpm; npm also works for start after setup)
pnpm install
# If Windows Application Control blocks native addons:
# pnpm install --ignore-scripts

# 2) Env file
copy .env.example .env

# 3) Build monorepo + generate Prisma client
pnpm setup

# 4) Local DB + migrate + seed
#    Prefer PGlite on App Control hosts (no Docker/system Postgres required):
pnpm run bootstrap:local
#    Or with Docker: docker compose up -d  then  pnpm run setup:db

# 5) Turn the product on
npm start
# or: pnpm start

# 6) Optional — fill full commerce pipeline (or use UI button)
pnpm run demo:loop
```

Open:

- http://localhost:3000 → **terminal** (no login UI)  
- Pipeline: http://localhost:3000/terminal/pipeline  
- Account: http://localhost:3000/app  
- Local identity: `AUTH_BYPASS` + seed (`founder@tradeops.local` / `demo-commerce`)  
- Vertical slice: Scanner → Pipeline → Signals → Portfolio → Orders → Approvals → Connectors

**Note:** Root `npm start` starts **API + Web**. There is no bare `npm starrt` (typo). Use `npm start` or `pnpm start`.

### Dev mode (rebuild on change)

```powershell
pnpm dev          # API + web via tsc/next dev
```

| Surface | URL |
|---------|-----|
| Web / Terminal | http://localhost:3000 → `/terminal` |
| Account | http://localhost:3000/app |
| API health | http://localhost:4000/api/v1/health |
| API liveness | http://localhost:4000/api/v1/health/live |
| Auth me (bypass) | http://localhost:4000/api/v1/auth/me |

Without Postgres/Redis, the API still serves **liveness**; **readiness** reports `degraded`.

---

## Verification

```bash
pnpm verify
# typecheck + lint + test + build
```

---

## Engineering constitution (summary)

1. No marketplace imports outside connector packages.
2. No business logic trapped in React components.
3. Money is integer minor units + currency code (from M3+).
4. Merchant secrets are vaulted, never plaintext in app tables (M2+).
5. Every external write is idempotent and audited.
6. Multi-tenant isolation tests accompany every new org-scoped entity.
7. Finish a milestone’s exit criteria before starting the next.

---

## License

Proprietary — all rights reserved until otherwise stated.
