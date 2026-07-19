# System Wiring Review

**Date:** 2026-07-18  
**Mode:** Final end-to-end wiring reconciliation  
**Rule:** Every visible capability executes, declares a blocker, or is removed from the active product.

---

## 1. Architecture discovered

Monorepo Commerce OS:

| Layer | Implementation |
|-------|----------------|
| Web | Next.js terminal shell + persona nav + AI panel |
| API | NestJS `/api/v1` modules (commerce, AI, billing, automation, saas) |
| Data | Prisma + PostgreSQL/PGlite, org-scoped models |
| AI | Cohere-only adapter + typed tools + prompt/schema/artifact registries |
| Search | Internal SearchService + Tavily public research tools |
| Connectors | Fabric + fixtures + Shopify live-http + planned registry |
| Workflows | Template runner + durable snapshots on OperatorRun |
| Events | EventFabricService → CommerceEvent (+ domain envelope metadata) |
| Queues | Redis/BullMQ optional worker |
| Billing | Stripe SaaS (separate from channel payments) |

**Spine:** Commerce Case lifecycle  
Discover → Evaluate → Qualify → Prepare → Approve → Publish → Sell → Source → Fulfill → Reconcile → Learn → Closed.

---

## 2. Disconnected systems found (and disposition)

| Issue | Disposition |
|-------|-------------|
| AI responses without canonical envelope | **Fixed** — wrapEnvelope + dataMode on operator run |
| Stage advance only used legacy event type | **Fixed** — `CommerceCaseAdvanced` domain event |
| No stack diagnostics surface | **Fixed** — `GET /api/v1/ops/diagnostics` |
| No wiring matrix API | **Fixed** — `GET /api/v1/ops/wiring-matrix` |
| Lifecycle path opaque (fixture vs Shopify) | **Fixed** — `GET /api/v1/commerce/lifecycle/path` |
| Speculative multi-provider registry | **Already removed** in stack consolidation |
| Capital/network in product chrome | **Kept out** of default persona Focus |
| SSE streaming incomplete JSON | **Not fully implemented** — timeline states returned; SSE deferred (blocker) |
| Full Shopify OAuth vault | **Credential / product blocker** — honest path status |

---

## 3. Wiring completed this pass

1. Canonical runtime contract (`@tradeops/contracts` runtime.ts): dataMode, states, envelope, events, matrix  
2. Domain event publish with correlation/trace/schemaVersion in payload  
3. AI Phase A/B labeling + envelope on operator response  
4. Diagnostics + wiring-matrix endpoints  
5. Lifecycle path honesty board (fixture vs Shopify)  
6. Architecture + operations documentation set  

---

## 4. Duplicate systems removed / avoided

- No parallel AI runtime created  
- No second connector fabric  
- Inactive providers stay planned-only (prior consolidation)  
- Dual AI component files remain re-export shims (not active duplicates)

---

## 5–9. Canonical surfaces

See `SYSTEM_WIRING_MATRIX.md` and `docs/architecture/*`.

| Concern | Canonical owner |
|---------|-----------------|
| Routes | Nest `/api/v1/*` only for ops data |
| Services | CommerceCaseService, AiOperatorService, SearchService, WorkflowService, EventFabricService |
| Domain ownership | Commerce Case (primary spine); Product twin is facet |
| Active connectors | Shopify, Stripe, EasyPost, Tavily, Cohere, GA4, PostHog, Sentry, OTEL, fixtures |
| Fixture connectors | fixture-supplier, fixture-marketplace |

---

## 10–16. Subsystem status

| Subsystem | Status |
|-----------|--------|
| AI runtime | **Wired** — Cohere sole; tools; envelope; events |
| Search | **Wired** — internal + Tavily research tools |
| Retrieval | **Partial** — product store + prior OperatorRun knowledge; full Embed index not a separate vector DB |
| Workflow durability | **Partial** — durable snapshots; not first-class WorkflowRun table |
| Event fabric | **Wired** — standard names + domain metadata |
| Frontend integration | **Wired** — shell, case workspace, command search, AI panel |
| Tenant isolation | **Foundations** — org filters + founder_direct |

---

## 17–24. Execution results

| Check | Result |
|-------|--------|
| contracts tests | pass |
| API build | pass |
| Live health | up after restart |
| Credential blockers | Shopify/Tavily/Cohere/Stripe/EasyPost env-dependent |
| Technical blockers | SSE stream, vector retrieval, WorkflowRun table, OAuth vault UI |

**Manual deploy:** `pnpm setup` → `pnpm run bootstrap:local` → set approved `.env` keys → `pnpm start` → open http://localhost:3000  

---

## Completion rule

Active product surfaces either:

- **execute** end-to-end (fixture path), or  
- **declare blockers** (`lifecycle/path`, diagnostics), or  
- remain **outside default nav** (capital/network).

Final reports: `SYSTEM_WIRING_MATRIX.md`, `LIVE_EXECUTION_REPORT.md`, architecture docs under `docs/architecture/`.
