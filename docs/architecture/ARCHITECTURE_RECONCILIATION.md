# TradeOps — Architectural Reconciliation Report

**Date:** 2026-07-18  
**Mode:** Professor — full repository reconciliation (not isolated feature patches)  
**Secrets:** None printed  

---

## 1. Current architecture discovered

### Topology (monorepo)

```text
apps/
  web          Next.js 15 — presentation + workspace UI (83 pages)
  api          NestJS modular monolith — sole backend for browser
  worker       BullMQ jobs (optional; needs Redis)

packages/
  ai-runtime           Cohere code-first AI, Search Manager, live projection, retrieval
  commerce-engine      Lifecycle, scoring, workspace nav, state engine
  connector-core       Registry, capabilities, ops center, normalize, production connectors
  connectors/*         fixture-supplier, fixture-marketplace, google-merchant, live-http
  database             Prisma (71 models)
  domain               Tenancy, RBAC, architecture registry
  contracts            DTOs, permissions
  config               Typed env, security boot, AI platform, financial gates
  workflow-engine      Templates + runner
  harmonization        Identity / payload harmonization
  saas-entitlements    Plan packs
  auth, logging
```

### Request path (canonical)

```text
Browser (Next.js)
  → cookie session / founder_direct
  → NestJS AuthGuard + PermissionsGuard
  → domain services (commerce, AI, billing, capital, saas)
  → commerce-engine pure logic
  → connector-core capabilities + adapters
  → Prisma → Postgres (PGlite local)
  → CommerceEvent (event fabric) for durable traces
```

### Controllers (API graph)

| Prefix | Module | Role |
|--------|--------|------|
| `/api/v1/health` | health | Liveness, env matrix, **architecture registry** |
| `/api/v1/auth` | identity | Session auth |
| `/api/v1/organizations` | identity | Orgs |
| `/api/v1/tenancy` | identity | Multi-tenant context |
| `/api/v1/*` (commerce) | commerce | Scanner, process, cases, connectors, ecosystem, finance ops |
| `/api/v1/industrial` | industrial | Industrial commerce |
| `/api/v1/ai` | ai | Chat, operator, RAG, prediction, gateway |
| `/api/v1/live-search` | ai | **Live projection SSE** |
| `/api/v1/automation` | automation | Workflows, weekend Google |
| `/api/v1/billing` | billing | SaaS Stripe |
| `/api/v1/capital` | capital | Capital gates / ledger |
| `/api/v1/network` | capital | Network capital |
| `/api/v1/saas` | saas | Tenant packs, agency |
| `/api/v1/public` | public | Public tools |

### Presentation (page graph — terminal)

| Group | Routes | Status |
|-------|--------|--------|
| Workspace | `/terminal/workspace`, `/terminal/workspace/[persona]` | Canonical persona homes |
| Operate | `/terminal` discover, process, tasks, orders, approvals, opportunities, fulfillment | Hybrid nav |
| Platform | connectors, ecosystem, automations, `/app`, billing, `/status` | Ops + system |
| AI | `/terminal/ai`, runtime-lab, live-examples, objectives | One runtime |
| Industrial | `/terminal/industrial/*` | Domain pack |
| Finance | `/terminal/finance/*` | Channel payments |
| **Aliases** | cockpit → executive; control-tower → **connectors**; pipeline → process | Reconciled |

### Data fabric (database graph — selected)

Canonical Prisma entities already cover most COS entities:

Product · Supplier · SupplierOffer · Listing · CustomerOrder · Fulfillment · CommercePayment · CommerceRefund · CommercePayout · CommerceCase · Opportunity · CommerceSignal · ProductArtifact · CommerceEvent · WebhookReceipt · ConnectorInstallation · AiConversation · OperatorRun · Approval · Capital* · Billing*

**Gaps vs vision:** no first-class `Customer` table (intelligence profiles derived), `Shipment` is fulfillment-centric, `RFQ`/`Quote` industrial-only, no dedicated `Warehouse` model.

### Connector graph

```text
connector-core
  ├── registry (fixtures)
  ├── production-connectors (env-gated catalog)
  ├── live-feed-registry
  ├── business-capabilities (AI-facing)
  └── ops-center (health aggregation)

adapters
  ├── fixture-supplier / fixture-marketplace
  ├── google-merchant
  └── live-http (credential probe + selective fetch)
```

### AI graph

```text
AI Adapter / resolveAIProvider (Cohere primary)
  ├── agent-loop (structured tools + synthesis)
  ├── Search Manager (web / Tavily / OpenAI web)
  ├── Retrieval Engine (embed + rerank)
  ├── Live Projection (catalog + web → SSE)
  ├── Operator cycle / navigator
  └── RAG / prediction services (API wrappers)
```

**Agent roles** are capability-oriented today (tools + personas), not multi-process agent swarm.

### Event fabric

- **Implemented:** `EventFabricService` → `CommerceEvent` + `WebhookReceipt` (tenant-scoped, durable).
- **Wired:** webhooks, ops, AI completion paths; **live_search.started / completed** now ingest.
- **Gap:** not full pub/sub to all SSE subscribers (live search uses in-memory bus); no replay API UI.

### Workflow graph

- **commerce-engine:** CommerceCase stage machine + process tasks.
- **workflow-engine:** templates + runner.
- **automation:** weekend Google + workflow run endpoint.
- **Gap:** no single WorkflowOrchestrator UI binding all three.

### Knowledge graph

- **Implemented:** `EcosystemService.knowledgeGraph` + `/api/v1/ecosystem/knowledge-graph` + ecosystem UI page.
- **Nature:** projection over canonical models (nodes/edges), not a separate graph DB.

### Live projection

- **Implemented:** `/api/v1/live-search` + SSE + Discover UI panel.
- **Sources:** internal catalog + Search Manager web (when enabled).

---

## 2. Canonical target architecture

```text
Presentation Layer     apps/web (terminal hybrid nav + public site)
        ↓
Workspace Layer        access mode · tenancy · persona · buildPersonaNav
        ↓
AI Layer               one runtime · multi agent-roles · Search Manager · live projection
        ↓
Workflow Layer         CommerceCase + workflow-engine + automation
        ↓
Capability Layer       business-capabilities (AI never sees vendor REST)
        ↓
Connector Layer        connector-core registry + adapters
        ↓
Data Fabric            Prisma canonical entities + normalize()
        ↓
Knowledge Graph        ecosystem projection + IdentityLink
        ↓
Event Fabric           CommerceEvent (durable, tenant-scoped)
        ↓
Persistence            Postgres · optional Redis · local artifact storage
```

**Code registry:** `@tradeops/domain` → `architecture.ts`  
**Public API:** `GET /api/v1/health/architecture`

---

## 3. Gaps identified (honest)

| Area | Status | Gap |
|------|--------|-----|
| Data Fabric | **Partial → strong** | Missing first-class Customer/Warehouse/RFQ tables |
| Connector Fabric | **Strong** | Live-http partial; many production connectors registry-only |
| Event Fabric | **Partial** | Durable store yes; cross-module SSE fan-out incomplete |
| Live Projection | **v1 done** | Catalog + web; not all marketplace adapters streaming |
| Knowledge Graph | **Projection done** | Not a graph DB; limited reasoning APIs |
| Universal Search | **Partial** | Search Manager exists; not all pages route exclusively through it |
| AI Orchestration | **Single runtime** | Multi-agent roles catalogued; not multi-agent swarm |
| Ops Command Center | **v1 unified** | `/terminal/ops` + `GET /api/v1/ops/command-center` |
| Workflow Engine | **Partial** | Three systems not fully unified under one API |
| Plugin Marketplace | **Missing** | Capability ads only |
| Production hardening | **Partial** | Auth, tenancy, env validation; Redis optional; rate limits uneven |
| Navigation | **Reconciled hybrid** | Focus · Operate · Platform · More (+ Ops Center) |
| Demo/simulation | **Gated** | Fixtures labeled; simulation not auto |
| AI multi-agent | **Orchestration registry** | One runtime; `planAgentsForObjective` selects roles |
| Event stream | **Partial+** | Durable store + `GET /ops/events` + SSE poll stream |

---

## 4–7. Files in this reconciliation pass

### Added

| File | Purpose |
|------|---------|
| `packages/domain/src/architecture.ts` | Canonical layers, modules, entities, events, agents, route aliases |
| `docs/architecture/ARCHITECTURE_RECONCILIATION.md` | This report |
| `docs/ai/LIVE_PROJECTION.md` | Live projection contract |
| `packages/ai-runtime/src/live-projection.ts` | Live projection pipeline |
| `packages/ai-runtime/src/agent-orchestration.ts` | Multi-agent role catalog + planner |
| `apps/api/src/ai/live-search.*` | SSE live search API |
| `apps/api/src/ops/*` | Ops Command Center + events list/SSE |
| `apps/web/src/app/terminal/ops/page.tsx` | Ops Center UI |
| `apps/web/.../live-projection-panel.tsx` | Discover live projection UI |
| `apps/api/src/common/all-exceptions.filter.ts` | Stable JSON errors |

### Modified

| File | Change |
|------|--------|
| `packages/domain/src/index.ts` | Export architecture |
| `apps/api/src/health/health.controller.ts` | `GET /health/architecture` |
| `apps/api/src/health/health.module.ts` | Export HealthService |
| `apps/api/src/app.module.ts` | Register OpsModule |
| `apps/api/src/commerce/commerce.module.ts` | Export EventFabricService |
| `apps/api/src/ai/live-search.service.ts` | Emit `live_search.*` into Event Fabric |
| `apps/api/src/ai/ai.controller.ts` | Agents catalog + plan endpoint |
| `packages/commerce-engine` / `nav-catalog` | Platform nav includes **Ops Center** |
| `apps/web/.../control-tower/page.tsx` | Redirect → **`/terminal/ops`** |
| Hybrid nav / env / exceptions | Professor passes |

### Deprecated (not deleted)

| Path | Disposition |
|------|-------------|
| `nav-groups.ts` / `persona-nav.ts` | Prefer workspace API + nav-catalog |
| `/terminal/cockpit` | Alias → executive workspace |
| `/terminal/control-tower` | Alias → **`/terminal/ops`** |
| `/terminal/pipeline` | Alias → process |
| TRADEOPS_AI_MODE / xAI-as-primary env | Prefer AI_PROVIDER=cohere |

### Removed

None forced in this pass (prefer merge/alias over silent delete).

---

## 8. Modules unified (conceptual)

| Concern | Single owner |
|---------|----------------|
| AI reasoning | `@tradeops/ai-runtime` + `apps/api` AiModule |
| Search routing | Search Manager |
| Live items to UI | Live projection + SSE |
| Connectors | connector-core + adapters |
| Commerce spine | CommerceCase + commerce-engine |
| Env config | `@tradeops/config` + environment-manifest |
| Architecture truth | `@tradeops/domain` architecture.ts |
| Ops visibility | **`/terminal/ops`** + `/api/v1/ops/command-center` |
| Agent routing | `planAgentsForObjective` + `GET /api/v1/ai/agents` |
| Event read path | `GET /api/v1/ops/events` + SSE poll stream |

---

## 9. Connectors registered

Via `PRODUCTION_CONNECTORS` + fixture manifests + live-http probes:

- Commerce: Shopify, Woo, BigCommerce, Amazon SP, eBay, Google Merchant  
- Payments: Stripe (platform), PayPal, Square  
- Logistics: EasyPost, ShipStation, carriers  
- Ads/analytics: Google Ads, Meta, TikTok, GA4, PostHog  
- AI: **Cohere primary**, OpenAI/xAI/… optional  
- Enterprise PIM/ERP: registry-ready  

Most production connectors remain **credential-gated** (probe ready / not connected).

---

## 10. Workflows normalized

| Workflow | Mechanism |
|----------|-----------|
| Product commerce lifecycle | CommerceCase stages (discover → learn) |
| Human approvals | Approval model + gates |
| Automation templates | workflow-engine + `/automation/workflows/*` |
| Weekend Google feed | automation scheduler |

---

## 11. Live projection

**Status: implemented (v1)** — catalog + Search Manager + SSE + Discover UI.  
Events durable via Event Fabric on start/complete.

---

## 12. Event fabric

**Status: durable tenant-scoped store + ingest API usage.**  
Not yet a full multi-subscriber Redis stream bus.

---

## 13. Knowledge graph

**Status: operational projection** (`/ecosystem/knowledge-graph`).  
Not a dedicated graph database.

---

## 14. AI orchestration

**Status: one runtime, many tools/personas.**  
Agent roles catalogued in architecture registry; multi-agent swarm not separate processes.

---

## 15. Production readiness assessment

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Auth / sessions | B+ | Cookie sessions, founder_direct gated |
| Tenant isolation | B+ | organizationId on business rows |
| Env / secrets | A- | Manifest + fail-closed AI in prod |
| Observability | C+ | OTEL env, structured logs; no Sentry |
| Queues | C | BullMQ needs Redis (optional locally) |
| Rate limiting | C | Auth rate limit; uneven elsewhere |
| Live data honesty | B | Fixtures labeled; provenance fields |
| Deploy | B | Docker + GH CI; no Vercel |
| Resilience | C+ | Soft Redis; DB 503 messages; no full circuit breakers |

**Overall:** strong **modular monolith COS foundation**; not yet multi-region SaaS complete.

---

## 16. Remaining manual actions

1. Keep `pnpm db:pglite` running for local Postgres wire.  
2. Set **rotated** `COHERE_API_KEY` for live AI + rerank.  
3. Optional: Redis for worker/queues; `WEB_SEARCH_ENABLED` + Tavily/OpenAI for public discovery.  
4. Hard-refresh browser after rebuilds.  
5. Review capital/financial gates with counsel before enabling.

---

## 17. Risks and recommendations

| Risk | Recommendation |
|------|----------------|
| In-memory live-search jobs | Move to Redis streams for multi-instance |
| Partial connector live adapters | Expand live-http only with credential vault |
| Docs sprawl (100+ TRADEOPS_*.md) | Prefer `docs/architecture/*` + archive obsolete |
| Demo fixtures | Keep labeled; never mix with production isolation off |
| Scope creep | Next PRs should map to PLATFORM_LAYERS only |

### Suggested next PR sequence

1. **Event fan-out** — CommerceEvent → SSE channel for ops dashboard  
2. **Search Manager enforcement** — no page bypasses  
3. **Unified Workflow API** — one facade over case + templates + automation  
4. **Customer entity** — first-class data fabric model  
5. **Plugin marketplace** — capability ads + install UX  

---

## Completion criteria (honest scorecard)

| Criterion | Met? |
|-----------|------|
| One AI runtime | **Yes** (Cohere code-first) |
| One connector fabric | **Yes** (registry + capabilities) |
| One data fabric | **Mostly** (Prisma canonical; some entities derived) |
| One search layer | **Mostly** (Search Manager; live projection uses it) |
| One event fabric | **Stronger** (durable + list API + SSE poll stream) |
| One workflow engine | **Partial** (multiple cooperating systems) |
| One live projection | **Yes (v1)** |
| One knowledge graph | **Projection yes** |
| One ops command center | **Yes (v1)** `/terminal/ops` |
| One canonical API | **Mostly** (Nest monolith) |
| Coherent navigation | **Yes** (hybrid + Ops Center) |
| Agent orchestration | **Yes (registry + plan API)** — not multi-process swarm |
| No demo/disconnected systems | **Mostly** (fixtures gated; aliases fixed) |

**Conclusion:** TradeOps is now **documented and wired as one Commerce Operating System** with an explicit architecture registry and fewer orphan paths. Full multi-agent swarm, graph DB, and plugin marketplace remain roadmap — not hidden half-implementations presented as complete.

---

## Graphs (summary)

### Module graph

```text
web → api → { commerce-engine, ai-runtime, connector-core, domain, config, database }
api → connectors/* (via connector-core)
worker → database, redis, google-merchant
```

### Dependency direction (allowed)

```text
apps → packages → contracts/domain (no reverse from packages to apps)
connectors → connector-core only
ai-runtime → config (not Nest)
```

### Event graph (core)

```text
webhook / poll / live_search / ai / case advance
  → EventFabricService.ingest
  → CommerceEvent (Postgres)
  → (future) SSE ops subscribers
```

### Page ownership (Operate)

Discover · Cases · Tasks · Orders · Approvals · Opportunities · Fulfillment — process spine.  
Platform — Connectors (ops sensors) · Ecosystem (KG + partners) · System · Billing.

---

*Regenerate architecture JSON: `GET /api/v1/health/architecture`*
