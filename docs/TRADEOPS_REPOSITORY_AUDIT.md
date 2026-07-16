# TradeOps Repository Audit

**Date:** 2026-07-16 (docs + runtime refresh)  
**Scope:** Full inspection for predictive commerce terminal vertical slice

## Stack (working — retain)

| Layer | Technology | Status |
|-------|------------|--------|
| Monorepo | pnpm workspaces | Working |
| API | NestJS `apps/api` | Health, identity, commerce terminal APIs |
| Web | Next.js 15 `apps/web` | Terminal UI — **no login/register pages** |
| Worker | BullMQ heartbeat | Working (sync jobs still API-triggered for slice) |
| DB | PostgreSQL **or** Prisma Dev PGlite + Prisma | Identity + full commerce schema + migrations |
| Auth | Cookie sessions + scrypt + RBAC; local **AUTH_BYPASS** | Working |
| Engine | `@tradeops/commerce-engine` | Profit, score, forecast, policy, signals |
| Connectors | connector-core + fixture-supplier + fixture-marketplace | Working (FIXTURE) |

## API surface (`/api/v1`)

| Area | Routes |
|------|--------|
| Health | `GET health`, `health/live` |
| Auth | register, login, logout, me (API kept; web UI does not use login) |
| Orgs | list/create/switch/members |
| Commerce | import fixture supplier, rescore, listing-draft, simulate |
| Terminal | scanner, signals, portfolio, pipeline, evaluate, prediction-outcomes, **demo-loop** |
| Orders | list, ingest fixture, complete-fulfillment |
| Approvals | list, decide |
| Connectors | list |

## Web routes

| Route | Notes |
|-------|--------|
| `/` | Redirects to `/terminal` |
| `/terminal` | Market scanner |
| `/terminal/pipeline` | Full commerce pipeline board |
| `/terminal/signals` | Signal feed |
| `/terminal/portfolio` | Portfolio |
| `/terminal/cashflow` | Cash vs profit view |
| `/terminal/orders` | Orders |
| `/terminal/approvals` | Approvals |
| `/terminal/connectors` | Connectors |
| `/terminal/products/[id]` | Product detail |
| `/app` | Account / health (local mode) |
| `/login`, `/register` | **Removed** (404) |

## Dead / placeholder assessment

| Item | Assessment |
|------|------------|
| Neural ML models | Intentionally not present (baselines only) |
| Live Shopify/Amazon | Not implemented — credential blocked |
| Turbo/Vitest native | Avoided on Windows App Control hosts (ADR-0003) |
| Card-heavy admin | Replaced by dense terminal tables |

## Host constraints

- Docker may be absent → use **PGlite** (`pnpm run bootstrap:local` / `db:pglite`)  
- Application Control may block native Node addons → pure `tsc` + Node tests  
- Web fetch timeouts default **60s** for PGlite latency  

## Verdict

Repository **supports** the product. Vertical slice is implemented with fixture connectors for local revenue-loop validation before live API credentials.  
See [IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) and [docs/README.md](./README.md).
