# Live Execution Report

**Date:** 2026-07-18  
**Environment:** local founder_direct + PGlite

## Architecture

Single monorepo COS with Nest API, Next web, Prisma, Cohere-only AI, Tavily research, fixture + Shopify connector fabric.

## Wiring completed

- Canonical envelope + dataMode (`@tradeops/contracts`)  
- Domain events with correlation metadata  
- AI Phase A/B labels + envelope return  
- Diagnostics + wiring matrix APIs  
- Lifecycle path honesty API  

## Active connectors

Shopify, Stripe Billing, EasyPost, Tavily, Cohere, GA4, PostHog, Sentry, OTEL (config), fixture-supplier, fixture-marketplace.

## Fixture connectors

fixture-supplier, fixture-marketplace — same interfaces; always labeled fixture.

## AI runtime

- Cohere sole provider (Chat/Embed/Rerank adapter)  
- Blocked when key missing (no demo text)  
- Typed tools + critic/auditor  
- Envelope: requestId, traceId, dataMode, evidence, actions  

## Search

- Internal: `GET /api/v1/search`  
- Public: Tavily via research tools only  

## Retrieval

Tenant product store + OperatorRun prior knowledge. Full vector index optional/future.

## Workflow durability

Durable step snapshots on OperatorRun. First-class WorkflowRun table remaining.

## Event fabric

CommerceEvent persistence + standard domain event names + `_domain` metadata block.

## Frontend

Persona Focus/More, case object workspace, command search, AI panel, connectors planned section.

## Tenant isolation

organizationId on private models; founder_direct synthetic tenant.

## Health / diagnostics

`GET /api/v1/health`, `/health/live`, `/ops/diagnostics` (auth).

## Tests

| Suite | Result |
|-------|--------|
| @tradeops/contracts | pass (runtime + identity) |
| @tradeops/api build | pass |
| Prior stack policy tests | pass (connector-core, ai-runtime) |

## Credential blockers

| Key | Effect if missing |
|-----|-------------------|
| COHERE_API_KEY | Generation blocked |
| TAVILY_API_KEY | Public research blocked |
| SHOPIFY_* | Live commerce blocked; fixtures work |
| STRIPE_SECRET_KEY | Live SaaS billing blocked; fixtures/dev path |
| EASYPOST_API_KEY | Live logistics blocked |

## Technical blockers

- SSE progress stream not fully productized  
- Vector Embed index store  
- WorkflowRun table  
- Shopify OAuth multi-tenant vault UI  
- Deep GA4/Sentry/OTEL instrumentation  

## Manual steps

```powershell
cd C:\Users\borah\TradeOps
pnpm install
pnpm setup
# copy .env.example → .env ; set keys as available
pnpm run bootstrap:local
pnpm start
# open http://localhost:3000
# optional: pnpm run demo:loop
```

## Build result

API TypeScript build: **success** after wiring changes.
