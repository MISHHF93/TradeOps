# TradeOps

**The AI Commerce Operating System for modern merchants.**

TradeOps sits **above** Shopify, BigCommerce, Amazon, eBay, suppliers, logistics, and analytics—not as another e-commerce platform. Merchants own stores, payment accounts, and decisions. External platforms own shopper transactions. TradeOps provides **intelligence, operations, connectors, and an AI operator** so merchants run commerce better—**not** investment management or fund custody.

> Philosophy: *TradeOps owns the intelligence. External platforms own the transactions. Merchants own the business. TradeOps orchestrates everything.*

| Doc | |
|-----|--|
| [docs/README.md](docs/README.md) | **Documentation index** |
| [docs/architecture/TRADEOPS_AI_RUNTIME_BLUEPRINT.md](docs/architecture/TRADEOPS_AI_RUNTIME_BLUEPRINT.md) | **Canonical AI + COS architecture** |
| [docs/TRADEOPS_PRODUCT_POSITIONING.md](docs/TRADEOPS_PRODUCT_POSITIONING.md) | Commercial stance |
| [docs/TRADEOPS_SIX_PILLARS.md](docs/TRADEOPS_SIX_PILLARS.md) | Six pillars |

**Six pillars:** Commerce Intelligence · Commerce Operations · Unified Connector Hub · AI Operator · SaaS Billing · Enterprise Layer

---

## Current milestone

**M0 — Platform foundation** ✅ complete  
**M1 — Auth, organizations, RBAC** ✅ complete (session foundation retained; **Direct Founder Access** default)  
**M2a — Fixture connectors + commerce terminal** ✅ complete  
**M2b — Real Shopify** — next when merchant credentials available  
**SaaS foundations** ✅ packs, quotas, cockpit, ATP, customers, agency, control tower  

**Local product (default `TRADEOPS_ACCESS_MODE=founder_direct`):**  
open **http://localhost:3000** → terminal immediately (no login). Stack: `pnpm stack:up`.

| Component | Status |
|-----------|--------|
| Monorepo (pnpm workspaces) | Yes |
| API (`apps/api` NestJS) | Health + identity + commerce + SaaS + AI + automation |
| Worker (`apps/worker` BullMQ) | Platform jobs (Redis optional) |
| Web (`apps/web` Next.js) | Commerce terminal + public marketing |
| Postgres / PGlite | Identity + commerce schema + seed |
| Redis | Optional; health may be degraded |
| Docs | [docs/README.md](docs/README.md) · [MILESTONES](docs/architecture/MILESTONES.md) · archive under `docs/_archive/` |

---

## Repository layout

```text
apps/
  api/       NestJS HTTP API (/api/v1 health, identity, commerce, public tools, automation)
  worker/    Background jobs (BullMQ)
  web/       Next.js public site + commerce terminal
packages/
  config/ logging/ contracts/ domain/ auth/
  database/          Prisma schema + migrations + seed
  commerce-engine/   Profit, score, forecast, policy, signals
  connector-core/    Connector capability contracts
  connectors/        fixture-supplier, fixture-marketplace, google-merchant
infra/docker/        Postgres + Redis Compose stack
scripts/             start, bootstrap:local, db:pglite, demo:loop, google:weekend, …
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

| Surface | URL |
|---------|-----|
| Public website | http://localhost:3000 |
| Free tools | http://localhost:3000/tools |
| Register / Sign in | http://localhost:3000/register · `/login` |
| Capability status | http://localhost:3000/status |
| Merchant workspace | http://localhost:3000/app · `/terminal` |
| AI operator | http://localhost:3000/terminal/ai |

Seeded local account (after `setup:db`): `founder@tradeops.local` / `TradeOps-Demo-2026!`  
Dev may also use `AUTH_BYPASS=true` (forced off in production).  
Honesty board classifies every primary control as operational / approval-controlled / credential-blocked / coming soon. 

Weekend Google (shadow by default):

```powershell
pnpm run google:weekend -- --shadow
# Optional live path later: set GOOGLE_MERCHANT_ACCESS_TOKEN + GOOGLE_MERCHANT_ID
```

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
