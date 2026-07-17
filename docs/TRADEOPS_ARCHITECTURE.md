# TradeOps Architecture

> **Runtime note (2026-07-16):** Local vertical slice is live (terminal + fixtures + PGlite).  
> See [IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) and [docs/README.md](./README.md).  
> **Vision:** [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md) · [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md)

## Product architecture (sits above channels)

TradeOps is the **AI Commerce Operating System** layer: intelligence + operations + connectors + AI operator + SaaS billing + enterprise—not a competing storefront and not a capital custody product.

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

1. TradeOps owns intelligence; external platforms own transactions; merchants own the business.  
2. Marketplace / supplier logic only inside connector packages (capability contracts).  
3. One commerce lifecycle spine (CommerceCase)—not siloed channel UIs as source of truth.  
4. Money as integer minor units + ISO currency; SaaS billing separate from shopper payments.  
5. Multi-tenant `organizationId` on every business row.  
6. Fail closed on severe policy risk.  
7. Human approval before consequential actions (publish, supplier PO, financial writes).  
8. Distinguish observed facts vs predictions vs rules vs missing data.  
9. Webhooks: verify signature, ack quickly, process asynchronously with idempotency.  

## Request path

Browser → Next.js (session cookie) → API (AuthGuard + org context) → domain/engine → Prisma → Postgres.  
Connector I/O only via API/worker services, never browser secrets.

## Jobs

Worker (and API sync endpoints for local dev) run:

- Fixture import  
- Rescore opportunities  
- Simulation ticks  
- Order sync (fixture)
