# TradeOps Architecture

> **Runtime note (2026-07-16):** Local vertical slice is live (terminal + fixtures + PGlite).  
> See [IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) and [docs/README.md](./README.md).

## Topology

```
apps/web (Next.js terminal UI)
apps/api (NestJS modular monolith)
apps/worker (BullMQ jobs)
packages/connector-core + packages/connectors/*
packages/commerce-engine (score, profit, forecast, policy, signals)
packages/database (Prisma)
packages/contracts | domain | auth | config | logging
Postgres + Redis (Docker Compose)
```

## Principles

1. TradeOps owns intelligence; external platforms own transactions.  
2. Marketplace logic only inside connector packages.  
3. Money as integer minor units + ISO currency.  
4. Multi-tenant `organizationId` on every business row.  
5. Fail closed on severe policy risk.  
6. Human approval before first listing publish and supplier PO execution.  
7. Distinguish observed facts vs predictions vs rules vs missing data.

## Request path

Browser → Next.js (session cookie) → API (AuthGuard + org context) → domain/engine → Prisma → Postgres.  
Connector I/O only via API/worker services, never browser secrets.

## Jobs

Worker (and API sync endpoints for local dev) run:

- Fixture import  
- Rescore opportunities  
- Simulation ticks  
- Order sync (fixture)
