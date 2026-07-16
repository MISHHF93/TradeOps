# TradeOps — Architectural Audit Report

**Date:** 2026-07-15  
**Last inventory refresh:** 2026-07-16 (commerce vertical slice + local PGlite path)  
**Classification:** Foundational  
**Audience:** Engineering leadership, product, security  
**Status:** Living document — sections below retain early M0 framing; **current runtime truth** is [MILESTONES.md](./MILESTONES.md) + [../TRADEOPS_IMPLEMENTATION_LEDGER.md](../TRADEOPS_IMPLEMENTATION_LEDGER.md) + [../README.md](../README.md)

> **Update (2026-07-16):** M0/M1 complete. **M2a fixture connectors + commerce terminal** shipped (local).  
> Web has **no login UI** (`AUTH_BYPASS` for local). Next real external work is **M2b Shopify** (credentials).

---

## 1. Executive summary

| Dimension | Finding |
|-----------|---------|
| Repository state | **M0 + M1 + local commerce vertical slice** — monorepo, identity, fixtures, terminal |
| Connectors / commerce / AI | **Fixtures + baseline engine live**; real marketplaces / neural AI still later |
| Production readiness | Local vertical slice works; not full multi-marketplace production |
| Technical debt | Environment tooling constraints (ADR-0003); PGlite path for App Control hosts |
| Recommendation | Proceed M2b (Shopify) when credentials available; keep fixture loop green |

**Philosophy (binding):** TradeOps owns the intelligence. External platforms own the transactions. TradeOps orchestrates.

Related machineside projects (BrandOps, Friction-Free Marketplace, Finite) are **not** TradeOps.

---

## 2. Current repository inventory

### 2.1 Layout

```
TradeOps/
├── apps/
│   ├── api/          NestJS — /api/v1 health, Prisma, Redis
│   ├── worker/       BullMQ platform heartbeat consumer
│   └── web/          Next.js shell + platform health card
├── packages/
│   ├── config/       Zod-validated environment
│   ├── logging/      Pino + secret redaction paths
│   ├── contracts/    Shared DTOs (health, identity, permissions)
│   ├── domain/       Pure RBAC matrix, tenancy, slug helpers
│   ├── auth/         scrypt passwords + session token helpers
│   └── database/     Prisma schema + migrations (identity + sessions + audit)
├── infra/docker/     Postgres 16 + Redis 7 Compose
├── scripts/          Node test runner (no native Vitest/Rollup)
├── docs/architecture/
├── .github/workflows/ci.yml
├── package.json      pnpm workspace orchestration
└── pnpm-lock.yaml
```

| Asset | Status |
|-------|--------|
| Source code | Present (M0 scope) |
| Frontend | Shell only (`apps/web`) |
| Backend / API | Health + DI for Prisma/Redis |
| Database schema | Organizations, users, memberships, audit_events |
| Auth | **Present** — register/login, scrypt, sessions, RBAC guards, audit |
| Connectors | **Absent** |

| Commerce domains | **Absent** |
| AI / Automation | **Absent** |
| CI/CD | GitHub Actions verify pipeline |
| Tests | Node `node:test` across packages/apps — green |
| Lockfile | `pnpm-lock.yaml` present |

### 2.2 Dependency map (workspace)

| Package | Depends on |
|---------|------------|
| `@tradeops/config` | zod |
| `@tradeops/logging` | pino |
| `@tradeops/contracts` | zod |
| `@tradeops/domain` | contracts |
| `@tradeops/database` | @prisma/client |
| `@tradeops/api` | config, contracts, database, domain, logging, NestJS, ioredis |
| `@tradeops/worker` | config, database, logging, bullmq, ioredis |
| `@tradeops/web` | contracts, next, react |

### 2.3 Debt / constraints (honest)

| Finding | Severity | Mitigation |
|---------|----------|------------|
| Windows Application Control blocks Turbo, Rollup, native SWC, esbuild | Env | ADR-0003: pnpm -r, node:test, tsc+node; Next WASM fallback |
| Docker not always available on host | Env | Compose files ready; health degrades cleanly without DB/Redis |
| No ESLint import boundary rules yet | Medium | Add when connectors land (M2) |
| No package UI system | Expected | M1/M3 |
| Full product modules not implemented | Correct | Milestone discipline |

### 2.4 Verified M0 behaviors

- `pnpm typecheck` / `lint` / `test` / `build` green on restricted Windows host  
- `GET /api/v1/health/live` → `200` process liveness  
- `GET /api/v1/health` → `200` with `status: degraded` when Postgres/Redis down (no crash)  

---

## 3. Product architecture (target)

### 3.1 Core philosophy (binding)

> **TradeOps owns the intelligence. External platforms own the transactions. TradeOps orchestrates.**

- Dashboard and domain **never** depend on marketplace SDKs/schemas.
- Every external system is a **Connector** with a shared capability contract.
- Connectors normalize inbound data into **canonical** models.
- AI, automation, analytics operate only on canonical data + internal events.

### 3.2 System context

```
                    ┌─────────────────────────────────────┐
                    │           Merchants (Orgs)           │
                    │   Web Dashboard · API · Webhooks     │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │         TradeOps Platform            │
                    │  API Gateway · Auth · RBAC · Audit   │
                    │  Domain Services · AI · Automation   │
                    │  Event Bus · Job Workers             │
                    └─────────────────┬───────────────────┘
                                      │ Connector Framework
          ┌───────────────┬───────────┼───────────┬───────────────┐
          ▼               ▼           ▼           ▼               ▼
     Marketplaces    Suppliers    Payments    Shipping      Ads / Reviews
```

### 3.3 Bounded contexts

Identity & Access · Connector Hub · Catalog · Inventory · Orders · Customers · Suppliers · Shipping · Payments · Pricing · Cash Flow · Profit Engine · Reviews · Analytics · AI · Automation · Notifications · Marketplace Manager · Webhooks · Developer Platform · Platform Ops

### 3.4 Connector framework (non-negotiable)

Capability interfaces (implement only what the provider supports): Catalog, Inventory, Orders/Fulfillment, Customers, Reviews, Shipping, Payments, Webhooks. Runtime: auth, rate limit, external ID map, sync cursors, health. Secrets vaulted; never plaintext.

### 3.5 AI engine (M6+)

Rank products, recommend suppliers, review sentiment, profit/return risk, pricing anomalies/recommendations, inventory recommendations, content generation, daily brief. Artifacts versioned; no silent auto-publish.

### 3.6 Dashboards (product map)

Executive, Sales, Product, Supplier, Marketplace, Cash flow, Profit, Inventory, Automation, Connectors, AI, System health — all on **projections**, not live N+1 marketplace calls.

---

## 4. Technical architecture

| Layer | Choice |
|-------|--------|
| Monorepo | pnpm workspaces (task runner: `pnpm -r`; Turbo optional where allowed) |
| Language | TypeScript strict |
| API | NestJS modular monolith |
| Worker | BullMQ + Redis |
| Web | Next.js App Router |
| DB | PostgreSQL + Prisma |
| Contracts | Zod in `@tradeops/contracts` |
| Tests | Node built-in test runner |
| Deploy local | Docker Compose Postgres + Redis |

See ADR-0001 (stack), ADR-0002 (connector isolation), ADR-0003 (tooling constraints).

---

## 5. Security baseline

- Multi-tenant `organization_id` on every business entity (enforced from M1+)
- Encrypted merchant credentials (M2)
- Webhook verification (M2)
- RBAC permission catalog already in contracts/domain
- AuditEvent table ready
- Logger redaction paths for common secret keys
- Zod env + future request validation

---

## 6. Milestone plan

| ID | Name | Status |
|----|------|--------|
| M0 | Platform foundation | **Complete** |
| M1 | Auth, orgs, RBAC | **Complete** |
| M2 | Connector framework + Shopify | **Next** |

| M3 | Commerce domain + dashboards | Pending |
| M4 | Profit + cash flow + pricing | Pending |
| M5 | Automation engine | Pending |
| M6 | AI intelligence | Pending |
| M7 | Second connector | Pending |
| M8 | Suppliers, shipping, payments depth | Pending |
| M9 | Developer platform | Pending |
| M10 | Production hardening | Pending |

Details: [MILESTONES.md](./MILESTONES.md)

---

## 7. Implementation laws

1. No marketplace imports outside `packages/connectors/*`.
2. No business logic trapped in React components.
3. Money as integer minor units + currency (from commerce milestones).
4. Merchant secrets vaulted, never env-per-merchant.
5. External writes idempotent + audited.
6. Multi-tenant isolation tests per entity family.
7. Finish milestone exit criteria before the next.

---

## 8. Audit sign-off

- [x] Repository discovered and inventory refreshed
- [x] M0 compiles, tests, builds
- [x] Health surface validated (live + degraded readiness)
- [x] Architecture + ADRs documented
- [x] M1 identity complete (sessions, RBAC, org switch, web auth)
- [ ] M2 started (connector framework)
