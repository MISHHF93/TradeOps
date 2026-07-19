# TradeOps AI Runtime — Definitive Normalized Architecture

**Status:** Canonical blueprint (architectural normalization complete as design)  
**Role:** Lead Enterprise Architect — single source of truth for AI + COS integration  
**Supersedes (for design intent):** fragmented partial ownership across Operator service, dual search paths, one-shot workflows, standalone AI UX  
**Implements principles:**

| Principle | Meaning |
|-----------|---------|
| **One Platform** | Single TradeOps monorepo COS — no parallel AI product stack |
| **One Workspace** | Persona shell; pages are object workspaces, not feature apps |
| **One Commerce Case** | Primary orchestration object for commerce work |
| **One AI Runtime** | Sole intelligence execution engine |
| **One Workflow Engine** | Sole durable multi-step execution |
| **One Search Layer** | Sole retrieval orchestrator (Search Manager) |
| **One Connector Fabric** | Sole external commerce I/O boundary |
| **One Knowledge Graph** | Sole relationship projection over BOs |
| **One Data Fabric** | Sole honesty/labeling policy for evidence and writes |
| **One Source of Truth** | Each fact has exactly one system of record |

**Companion detail docs** (normative subsections expanded there):  
`AI_RUNTIME_ARCHITECTURE`, `COMMERCE_CASE_AI_ORCHESTRATION`, `SEARCH_MANAGER_ARCHITECTURE`, `CONNECTOR_FABRIC_ARCHITECTURE`, `AI_OUTPUT_OWNERSHIP`, `EVENT_DRIVEN_EXECUTION`, `CONTEXTUAL_AI_UX`, `AI_PRODUCTION_READINESS`, `DOMAIN_OBJECT_OWNERSHIP`, `END_TO_END_RUNTIME`

---

## 1. Final component architecture

### 1.1 System diagram

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  ONE WORKSPACE (Next.js terminal shell)                                      │
│  Command bar · Persona Focus (BOs) · Object workspace · AI Context Rail     │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ HTTPS + session cookies
┌───────────────────────────────▼──────────────────────────────────────────────┐
│  API HOST (Nest)                                                             │
│  Auth · Tenant · Entitlements · SSE transport · Port adapters · Persistence  │
│  Thin AI Host Adapter (not orchestrator)                                     │
└───────┬─────────────────┬─────────────────┬─────────────────┬────────────────┘
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐
│ ONE AI        │ │ ONE WORKFLOW  │ │ ONE SEARCH    │ │ ONE CONNECTOR FABRIC  │
│ RUNTIME       │ │ ENGINE        │ │ MANAGER       │ │                       │
│ @tradeops/    │ │ durable steps │ │ plan+adapters │ │ capability invoke     │
│ ai-runtime    │ │ resume/retry  │ │ SearchHit[]   │ │ normalize → BO        │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └───────────┬───────────┘
        │ ports only      │                 │                     │
        └────────┬────────┴────────┬────────┴──────────┬──────────┘
                 ▼                 ▼                   ▼
        ┌────────────────────────────────────────────────────┐
        │  DOMAIN SERVICES → canonical Business Objects      │
        │  Product · Case · Listing · Order · Payment · …    │
        └────────────────────────┬───────────────────────────┘
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │  ONE EVENT FABRIC  ·  ONE DATA FABRIC labels       │
        │  ONE KNOWLEDGE GRAPH (projection)                  │
        │  ONE ARTIFACT STORE (AI kinds, case-attached)      │
        └────────────────────────────────────────────────────┘
```

### 1.2 Component catalog (final)

| Component | Package / locus | Sole owner of |
|-----------|-----------------|---------------|
| **AI Runtime** | `@tradeops/ai-runtime` | Prompts, tools registry, schemas, artifact kinds, validation, repair, evidence, provenance packaging, Phase A/B orchestration, response contracts, stream event model, agent profiles |
| **AI Host Adapter** | `apps/api` AI module (thin) | Authz, entitlement, SSE/HTTP, port wiring, persist runs/artifacts, emit events |
| **Workflow Engine** | `@tradeops/workflow-engine` + host | Durable steps, checkpoints, resume, retries, approval pause |
| **Search Manager** | commerce-engine orchestration + `SearchService` host | All retrieval capabilities |
| **Connector Fabric** | `@tradeops/connector-core` + fabric invoke host | Business capability invoke, provider resolve, normalize |
| **Commerce domain** | commerce services + Prisma | BO writes, Case stage machine |
| **Event Fabric** | `EventFabricService` | Immutable domain event log |
| **Knowledge Graph** | commerce-engine projection | Relationship graph over BOs |
| **Data Fabric** | policy + provenance types | dataMode / origin labeling rules |
| **Artifact store** | host persistence | Versioned AI artifacts |
| **Generative provider** | Cohere adapter (runtime) | Chat/Embed/Rerank only |
| **Public web provider** | Search Manager adapter (Tavily) | Public search/extract — **not** AI Runtime direct |

### 1.3 Ports (AI Runtime edge)

```text
SearchPort | FabricPort | CasePort | BusinessObjectPort | KnowledgeGraphPort
WorkflowPort | EventPort | ArtifactStorePort | RunStorePort | EntitlementPort | WorkspacePort
```

**Rule:** Runtime never calls Prisma, Tavily, Shopify, Stripe, or vendor SDKs.

---

## 2. Execution flow (end-to-end)

### 2.1 Happy path (case-bound objective)

```text
1. User on Case workspace → AI Context Rail (or next action)
2. Client POST /api/v1/ai/operator/run[/stream]
   body: { objective, commerceCaseId, … }
3. AuthGuard → AuthContext (org, user, permissions)
4. EntitlementPort.assertAiEvaluationAllowed
5. Host builds AiRunRequest + ports
6. Workflow Engine: create WorkflowRun (template ai_objective_execution)
   → WorkflowRunStarted
7. AI Run created (child of workflow; bound to case)
   → AIObjectiveStarted
8. AI Runtime AiExecutionEngine.run
   a. classify + plan
   b. Phase A tools via SearchPort / FabricPort / domain ports
   c. critic + auditor
   d. Phase B Cohere (optional) → validate + repair
   e. materialize artifacts (in-memory)
   f. CanonicalEnvelope
9. Host commit order (single consistency pipeline):
   BO writes (Opportunity, PolicyAssessment, Listing, …)
   → Case ensure/sync (stage from facts)
   → ArtifactStore persist (case-attached)
   → RunStore complete
   → EventPort (step + domain events)
   → KG projection invalidate/rebuild
10. If approval required → Workflow awaiting_approval → Approval BO
11. Else WorkflowRunCompleted + AIObjectiveCompleted
12. SSE/HTTP returns envelope; rail shows summary; case AI facet updated
```

### 2.2 Runtime states (authoritative)

```text
idle → queued → classifying → retrieving → calling_tools → normalizing
  → validating → awaiting_approval → executing → reconciling
  → completed | partial | blocked | failed
```

SSE and envelope `meta.state` use **only** these values.

### 2.3 Binding modes

| Mode | When | Case |
|------|------|------|
| `case` | Single opportunity work | Required `commerceCaseId` |
| `multi_case` | Portfolio discover/rank | Ensure/sync case per product touched |
| `org_non_commerce` | Billing, connector ops diagnose | No case stage writes |

---

## 3. Runtime ownership

### 3.1 AI Runtime owns

| Subsystem | Responsibility |
|-----------|----------------|
| **Prompt Registry** | Versioned templates; render with vars |
| **Tool Registry** | Definitions, invoke policy, traces |
| **Schema Registry** | Structured output contracts |
| **Artifact Registry** | Kinds + schema binding + approval defaults |
| **Validation** | Critic, auditor, schema validate, decisions |
| **Repair** | Bounded structured repair; honest demotion |
| **Evidence** | EvidencePackage + Phase B fact brief |
| **Provenance packaging** | Aggregate ProvenanceRecords for envelope |
| **Agent Orchestration** | `AiExecutionEngine` — sole AI pipeline |
| **Response Contracts** | `CanonicalEnvelope` builder |
| **Streaming model** | `AiStreamEvent` aligned to RUNTIME_STATES |
| **Provider abstraction** | Cohere-only generative policy |
| **Agent profiles** | Persona/tool/prompt packs (not forked engines) |

### 3.2 AI Runtime does not own

Commerce stage, durable workflow steps, search indexes, connector HTTP, Prisma, auth sessions, Approval decisions, BO systems of record.

### 3.3 Host adapter owns

HTTP/SSE, AuthGuard, entitlements, implementing ports, persistence, EventPort publish, wiring Nest services.

---

## 4. Business object ownership

### 4.1 System of record matrix

| Object | SoR | AI role |
|--------|-----|---------|
| Commerce Case | CaseService | Bind, attach artifacts, trigger sync — never write stage directly |
| Product | Product domain | Discover/import via Fabric/domain; no SERP-as-product |
| Supplier / Offer | Domain | Fabric `search_suppliers` persist path |
| Listing | Domain | prepare/publish via Fabric + domain |
| Order | Domain | Read/explain; capability writes |
| Shipment | Domain | `create_shipment` capability |
| Payment | Domain | `verify_payment` / reconcile |
| Customer | Domain | Insights with provenance |
| Document | Document store | Search cite; store if tenant doc |
| Opportunity | Domain | Scores/economics SoR (not rec JSON alone) |
| PolicyAssessment | Domain | Policy outcome SoR |
| Approval | Domain | Human gate SoR |
| PredictionOutcome | Analytics domain | Learn-back SoR |
| AI Run | Run store | Execution audit child |
| AI Artifact | Artifact store | Proposals, evidence, briefings |
| Workflow Run | Workflow store | Durable execution |
| ConnectorInstallation | Ops domain | Health/install |

### 4.2 Dual-ownership ban

- **Facts** → BO only  
- **Narratives / evidence bundles / plans** → AI Artifact (reference BO ids)  
- **Relationships** → KG projection (not free text)  
- **Honesty** → Data Fabric labels on evidence and writes  

See `AI_OUTPUT_OWNERSHIP.md` for full AI output inventory (O1–O35).

---

## 5. Commerce Case lifecycle

### 5.1 Stages (spine)

```text
discover → evaluate → qualify → prepare → approve → publish
  → sell → source → fulfill → reconcile → learn → closed
```

### 5.2 Rules

1. **Case is primary orchestration object** for commerce AI.  
2. Stage advances only via **domain facts** + CaseService (`inferStageFromFacts` / validated transition) — never LLM stage assignment.  
3. AI proposes **CommerceTransformations**; domain applies.  
4. Every case-applicable AI run sets `bindingMode=case|multi_case` and attaches artifacts to cases.  
5. Product page is a **twin facet** of the case (no orphan product process).  

### 5.3 AI × stage (illustrative)

| Stage | Typical AI / capability |
|-------|-------------------------|
| discover / evaluate | Search, profit, policy, rank → Opportunity |
| qualify | Policy assessment |
| prepare | prepare_listing, media |
| approve | Brief only; human Approval |
| publish | publish_listing after approval (Fabric) |
| sell → fulfill | Orders, create_shipment, exceptions |
| reconcile / learn | verify_payment, PredictionOutcome |

---

## 6. Workflow lifecycle

### 6.1 One Workflow Engine

| Concern | Owner |
|---------|--------|
| Template catalog | Workflow Engine |
| Durable run + steps | Workflow Engine |
| Resume / retry / DLQ | Workflow Engine |
| Approval pause | Workflow status `awaiting_approval` |
| AI plan proposal | AI Artifact `workflow_plan` → **creates** Workflow Run |
| In-step intelligence | AI Runtime (called by step handlers) |

### 6.2 AI objective template (canonical steps)

```text
ai.run_accepted → ai.classify_objective → ai.retrieve_evidence
  → ai.invoke_tools → ai.normalize_candidates → ai.evaluate_economics
  → ai.assess_policy → ai.rank_opportunities → ai.critic_auditor
  → ai.synthesize_briefing → ai.materialize_artifacts → ai.sync_cases
  → [ai.await_approval] → ai.completed | ai.failed | ai.blocked
```

Each step = transition + domain event + checkpoint.

### 6.3 Correlation

```text
traceId · workflowRunId (correlationId) · aiRunId · commerceCaseId · causationId
```

---

## 7. Search architecture

### 7.1 One Search Layer

```text
Caller → Search Manager → adapters → SearchHit[] + honesty
```

| Capability | Adapter |
|------------|---------|
| `internal_retrieval` | Canonical store |
| `documents` | Document corpus |
| `knowledge_graph` | KG projection as hits |
| `public_search` / `public_extract` | Tavily (behind Manager) |
| `supplier_search` | Fabric `search_suppliers` |
| `marketplace_discovery` | Fabric capability |
| `official_documentation` | Docs corpus ± constrained public |

### 7.2 Rules

- AI Runtime tools only call **SearchPort** — never Tavily/Prisma search.  
- Command bar uses the **same** Search Manager.  
- Evidence artifacts are Manager responses, not ad-hoc tool blobs.

---

## 8. Connector architecture

### 8.1 One Connector Fabric

```text
Business capability request
  → authorize + resolve provider
  → technical op (Fabric-private)
  → live OR fixture adapter (no silent failover)
  → normalize → canonical BO
  → event + dataMode
```

### 8.2 Business capabilities (AI-facing)

Examples: `search_suppliers`, `discover_products`, `prepare_listing`, `publish_listing`, `update_inventory`, `create_shipment`, `verify_payment`, `read_orders`, `submit_supplier_purchase`, …

### 8.3 Rules

- AI never selects `providerKey` or vendor REST.  
- Technical ops and SDKs are Fabric-private.  
- Cohere/Tavily are **not** commerce Fabric executors (AI Runtime / Search Manager).  

---

## 9. AI pipeline

### 9.1 Two-phase always

```text
Phase A — Deterministic
  classify → plan → tools (Search/Fabric/domain) → evidence + provenance
  → critic → auditor → decision

Phase B — Generative (optional)
  Cohere only → schema-bound JSON → validate → repair (bounded)
  → narrative for envelope.text

Materialize
  artifacts + CanonicalEnvelope
```

### 9.2 Generative policy

| Rule | Enforcement |
|------|-------------|
| Sole provider Cohere | Provider abstraction |
| No multi-model failover | Offline/blocked adapter |
| No fixed product essay | Empty/blocked honest text |
| Never invent products/prices | Evidence-only system prompts + tools |

### 9.3 Agent profiles (not engines)

`operator.commerce` · `researcher.scan` · `executive.brief` · `developer.diagnose` · `automation.worker`

Same engine; different prompts/tools/risk defaults.

---

## 10. Event Fabric

### 10.1 One event log

`EventFabricService` → `CommerceEvent` (tenant-scoped).

### 10.2 Rule

**Every meaningful action = workflow transition + domain event.**

### 10.3 Core + AI/workflow events

Domain: ProductDiscovered, ProductEvaluated, CommerceCaseAdvanced, ApprovalRequested/Decided, ListingPrepared/Published, OrderReceived, PaymentVerified, SupplierOrderPrepared, ShipmentCreated/Updated, ReconciliationCompleted, PredictionEvaluated, ConnectorHealthChanged, …

AI/Workflow: AIObjectiveStarted/Completed, ToolExecutionCompleted/Failed, WorkflowRun*, WorkflowStep*, EvidenceRetrieved, AiValidationCompleted, AiBriefingSynthesized, AiArtifactMaterialized, CapabilityInvoked, …

### 10.4 Envelope fields

`correlationId`, `causationId`, `traceId`, `dataMode`, `entityType` (prefer `commerce_case`), `workflowRunId`, `aiRunId`, `stepId`, provenance refs.

### 10.5 SSE

Projection of runtime/workflow events — **not** a second audit store.

---

## 11. Knowledge Graph

### 11.1 One graph — projection only

```text
BO loaders → projectCaseKnowledgeGraph → nodes/edges
```

Not a separate write-ahead fact store.

### 11.2 When updated

After commit pipeline (BO + artifacts + run): rebuild/invalidate projection for affected case(s).

### 11.3 AI usage

Case-bound runs request KG via SearchPort `knowledge_graph` or KnowledgeGraphPort into Evidence — never invent edges from briefing text.

### 11.4 Required relations (examples)

`case_for_product`, `product_has_opportunity`, `product_has_listing`, `product_has_artifact`, `ai_run_about_case`, `ai_run_about_product`, `order_contains_product`, `approval_for_listing`, …

---

## 12. Data Fabric

### 12.1 One honesty policy

| Mode | Meaning |
|------|---------|
| `live` | Authorized external provider |
| `fixture` | Same contract, non-production data |
| `simulation` | Synthetic computation |
| `shadow` | Would-do ledger, no external write |
| `blocked` | Missing capability/credential |

### 12.2 Rules

- Every SearchHit, Fabric result, BO write provenance, artifact evidence item, event, and envelope carries mode/origin.  
- **Never** silent live→fixture failover.  
- Mixed evidence → explicit mixed warnings + UI banners.  
- Data Fabric does **not** store parallel catalogs — it **labels**.

---

## 13. Streaming

| Layer | Role |
|-------|------|
| Runtime | Emits `AiStreamEvent { state: RUNTIME_STATES, step, detail, at, requestId }` |
| Host | SSE `event: state` / `event: result` / `event: error` |
| Client | Renders progress; reconnect by runId when durable |
| Optional | Token deltas only as projection of same run (not second path) |

No client-side fake timers.

---

## 14. Security

| Control | Design |
|---------|--------|
| Auth | Session or founder_direct; AuthGuard default |
| Tenant | Org only from AuthContext — never client org id |
| Permissions | Tool + route (`ai:read`/`ai:write`, domain perms) |
| Entitlements | SaaS assert before AI/workflow |
| Diagnostics | **Authenticated** (no public tool/runtime catalogs in prod) |
| Rate limits | Per-org AI run/stream |
| Research | SSRF allowlist / provider-mediated extract only |
| Secrets | Never in logs, health bodies, or envelopes |
| Approvals | Consequential live writes require Approval BO |
| Prompt | Tools only; no arbitrary code execution |

---

## 15. Observability

| Signal | Design |
|--------|--------|
| Logs | Structured: orgId, runId, workflowRunId, traceId, state |
| Metrics | RED for AI runs, Phase A/B latency, tool errors, Cohere codes |
| Traces | OTEL span per run/step/tool; align with Event Fabric ids |
| Health | Liveness; readiness includes DB + configured critical AI deps (authz) |
| Diagnostics | Authenticated `/ai/health` deep Cohere probe; connector health; wiring matrix |
| Audit | Event Fabric + identity AuditService (auth only) |

---

## 16. AI Artifact lifecycle

### 16.1 Kinds (canonical)

`execution_package` · `recommendation_card` · `profit_calculation` · `policy_assessment` · `listing_draft` · `approval_request` · `search_evidence` · `workflow_plan` · `media_analysis` · `operator_briefing` · `validation_report` · …

### 16.2 Lifecycle

```text
draft → validated → [awaiting_approval] → ready | rejected | superseded
```

### 16.3 Ownership

- Process-relevant artifacts **attach to Commerce Case**.  
- AI Run is **producer** ref.  
- Artifacts **reference** BO ids; they do not replace BO SoR.  
- Approvals reference artifact + BO ids.

---

## 17. Production deployment model

### 17.1 Topology

```text
[Browser] → Next.js (web)
         → Nest API (api)  ←── session cookie / founder_direct
                ├── Postgres (canonical BOs, events, runs, artifacts)
                ├── Redis (optional cache/session — degraded if down)
                ├── Cohere (generative)
                ├── Tavily (public search via Search Manager)
                └── Live connectors (Shopify, Stripe, EasyPost, …) via Fabric
```

### 17.2 Environments

| Env | AI posture |
|-----|------------|
| Local | Fixture connectors + optional live keys; honesty banners |
| Staging | Full stack; deep health; multi-tenant tests |
| Production | Auth-locked diagnostics; rate limits; durable workflows; fail-closed approvals; no public AI catalogs |

### 17.3 Configuration (non-secret principles)

- `COHERE_API_KEY` — required for Phase B narrative  
- `TAVILY_API_KEY` — required for public search  
- Connector credentials — per Fabric manifest  
- Loop mode / force fixture — ops policy, not silent  
- Simulation flag — explicit banner  

### 17.4 Deploy units

Monorepo packages published/built together; API owns server secrets; web has no generative keys.

### 17.5 Failure modes

| Failure | Behavior |
|---------|----------|
| Cohere down/missing | Tools continue; briefing blocked honest |
| Tavily missing | Public search blocked; internal search continues |
| Connector unhealthy | Capability blocked; no fake live |
| Redis down | Degraded health; core path continues if designed |
| Mid-run crash | Resume from Workflow checkpoint (target) |

### 17.6 Production readiness gate (summary)

P0: security lock, envelope, schema gate, SSE states, tenant tests, approval fail-closed, mixed dataMode, AI metrics.  
P1: durable workflow, full events, fabric/search exclusivity, consistency pipeline.  
See `AI_PRODUCTION_READINESS.md`.

---

## 18. UX (One Workspace)

| Element | Role |
|---------|------|
| Persona Focus nav | Business objects & procedure — **not** “AI home” |
| Object workspace | Case/Product/Listing/Order/… facets |
| AI Context Rail | **Sole** composer + progress + summary |
| Run history | Secondary activity; linked from case |
| Command bar | Search Manager → navigate to BOs |

AI is contextual inside Cases, Products, Suppliers, Listings, Orders, Analytics, Research, Operations — never a standalone destination.

---

## 19. Anti-duplication register (normalized away)

| Former duplication | Normalized owner |
|--------------------|------------------|
| Nest megaservice orchestration | AI Runtime engine |
| Prisma search in AI + SearchService | One Search Manager |
| Tavily in ai-runtime | Search Manager public adapter |
| planJson vs workflow-engine | One Workflow Engine |
| SSE vs events as dual truth | Events SoR; SSE projection |
| Technical connector ops in AI | Fabric business capabilities |
| Recommendation scores vs Opportunity | Opportunity SoR |
| AI stage vs Case stage | Case SoR |
| Multiple AI panels/pages | One rail + object facet |
| Cohere + xAI generative | Cohere only |
| Multiple product DTO pipelines | Canonical BO mappers |

---

## 20. End-to-end capability wiring map

| Visible capability | UI | Host | Runtime | Search | Fabric | Case/BO | Workflow | Events | KG | Data Fabric |
|--------------------|----|------|---------|--------|--------|---------|----------|--------|-----|-------------|
| Rank opportunities | Rail on Discover/Case | Host adapter | Phase A tools | internal | — | Opportunity+Case | ai_* steps | ProductEvaluated, CaseAdvanced | edges | labels |
| Public research | Rail | — | tool→SearchPort | public_search | — | evidence artifact | retrieve step | EvidenceRetrieved | — | live/blocked |
| Search suppliers | Case suppliers | — | tool→Search/Fabric | supplier_search | search_suppliers | Offer/Product | step | domain | nodes | dataMode |
| Draft listing | Case prepare | domain | tool | — | prepare_listing | Listing | step | ListingPrepared | listing edge | |
| Publish listing | Approvals+Case | domain | — | — | publish_listing | Listing+Approval | await+resume | Approval*, ListingPublished | | live |
| Create shipment | Order/Fulfill | domain | tool/cap | — | create_shipment | Shipment | step | ShipmentCreated | | |
| Verify payment | Finance | domain | tool/cap | — | verify_payment | Payment | step | PaymentVerified | | |
| Ops diagnose | Connectors | ops | profile tools | internal | health | no case stage | optional | ConnectorHealth | | |
| Executive brief | Persona home | host | profile | internal | — | multi_case read | steps | AIObjective* | | |

Every row has a single path — no parallel implementation.

---

## 21. Package layout (target)

```text
packages/ai-runtime/     engine, registries, validation, repair, evidence,
                         provenance, contracts, streaming, providers, ports types, profiles
packages/workflow-engine/ templates, durable run, step runner, retry
packages/commerce-engine/ lifecycle, state engine, BO, KG, search orchestration, provenance types
packages/connector-core/  capabilities, fabric, manifests, normalize
packages/contracts/       RUNTIME_STATES, envelope, events, dataMode
apps/api/                 host adapters, SearchService, Fabric invoke, EventFabric,
                          Case/Commerce services, thin AI module, WorkflowService
apps/web/                 One Workspace shell, ObjectWorkspace, AiContextPanel only
```

---

## 22. Source of truth quick reference

| Question | Answer |
|----------|--------|
| What stage is this opportunity in? | **Commerce Case** |
| What is the opportunity score? | **Opportunity** BO |
| What did the model say? | **operator_briefing** artifact + envelope.text |
| What evidence was used? | **search_evidence** + provenance |
| What is executing / can we resume? | **Workflow Run** |
| What happened historically? | **Event Fabric** |
| How are objects related? | **Knowledge Graph** projection |
| Is this live or fixture? | **Data Fabric** dataMode |
| How do we call a vendor? | **Connector Fabric** capability |
| How do we retrieve evidence? | **Search Manager** |
| How does AI think? | **AI Runtime** |
| Where does the user work? | **One Workspace** object page + rail |

---

## 23. Closing judgment

This blueprint is the **definitive normalized architecture** for TradeOps AI:

- **One** of each COS plane — no peer stacks.  
- **Clear ownership** — Runtime vs Host vs Domain vs Fabric vs Search vs Workflow.  
- **Case-first commerce** — AI Run is subordinate.  
- **Event-driven durability** — transitions + events + resume.  
- **Honest data** — Data Fabric labels end-to-end.  
- **Contextual UX** — intelligence in place, not a destination.  
- **Production posture** — security, contracts, schema gates, observability.

Implementation work is **normalization of the existing codebase onto this blueprint** (ports, commit pipeline, durable steps, Search/Fabric exclusivity, UX de-duplication, P0 readiness) — not invention of a second platform.

**Document status:** Canonical.  
**Detail docs:** Specializations of this blueprint; on conflict, this document wins for ownership boundaries.
