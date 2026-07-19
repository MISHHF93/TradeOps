# TradeOps Technology Stack & Execution Model — Architecture Review

**Role:** Principal Enterprise Solutions Architect  
**Scope:** Current technology stack and execution model vs documented COS vision  
**Method:** Derive conclusions only from project documentation, architecture blueprints, and verified implementation  
**Constraint:** Maximize existing stack; recommend new technologies only if unavoidable  
**Primary sources:**  
`TRADEOPS_AI_RUNTIME_BLUEPRINT.md`, `ADR-0001`, companion architecture docs, `apps/api`, `apps/worker`, `packages/*`

**Classification legend**

| Label | Meaning |
|-------|---------|
| **Fully Implemented** | Documented role met in production path with evidence |
| **Partially Implemented** | Present and used; major documented capabilities unused or incomplete |
| **Underutilized** | In stack or registry; little/no critical-path use |
| **Missing** | Documented or ADR-required capability not present in code |
| **Architectural Gap** | Design/implementation mismatch that blocks One-* vision |
| **Automation Opportunity** | Automatable using existing components without new platforms |

---

## 1. Executive answers (up front)

### 1. Is the current technology stack sufficient for the TradeOps vision without major new technologies?

**Yes — with high confidence.**

ADR-0001 and the blueprint already prescribe the right planes: Nest modular monolith, Next workspace, PostgreSQL/Prisma, Redis/BullMQ workers, AI Runtime, Workflow Engine, Connector Fabric, Search orchestration, Event Fabric, Cohere, commerce connectors (Shopify/Stripe/EasyPost), observability (OTEL/Sentry/PostHog/GA4 as registered integrations), SSE.

The gap is **utilization and wiring**, not missing flagship products. No new database, queue product, AI vendor, or orchestration SaaS is required to approach the vision. Optional later: full OpenTelemetry SDK wiring (already anticipated as deploy-time, not a new architecture).

### 2. What percentage of the stack’s capabilities are currently being utilized?

**Estimated overall utilization: ~35–45%.**

| Plane | Utilization (indicative) | Rationale |
|-------|--------------------------|-----------|
| Nest + Next + Prisma + Postgres | **70–85%** | Core product path |
| AI Runtime (Cohere Phase B, tools) | **50–60%** | Live vertical slice; ownership still split with Nest megaservice |
| Session auth + entitlements | **65–75%** | Runs gated; public AI diagnostics remain |
| Event Fabric | **25–35%** | Ingest/list; sparse AI/workflow coverage |
| Workflow Engine | **15–25%** | Templates + one-shot durable snapshot; not step-resumable OS |
| Search Manager | **20–30%** | Command-bar internal only; AI bypasses |
| Connector Fabric / live-http | **30–40%** | Catalog, partial sync; AI not capability-primary |
| Knowledge Graph | **10–20%** | Projection code; not AI/search critical path |
| Data Fabric (provenance types) | **25–35%** | Labels exist; policy incomplete |
| Redis | **15–25%** | Health + worker queues; not AI/workflow jobs |
| BullMQ + worker | **10–20%** | Heartbeat + Google weekend feed only |
| OTEL / Sentry / PostHog / GA4 | **5–20%** | Registry + in-process counters; OTEL “noop_local” unless endpoint set |
| SSE | **50–60%** | Real progress; state enum / durability incomplete |

**Weighted judgment:** infrastructure for a Commerce OS is ~40% activated relative to documented One-* blueprint.

### 3. Highest-impact automation already possible (existing stack only)

1. **Event → Workflow** continuation (Case advanced, Order received, Approval decided) via Workflow Engine + Event Fabric + BullMQ.  
2. **Scheduled discovery / margin / forecast templates** as real step handlers (not one-shot labels).  
3. **AI objective runs as durable workflow steps** with retries and approval pause.  
4. **Connector sync and health-driven re-probe** on `ConnectorHealthChanged` / schedule.  
5. **Learn loop automation** from PredictionOutcome / fulfilled orders back into Opportunity/Case.  
6. **Search Manager as sole retrieval** so automation and AI share evidence.  

### 4. Architectural changes that unlock autonomy (philosophy-aligned)

No new product categories. Re-wire ownership:

1. **One Workflow Engine** becomes the only multi-step executor (AI, connectors, commerce transforms).  
2. **One Event Fabric** becomes the nervous system (every transition emits; workers consume).  
3. **One AI Runtime** only inside steps (thin host).  
4. **One Search / One Fabric** on all retrieval and external I/O.  
5. **One Case + BO SoR** with AI artifacts subordinate.  
6. **BullMQ/worker** hosts durable jobs already designed in ADR-0001.  
7. **OTEL/Sentry** activated for run/step/tool spans already sketched in telemetry.ts.  

---

## 2. Technology-by-technology analysis

### 2.1 Application platform

| Technology | Architectural role (documented) | Implementation evidence | Classification | Notes |
|------------|---------------------------------|-------------------------|-----------------|-------|
| **pnpm + Turborepo monorepo** | One Platform packaging | Present | **Fully Implemented** | Shared packages enforce contracts |
| **NestJS (`apps/api`)** | Modular monolith API | Core COS services | **Fully Implemented** | Risk: AI megaservice concentrates orchestration |
| **Next.js (`apps/web`)** | One Workspace UI | Terminal shell, cases, rail | **Partially Implemented** | Contextual AI progressing; residual AI destinations/history emphasis |
| **TypeScript packages** | Domain isolation | commerce-engine, ai-runtime, connector-core, … | **Fully Implemented** | Boundaries exist; not all enforced on critical path |
| **`apps/worker`** | Horizontal workers (ADR-0001) | Exists with BullMQ | **Underutilized** | Almost no commerce/AI jobs |

### 2.2 Data plane

| Technology | Role | Evidence | Classification |
|------------|------|----------|----------------|
| **PostgreSQL** | System of record for BOs, events, runs | Prisma schema + health | **Fully Implemented** as store |
| **Prisma** | ORM, multi-tenant queries | Widespread | **Fully Implemented** / **Architectural Gap** when used as AI search bypassing Search Manager |
| **Redis** | Cache, queues, session-scale | ioredis; health optional; worker connection | **Underutilized** — health + queues only; not workflow lease/cache for AI |
| **BullMQ** | Job queue, retries, scheduling | Worker: heartbeat + Google weekend feed | **Underutilized** — ADR promises automation jobs not wired |

### 2.3 AI plane

| Technology | Role | Evidence | Classification |
|------------|------|----------|----------------|
| **AI Runtime (`@tradeops/ai-runtime`)** | One AI Runtime | Tools, registries, operator-cycle, Cohere, critic | **Partially Implemented** — engine incomplete vs blueprint (ports, envelope ownership, no product-array-free path) |
| **Cohere** | Sole generative Chat/Embed/Rerank | Adapter, Phase B, deep health | **Partially Implemented** — generative path strong; embed/rerank **Underutilized** on Search/rank |
| **xAI adapter** | Policy-excluded | Present in package | **Underutilized** / noise — intentional non-use |
| **Tavily (via web-search-provider)** | Public research | Tools call runtime provider | **Partially Implemented** + **Architectural Gap** vs Search Manager ownership |
| **SSE** | Stream runtime progress | `/ai/operator/run/stream` | **Partially Implemented** |

### 2.4 COS control planes

| Technology | Role | Evidence | Classification |
|------------|------|----------|----------------|
| **Workflow Engine** | One Workflow Engine | templates, runner, durable-run types; API dumps to OperatorRun | **Partially Implemented** / **Architectural Gap** for resume/retry OS |
| **Connector Fabric / connector-core** | One Fabric | manifests, business capabilities, fabric descriptors, live-http partial | **Partially Implemented** |
| **Shopify / Stripe / EasyPost** | Live commerce adapters | Production registry + live-http set | **Partially Implemented** — sync/capability path exists; not exclusive AI I/O |
| **Fixtures** | Parity contracts | fixture-supplier/marketplace | **Fully Implemented** for dev honesty pattern |
| **Google Merchant connector** | Feed automation | Worker weekend job | **Partially Implemented** |
| **Search orchestration + SearchService** | One Search Layer | Internal ranking only for command bar | **Partially Implemented** / **Architectural Gap** for AI |
| **Knowledge Graph** | Relationship projection | `knowledge-graph.ts` | **Underutilized** |
| **Data provenance / Data Fabric labels** | Honesty policy | types + honesty fields | **Partially Implemented** |
| **Event Fabric** | Domain event log | EventFabricService + CommerceEvent | **Partially Implemented** |
| **Commerce Case + lifecycle/state engine** | One Case spine | CaseService, stages, transforms | **Partially Implemented** — AI product-first residual |
| **Business objects model** | One SoR taxonomy | business-objects.ts | **Partially Implemented** in code usage |

### 2.5 Observability & product analytics

| Technology | Role | Evidence | Classification |
|------------|------|----------|----------------|
| **OpenTelemetry** | Distributed tracing/metrics | `describeTelemetryConfig` noop unless OTLP endpoint; counters in-process | **Underutilized** / **Missing** full SDK path |
| **Sentry** | Error tracking | Registered as production connector; not verified as AI span sink | **Underutilized** |
| **PostHog** | Product analytics | Registry | **Underutilized** |
| **GA4** | Analytics connector | Registry | **Underutilized** |
| **Pino logging (`@tradeops/logging`)** | Structured logs | Worker uses createLogger | **Partially Implemented** |
| **Health endpoints** | Liveness/readiness | postgres+redis; separate AI health | **Partially Implemented** |

### 2.6 Auth & SaaS

| Technology | Role | Evidence | Classification |
|------------|------|----------|----------------|
| **Session auth (`@tradeops/auth`)** | Tenant session | Guards on run endpoints | **Fully Implemented** (core) |
| **SaaS entitlements** | Plan gates for AI/workflow | assertAiEvaluationAllowed | **Partially Implemented** |

---

## 3. Execution model assessment

### 3.1 Documented model (blueprint)

```text
UI → Auth → WorkflowRun → AI Runtime (ports) → Search/Fabric/Domain
  → BO + Case → Artifacts → Events → KG → Envelope/SSE
```

### 3.2 Implemented model (evidence)

```text
UI → Auth → AiOperatorService (megaservice)
  → runOperatorCycle (in-process, product preload)
  → Prisma search + Tavily in runtime + domain side effects
  → sparse events → optional org case sync
  → SSE progress
Parallel: WorkflowService one-shot template → OperatorRun.planJson
Parallel: Worker BullMQ heartbeat + Google feed
```

### 3.3 Capability support matrix

| Capability | Required by vision | Current support | Classification |
|------------|--------------------|-----------------|----------------|
| Self-healing | Connector re-probe, retry, compensate | Partial connector touch; no general healer | **Missing** / **Automation Opportunity** |
| Retries | Workflow + BullMQ native | BullMQ unused for AI/workflow; tools often swallow errors | **Missing** on critical path |
| Resumable execution | Workflow checkpoints | One-shot durable mapping; AI in-process | **Missing** |
| Diagnostics | Health, AI deep, connectors, wiring | Present but split; some public | **Partially Implemented** |
| Monitoring | Metrics, traces, alerts | In-process counters; OTEL optional | **Underutilized** |
| Intelligent workflow continuation | Events → next transform / AI | Not wired | **Missing** / **Automation Opportunity** |
| Production-grade automation across lifecycle | discover→closed | Manual/operator-driven + partial templates | **Architectural Gap** |

---

## 4. Unexploited stack capabilities

| Capability already in stack | Unrealized use |
|-----------------------------|----------------|
| **BullMQ retries, backoff, repeatables, jobId idempotency** | AI runs, workflow steps, connector sync, case recompute |
| **Worker process scale-out** | Offload long operator cycles from API request thread |
| **Redis** | Distributed locks for case/workflow, cache Search plans, SSE pub/sub fanout |
| **Cohere Embed/Rerank** | Search Manager ranking, semantic internal retrieval |
| **Event Fabric list + causation** | Automation triggers, audit UI, replay |
| **Workflow templates** (margin, inventory, supplier_routing, forecast) | Real handlers + events instead of shadow labels |
| **Commerce transformations catalog** | Event-driven “next best action” automation |
| **Knowledge Graph** | Case AI context, Search hits, exception routing |
| **PredictionOutcome / learning loop** | Closed-loop score improvement schedules |
| **Agentic readiness scoring** | Gate publish automation |
| **ShadowDecision ledger** | Safe auto-pilot comparison before controlled_live |
| **OTEL endpoint config** | Full traces without new APM product |
| **Sentry/PostHog/GA4 connectors** | Error budgets, funnel of case stages, demand signals into Search/Case |
| **SSE** | Subscribe to workflow event stream by runId (reconnect) |
| **Fabric resolveCapability** | Automated provider selection for sync jobs |
| **Harmonization package** | Auto identity resolve on ProductDiscovered |

---

## 5. Manual → automated workflow opportunities

| Manual / repetitive today | Automatable? | Mechanism from existing stack |
|---------------------------|--------------|-------------------------------|
| Operator clicks “run evaluation” per product | Yes | Schedule `product_opportunity_discovery` → BullMQ → Workflow → AI Runtime |
| Post-run org-wide case sync only | Yes | Per-product Opportunity write → event → Case sync job |
| Connector registry ensure + ad-hoc syncLive | Yes | Cron + health events → Fabric sync jobs |
| Human monitors connector credentials | Partial | Health job → ConnectorHealthChanged → notify / block live |
| Approval email tribal knowledge | Partial | ApprovalRequested event → workspace notification (existing UI) |
| Re-rank after cost change | Yes | supplier_cost_change trigger template `margin_protection` |
| Order → PO drafting | Yes | `marketplace_order` → `supplier_routing` workflow |
| Forecast vs actual | Yes | `forecast_horizon` template + PredictionOutcome |
| Learning after fulfillment | Yes | Shipment/order events → recordLearning job (logic exists in AI host) |
| Google weekend feed | Partially automated | **Already** BullMQ cron — pattern to copy |

---

## 6. Event-driven orchestration gaps

| Area | Today | Event-driven target (same stack) | Classification |
|------|-------|----------------------------------|----------------|
| AI steps | In-process timeline | WorkflowStep* events | **Architectural Gap** |
| Case stage | Sync inference | CommerceCaseAdvanced consumers | **Automation Opportunity** |
| Approvals | Service call | ApprovalDecided → resume workflow job | **Missing** wiring |
| Connector sync | Imperative API | schedule/webhook → queue | **Partially Implemented** (webhooks ingest exist) |
| Search refresh | On demand | ProductDiscovered → reindex internal docs cache | **Automation Opportunity** |
| KG | On demand build | Invalidate on BO events | **Missing** wiring |

---

## 7. Automation opportunity catalog

### AO-1 — Durable AI objective execution on BullMQ + Workflow Engine

| Field | Content |
|-------|---------|
| **Classification** | **Automation Opportunity** |
| **What** | Move operator runs off request-thread monolith into queued workflow steps |
| **Enablers** | BullMQ, worker, Workflow Engine, AI Runtime, Postgres, Event Fabric, SSE (status poll/stream by runId) |
| **Triggers** | API enqueue; schedule; Case next-action; automation template |
| **BOs** | AI Run, Workflow Run, Case, Opportunity, Artifacts |
| **AI participates?** | Yes — inside steps only |
| **Benefits** | Retry, resume, scale, crash safety, multi-minute runs |
| **Risks / prereqs** | Idempotent tool handlers; approval pause design; no double side effects |

### AO-2 — Lifecycle event → next transform automation

| Field | Content |
|-------|---------|
| **What** | On CommerceCaseAdvanced / OrderReceived / ListingPrepared, enqueue allowed transforms (policy-gated) |
| **Enablers** | Event Fabric, Workflow templates, commerce-state-engine TRANSFORM_CATALOG, CaseService |
| **Triggers** | Domain events |
| **BOs** | Case, Listing, Order, PO, … |
| **AI?** | Optional brief or tool plan for non-consequential transforms |
| **Benefits** | Less manual process board babysitting |
| **Risks** | Over-automation of consequential steps — require Approval + loopMode |

### AO-3 — Scheduled discovery & margin protection (existing templates)

| Field | Content |
|-------|---------|
| **What** | Implement real step handlers for `product_opportunity_discovery`, `margin_protection`, `forecast_evaluation` |
| **Enablers** | Workflow Engine templates (already defined), BullMQ cron (pattern from Google job), Search/Fabric, AI Runtime, Prisma |
| **Triggers** | `scheduled_interval`, `supplier_cost_change`, `forecast_horizon` |
| **BOs** | Product, Opportunity, Case, Listing, PredictionOutcome |
| **AI?** | Rank/synthesize optional; tools mandatory |
| **Benefits** | Continuous portfolio hygiene |
| **Risks** | Template `shadow_only`/`coming_soon` must stay honest until handlers exist |

### AO-4 — Connector health self-heal and sync loop

| Field | Content |
|-------|---------|
| **What** | Periodic probe; on unhealthy, re-resolve capability; on healthy, incremental sync |
| **Enablers** | LiveConnectorService, Fabric, BullMQ, Event Fabric ConnectorHealthChanged, Redis optional lock |
| **Triggers** | Cron; ConnectorHealthChanged; webhook |
| **BOs** | ConnectorInstallation, Product, Order |
| **AI?** | No for heal; optional diagnose profile for ops |
| **Benefits** | Higher live readiness, less manual ops |
| **Risks** | Credential thrash; rate limits — respect fabric rateLimit |

### AO-5 — ApprovalDecided → workflow resume → publish/PO

| Field | Content |
|-------|---------|
| **What** | Close the gate automatically when human approves |
| **Enablers** | Approval service events, Workflow resume, Fabric publish_listing / submit PO |
| **Triggers** | ApprovalDecided |
| **BOs** | Approval, Listing, Case, PO |
| **AI?** | No execution; optional prior briefing artifact |
| **Benefits** | Removes manual “now go publish” hop |
| **Risks** | Must verify approval binds workflowRunId/stepId |

### AO-6 — Closed-loop learning automation

| Field | Content |
|-------|---------|
| **What** | After fulfill/reconcile, write PredictionOutcome; adjust future filters/scores |
| **Enablers** | Existing `recordLearningFromRecommendations` logic, forecast template, Event Fabric, analytics signals |
| **Triggers** | ShipmentUpdated delivered; ReconciliationCompleted; schedule |
| **BOs** | PredictionOutcome, Opportunity, Case (learn stage) |
| **AI?** | Optional executive brief on miss/hit |
| **Benefits** | Platform improves without feature factories |
| **Risks** | Bad labels if dataMode fixture mixed with live |

### AO-7 — Search Manager semantic rank with Cohere Embed/Rerank

| Field | Content |
|-------|---------|
| **What** | Internal retrieval quality using already-paid Cohere capabilities |
| **Enablers** | Cohere embed/rerank adapters, Search Manager, Postgres product text |
| **Triggers** | Search requests; AI retrieve step |
| **BOs** | None write; read Product/Case |
| **AI?** | Embeddings are AI infrastructure; not Phase B narrative |
| **Benefits** | Better evidence without new search vendor |
| **Risks** | Cost/latency; cache with Redis |

### AO-8 — Unified automation from webhooks

| Field | Content |
|-------|---------|
| **What** | WebhookReceipt → domain event → workflow (orders, inventory, trackers) |
| **Enablers** | EventFabricService.recordWebhook (exists), BullMQ, Fabric normalize |
| **Triggers** | webhook.* events |
| **BOs** | Order, Inventory, Shipment |
| **AI?** | Exception drafting only when policy allows |
| **Benefits** | Near-real-time COS |
| **Risks** | Idempotency (partially present via externalEventId) |

### AO-9 — Shadow autopilot comparison

| Field | Content |
|-------|---------|
| **What** | Run automations in shadow; log ShadowDecision; promote controlled_live per org |
| **Enablers** | ShadowDecision table usage, loop modes, workflow dryRun flags |
| **Triggers** | Same as live automations with dryRun |
| **BOs** | Shadow ledger; no live side effects |
| **AI?** | Same tools, no consequential invoke |
| **Benefits** | Safe path to autonomy |
| **Risks** | Operators must not treat shadow as live (Data Fabric) |

### AO-10 — Case friction / next action auto-queue

| Field | Content |
|-------|---------|
| **What** | commerce-friction + computeNextAction → enqueue non-consequential prep tasks |
| **Enablers** | commerce-state-engine, process-tasks, Workflow, Event Fabric |
| **Triggers** | Case sync; nightly job |
| **BOs** | Case, tasks |
| **AI?** | Optional for research stages only |
| **Benefits** | Process board stays current |
| **Risks** | Task spam — throttle per case |

---

## 8. Feedback loops for increasing autonomy

| Feedback loop | Documented intent | Status | Gap |
|---------------|-------------------|--------|-----|
| **Prediction vs actual** | learn stage, PredictionOutcome | Partial host learning | Not scheduled/event-driven continuously |
| **Shadow vs live outcomes** | ShadowDecision | Partial writes | No systematic promotion metrics |
| **Connector health → capability selection** | Fabric resolve | Partial | AI path bypasses |
| **Policy blocked → qualify** | Case facts | Implemented in sync inference | No auto-remediation workflows |
| **Approval latency → process friction** | friction engine | Code exists | Not automated ops response |
| **Search hit quality → rerank** | Cohere rerank | Underutilized | Not in Search Manager |
| **Agentic readiness → publish gate** | agentic-readiness.ts | Underutilized | Not wired to publish workflow |
| **Event audit → replay/training** | Event Fabric | Partial | No replay consumer for improvement |
| **Persona outcomes → prompt/tool allow-list** | workspace | Partial | Static-ish allow lists |

**Missing master loop:** Event → Workflow decision → (AI tools optional) → BO write → Event, with human gate only when risk class requires.

---

## 9. Production-grade automation across Commerce Lifecycle

| Stage | Automatable with current stack? | Blocker class |
|-------|----------------------------------|---------------|
| discover | Yes — schedule + Search/Fabric + AI rank | Workflow real steps **Missing** |
| evaluate | Yes — tools already | Durability **Missing** |
| qualify | Partial — policy tools | Human/policy rules OK |
| prepare | Partial — draft listing | Fabric exclusive path **Gap** |
| approve | Human required | Resume wiring **Missing** |
| publish | Yes after approval | Fabric + resume **Partial** |
| sell | Webhook-driven | Consumer workflows **Underutilized** |
| source | Template exists | operational_partial / not AI-bound |
| fulfill | EasyPost registry | create_shipment automation **Partial** |
| reconcile | Stripe/payment tools | Event-driven **Partial** |
| learn | Learning function exists | Loop schedule **Missing** |
| closed | Infer from facts | OK |

**Conclusion:** Lifecycle **can** be automated end-to-end with the **existing** stack once Workflow+Events+BullMQ are the spine. Today automation is **islands** (Google weekend job, in-request AI, one-shot templates).

---

## 10. Self-healing, retries, resume, diagnostics, monitoring, continuation

| Concern | Documented | Implemented | Classification |
|---------|------------|-------------|----------------|
| Self-healing | Connector re-status, retries | Limited install touch on sync | **Missing** general |
| Retries | BullMQ + workflow attempts | Worker jobs only | **Underutilized** |
| Resumable execution | DurableWorkflowRun | Snapshot not step machine | **Architectural Gap** |
| Diagnostics | Health, AI deep, ops | Present | **Partially Implemented** |
| Monitoring | OTEL/Sentry/metrics | Counters + optional OTLP note | **Underutilized** |
| Intelligent continuation | Events + transforms | Not wired | **Missing** |

---

## 11. Stack sufficiency vs new technology

| Proposal sometimes heard | Verdict for TradeOps |
|--------------------------|----------------------|
| New workflow SaaS (Temporal cloud, etc.) | **Not required** — Workflow Engine + BullMQ + Postgres match ADR |
| New search SaaS | **Not required** — Search Manager + Cohere rerank + Postgres first |
| New AI orchestrator framework | **Not required** — One AI Runtime is the orchestrator |
| Graph DB | **Not required** — KG is documented projection |
| Kafka | **Not required now** — Event Fabric + Postgres + workers; revisit only under scale pressure (ADR) |
| Full OTEL SDK package | **Deploy-time completion** of existing design — not a new architectural technology |

**Only “new” work that is justified:** complete wiring of packages and worker jobs already in the monorepo.

---

## 12. Priority roadmap (automation & stack activation)

Aligned with production readiness P0–P2; focused on **utilization**:

| Priority | Action | Activates |
|----------|--------|-----------|
| P0 | Auth-lock diagnostics; envelope; schema gate; tenant tests | Security / contracts |
| P0 | Queue AI runs via BullMQ; status via runId + SSE | Worker, Redis, retries |
| P1 | Step-wise Workflow Engine + Event per step | Workflow, Events |
| P1 | ApprovalDecided → resume job | Events, Workflow, Fabric |
| P1 | SearchPort + FabricPort only on AI path | Search, Fabric, Cohere embed optional |
| P1 | Implement 1–2 templates fully (discovery + forecast) | Templates, BullMQ cron |
| P2 | Webhook → workflow consumers | Event Fabric |
| P2 | Learning + margin jobs | Analytics loop |
| P2 | OTEL/Sentry activation in deploy | Observability |
| P2 | KG invalidate on BO events | Knowledge Graph |
| P3 | Shadow autopilot metrics; agentic readiness publish gate | Autonomy |

---

## 13. Observations index (selected)

| ID | Observation | Classification |
|----|-------------|----------------|
| ST-01 | Nest/Next/Prisma deliver core COS APIs and UI | Fully Implemented |
| ST-02 | AI vertical slice (tools + Cohere + SSE + runs) works | Partially Implemented |
| ST-03 | AiOperatorService still owns too much orchestration | Architectural Gap |
| ST-04 | Workflow templates defined; execution one-shot / partial | Partially Implemented |
| ST-05 | BullMQ worker only heartbeat + Google feed | Underutilized |
| ST-06 | Redis optional health; unused for workflow/AI jobs | Underutilized |
| ST-07 | Search Manager internal-only; AI Prisma/Tavily parallel | Architectural Gap |
| ST-08 | Fabric capabilities cataloged; AI not exclusive consumer | Partially Implemented |
| ST-09 | KG projection unused on AI path | Underutilized |
| ST-10 | Event Fabric sparse for AI/workflow steps | Partially Implemented |
| ST-11 | Case spine strong; AI often product-first | Partially Implemented |
| ST-12 | Cohere Chat used; Embed/Rerank unused in Search | Underutilized |
| ST-13 | OTEL configured as noop_local by default | Underutilized |
| ST-14 | Sentry/PostHog/GA4 in connector catalog not AI loops | Underutilized |
| ST-15 | Durable resume/retry for AI **Missing** on critical path | Missing |
| ST-16 | Event-driven continuation **Missing** | Missing / Automation Opportunity |
| ST-17 | Closed-loop learning logic exists but not scheduled | Automation Opportunity |
| ST-18 | Stack sufficient without major new tech | Fully Implemented (as decision) |

---

## 14. Closing judgment

TradeOps has **built the right stack for a Commerce Operating System** and **documented One-* ownership**. Implementation has proven a **working AI vertical slice** and **foundational domain services**, but **most of the automation surface area of the stack is idle**.

Autonomy will not come from adding platforms. It will come from:

1. **Making Workflow Engine + BullMQ the execution backbone**  
2. **Making Event Fabric the trigger and audit backbone**  
3. **Confining AI Runtime to intelligence inside steps**  
4. **Forcing Search Manager and Connector Fabric exclusivity**  
5. **Closing learn/approve/health feedback loops with jobs already possible today**

That is full alignment with: One Platform, One Workspace, One Commerce Case, One AI Runtime, One Workflow Engine, One Search Layer, One Connector Fabric, One Knowledge Graph, One Data Fabric, One Source of Truth.
