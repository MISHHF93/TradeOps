# ADR-0001: Stack and deployment topology

**Status:** Proposed  
**Date:** 2026-07-15  
**Deciders:** TradeOps architecture (CTO baseline)

## Context

TradeOps is a multi-tenant, marketplace-independent commerce operating system. It must support connector plugins, background sync, automation, AI jobs, and dense operational dashboards. The repository is greenfield.

## Decision

1. **Monorepo:** pnpm workspaces + Turborepo, TypeScript strict.
2. **API:** NestJS modular monolith (`apps/api`).
3. **Workers:** Separate Nest/BullMQ process (`apps/worker`) sharing domain packages.
4. **Web:** Next.js App Router (`apps/web`).
5. **Data:** PostgreSQL + Prisma; Redis + BullMQ for queues/cache.
6. **Boundaries:** Pure domain and contracts in packages; marketplace code only under `packages/connectors/*`; runtime in `packages/connector-core`.
7. **Topology:** Modular monolith first; extract workers/services only under proven scale pressure.

## Consequences

**Positive**

- Shared types eliminate FE/BE drift.
- Connector isolation is enforceable via package boundaries.
- One deployable API reduces early operational complexity.
- Workers can scale horizontally before splitting domains.

**Negative / accepted costs**

- NestJS + Next.js learning surface is larger than a single Next full-stack app.
- Prisma multi-tenant patterns require discipline (org scoping).
- Modular monolith can rot without lint rules and code owners.

## Alternatives considered

| Option | Why not (now) |
|--------|----------------|
| Next.js only (API routes as backend) | Weak long-term home for workers, connectors, domain modules at this scale |
| Microservices day one | Ops and distributed-transaction cost without traffic |
| Python API + TS web | Dual-language friction for shared contracts |
| MongoDB primary | Relational multi-tenant commerce + joins favor Postgres |

## Supersedes

None.
