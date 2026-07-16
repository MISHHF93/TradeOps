# TradeOps Test Report

**Date:** 2026-07-16 (vertical slice + PGlite local path)  
**Host:** Windows (no Docker CLI; Application Control blocks native SWC — WASM fallback OK)

## Commands run

```bash
pnpm install --ignore-scripts
pnpm db:generate
pnpm run db:pglite          # Prisma Dev / PGlite when system Postgres blocked
pnpm run setup:db           # migrate deploy + seed
pnpm test                   # packages (commerce-engine, fixtures, config, …)
pnpm --filter @tradeops/api build
pnpm --filter @tradeops/web build
npm start
```

## Results

| Check | Result |
|-------|--------|
| Unit tests (commerce-engine) | **PASS** (13) |
| Fixture connectors | **PASS** |
| Config AUTH_BYPASS | **PASS** |
| Nest API build + listen :4000 | **PASS** |
| Next.js production build + :3000 | **PASS** |
| Prisma migrate + seed on PGlite | **PASS** (5 scored products) |
| Live `GET /auth/me` (bypass, no cookie) | **PASS** founder@ / demo-commerce |
| Live scanner / signals / connectors / pipeline | **PASS** |
| Web terminal routes (all nav) | **PASS** HTTP 200 |

## Live vertical-slice snapshot (this host)

| Surface | Observed |
|---------|----------|
| Identity | `founder@tradeops.local` · org `demo-commerce` · role `owner` · no login UI |
| Scanner | 5 products; scores 73/69/67/66/15; signals BUY/HOLD/HOLD/HOLD/BLOCKED |
| Connectors | fixture-supplier + fixture-marketplace, `isFixture=true`, connected |
| Pipeline | 12 stages; fill with `pnpm run demo:loop` or UI **Run full demo loop** |
| Approvals / orders | Created by demo loop / toolbar actions |
| Redis | Down — optional for UI slice |
| API client timeout | Default **60s** (`API_TIMEOUT_MS`) — PGlite exceeds old 4s limit |

## Definition-of-done mapping (plan.md)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| App builds / navigable terminal | **DONE** | `/` → `/terminal`; all terminal nav 200 |
| No login for local product | **DONE** | AUTH_BYPASS + pages removed |
| Product import (fixtures) | **DONE** | Seed + `POST .../import/fixture-supplier` |
| Explainable opportunity score | **DONE** | Scanner + product detail components |
| Forecast + uncertainty | **DONE** | baseline-ma-v1 in engine + seed |
| Commerce signal BUY/SELL/… | **DONE** | Signal badges; weapon → BLOCKED |
| Simulation mode | **DONE** | API + UI; empty until user runs simulate |
| Listing draft + human approval | **DONE** | Approval gate; empty until listing draft |
| Orders + supplier PO draft | **DONE** | Fixture ingest path |
| Profit in minor units | **DONE** | commerce-engine tests + portfolio |
| Restricted products blocked | **DONE** | Holster SKU score 15 BLOCKED |
| Real Shopify/Amazon | **BLOCKED** | Credentials — intentional |
| Neural forecasting | **STUB** | Intentional |

## Gaps vs full plan.md (not vertical-slice blockers)

- Full multi-tenant SaaS login UI removed intentionally for local-first
- Real marketplace connectors, ads, automation engine (M5), neural AI — future milestones
- Playwright browser E2E not run
- Redis/worker not required for first UI

Primary path on this host: `pnpm run db:pglite` → `pnpm run setup:db` → `npm start` → http://localhost:3000  
See `docs/FIRST_RUN.md`, `docs/TRADEOPS_IMPLEMENTATION_LEDGER.md`.
