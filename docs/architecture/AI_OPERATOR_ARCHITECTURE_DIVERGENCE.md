# AI Operator — Architectural Divergence Audit

**Role:** Lead Enterprise Architect review  
**Scope:** Consistency of the **existing** AI Operator implementation with the TradeOps Commerce Operating System vision  
**Constraint:** No new feature proposals — only divergences and normalization recommendations  
**Primary references:**  
`docs/architecture/END_TO_END_RUNTIME.md`, `AI_EXECUTION_FLOW.md`, `DOMAIN_OBJECT_OWNERSHIP.md`, `CONNECTOR_FLOW.md`, `EVENT_FLOW.md`, `FRONTEND_BACKEND_WIRING.md`, `packages/contracts/src/runtime.ts`

**Code anchors:**  
`apps/api/src/ai/ai-operator.service.ts` (~2.2k lines), `packages/ai-runtime/*`, `packages/commerce-engine/*`, `packages/connector-core/*`, `packages/workflow-engine/*`, `apps/web` AI surfaces

---

## Executive summary

TradeOps has a **clear COS architecture** (case spine, fabric, tools, envelope, two-phase AI, honest dataMode). The AI Operator **implements a working vertical slice** of that vision (Phase A tools → Phase B Cohere → OperatorRun persistence → UI rail) but **concentrates orchestration, data access, and domain effects inside a single Nest service** and a **product-centric operator cycle**, rather than composing dedicated owners (Case, Search Manager, Connector Fabric, Knowledge Graph, Workflow Engine, Artifact store).

The result is **functional coherence with structural inconsistency**: the product path works; the ownership boundaries do not match the documented operating system.

---

## Target architecture (condensed)

From the architecture docs, a request should flow as:

```text
Persona workspace / AI rail
  → Nest API (auth, tenant, entitlements)
  → AI Runtime (prompts, schemas, tools, Phase A/B orchestration only)
  → Tools invoke domain services via capability contracts
  → Connector Fabric for external I/O
  → Normalization into canonical Business Objects
  → Commerce Case as unit of work when lifecycle-bound
  → Search Manager for unified evidence retrieval
  → Knowledge Graph for relationship context
  → Workflow Engine for durable multi-step plans
  → Event Fabric for domain events
  → Artifact lifecycle (typed, versioned, approved)
  → CanonicalEnvelope + dataMode honesty → UI
```

**Ownership rules (docs):**

| Concern | Owner |
|---------|--------|
| Prompts, schemas, tools, provider adapters | AI Runtime |
| Commerce Case lifecycle | Commerce domain / case services |
| Durable multi-step execution | Workflow Engine |
| Canonical objects | Domain packages + Prisma |
| Evidence search | Search orchestration (Search Manager) |
| External systems | Connector Fabric |
| Relationships for reasoning | Knowledge Graph projection |
| Side-effect facts | Event Fabric |
| AI outputs | Artifact kinds + persistence |

---

## 1. AI Runtime ownership

### Current implementation
- `packages/ai-runtime` owns: tool registry, operator cycle, Cohere/Tavily adapters, prompt/schema/artifact **registries**, critic/auditor, execution-navigator builders, live-examples catalog.
- `AiOperatorService` owns: loading products from Prisma, loop mode, entitlements, injecting large `deps` closures, listing drafts, billing, payments, case sync, execution package assembly, run persistence, SSE progress mapping.
- `runOperatorCycle` receives a pre-loaded `products[]` array rather than only capability calls.

### Target architecture
AI Runtime owns **how** objectives are planned and synthesized; it does **not** own product queries, listing creation, billing, or case advancement. Host injects thin ports; domain services execute.

### Why it violates the architecture
Runtime and “host app” responsibilities are blurred. A ~2.2k-line Nest service becomes the COS orchestrator, making AI Runtime a library of helpers rather than the **sole owner of AI execution**.

### Recommended normalization
- Shrink `AiOperatorService` to: authz, run lifecycle persistence, dep wiring, event emit, envelope wrap.
- Move all `prisma.product.findMany` / listing / payment logic fully behind **named domain ports** already partially present in tools — no inline Prisma in the AI module except for OperatorRun CRUD.
- Keep Phase A/B, tool registry, providers **only** in `@tradeops/ai-runtime`.

---

## 2. Commerce Case ownership

### Current implementation
- Cases are first-class in commerce (`CommerceCaseService`, process board, case workspace).
- Operator **can** bind `commerceCaseId` and load AI case context.
- Many runs (sidebar default) operate on **org product list**, then optionally **sync cases** after ranking.
- Domain rule “no orphan product without a Commerce Case after sync” is enforced inconsistently relative to AI: AI primarily ranks products, not case stage machines.

### Target architecture
Commerce Case is the **unit of work** for lifecycle-aware procedure. AI recommendations should attach to cases; stage-aware tools advance **case state** through domain APIs, not free-float product lists alone.

### Why it violates the architecture
AI execution is still **product-scan-first** (discover/rank SKUs). Case binding is optional garnish. That treats AI as a scanner assistant more than a **case runtime optimizer**.

### Recommended normalization
- Default contextual runs (case page) **require** caseId and load graph via case workspace APIs.
- Global discover objectives remain product-scoped but must always **emit/sync cases** through `CommerceCaseService` (single write path).
- Forbid AI module from inventing case transitions; only call case service methods.

---

## 3. Workflow ownership

### Current implementation
- `packages/workflow-engine` exists (`templates`, `durable-run`, `runner`).
- Operator cycle produces **inline plan steps / execution package tasks** in memory and JSON on `OperatorRun.planJson`.
- Artifact registry defines `workflow_plan` kind, but durable workflow runs are not the primary operator path.
- Automation controller uses workflow engine separately.

### Target architecture
Multi-step, durable, resumable plans belong to **Workflow Engine**. AI proposes a plan artifact; workflow owns execution and state.

### Why it violates the architecture
Operator “plans” are **ephemeral JSON** on OperatorRun, parallel to workflow-engine. Two planning models coexist → duplication and unclear source of truth for “what is executing.”

### Recommended normalization
- Treat operator plan as **proposal artifact** only.
- Hand off multi-step work to `workflow-engine` templates/durable runs when status leaves “analysis.”
- Single read model for “active executions” (workflow run id ↔ operator run id correlation).

---

## 4. Business Object ownership

### Current implementation
- Canonical types and object workspace live in `commerce-engine` (`business-objects`, `object-workspace`).
- Operator recommendations are **OperatorRecommendation** rows + card DTOs, loosely linked by `productId`.
- AI tools map ad-hoc product shapes from Prisma rows inside the host `deps.searchProducts`.

### Target architecture
All AI I/O about commerce is expressed as **Business Objects** (Product, Case, Listing, Order, …) with stable IDs and provenance — never raw Prisma shapes inside the AI module.

### Why it violates the architecture
AI layer re-shapes domain data instead of consuming **object-workspace / business-object APIs**. Ownership of “what a Product is” leaks into AI host glue.

### Recommended normalization
- Tools accept/return BO IDs + thin summaries from commerce-engine mappers.
- Recommendation cards reference BO handles (`productId`, `caseId`) exclusively; UI loads details from domain endpoints.

---

## 5. Search Manager usage

### Current implementation
- `commerce-engine/search-orchestration.ts` defines a **Unified Search Layer** (plan, hits, provenance, source kinds including `knowledge_graph`, `public_web`, `ai_run`).
- API SearchService powers command-bar search.
- Operator tool `searchConnectedProducts` uses **direct Prisma `product.findMany`**, not Search Manager.
- Public web research uses Tavily via `web-search-provider` **inside ai-runtime**, parallel to search orchestration’s `public_web` source kind.

### Target architecture
One **Search Manager** orchestrates internal + connector + web + KG evidence with unified provenance.

### Why it violates the architecture
Two search stacks: command-bar/unified search vs operator product scan + Tavily. Evidence shape and provenance differ; AI does not “route every request through” the documented search engine.

### Recommended normalization
- Operator retrieval tools call Search Manager with objective-derived plan.
- Tavily remains a **provider behind** search orchestration / fabric, not a peer path only known to ai-runtime.
- Operator evidence packages are `SearchHit[]` / `search_evidence` artifacts.

---

## 6. Connector Fabric usage

### Current implementation
- Fabric descriptors and manifests in `connector-core` (`fabric.ts`, registry, production connectors).
- Ecosystem board / capability selection is injected into tools (`ecosystemCapabilityBoard`, `selectConnectorsForCapabilities`).
- Live I/O for listings/orders often goes through commerce services → live-http.
- Operator research and catalog access are **not** uniformly expressed as fabric operations with the same probe/normalize/persist contract as CONNECTOR_FLOW.md.

### Target architecture
Capability request → fabric → install status → live/fixture adapter → normalize → persist → event.

### Why it violates the architecture
AI partially uses capability boards, but **bypasses fabric** for the main product retrieval path (Prisma) and embeds Tavily as AI-runtime-only. Fabric is a catalog/health surface more than the exclusive I/O boundary for AI tools.

### Recommended normalization
- Every external or catalog fetch from a tool goes through fabric operation IDs.
- Fixture vs live selection remains fabric policy (never silent failover) — already a principle; apply it to product search the same way as live-http.

---

## 7. Knowledge Graph integration

### Current implementation
- `knowledge-graph.ts` defines typed edges/nodes and case/product projections.
- Used in ecosystem / object workspace contexts.
- Operator cycle does **not** load a KG projection into Phase A/B evidence by default.
- Search orchestration lists `knowledge_graph` as a source kind; operator path does not consume it.

### Target architecture
AI reasoning over multi-object context uses **explicit graph relations** (case↔product↔listing↔order), not ad-hoc joins in the operator service.

### Why it violates the architecture
KG is implemented but **orthogonal** to the operator evidence pack. Architecture claims relationship-aware AI; operator remains SKU-list + tool scores.

### Recommended normalization
- When `commerceCaseId` (or productId) is present, inject KG projection into tool context / evidence brief.
- Phase B system prompt cites graph facts as first-class evidence lines (still no invention).

---

## 8. Event Fabric integration

### Current implementation
- `EventFabricService` + standard event types including `AIObjectiveStarted` / `AIObjectiveCompleted` / `ToolExecutionFailed`.
- Operator service emits AI lifecycle events (and related domain events for some side paths).
- Many tool outcomes (profit calc, policy, Tavily hits) are **not** mirrored as domain events.
- SSE UI stream uses **ad-hoc state names** (`queued`, `classifying`, `calling_tools`, …), not the fabric event log.

### Target architecture
Domain facts flow through Event Fabric; AI and UI can project from events. Runtime states in contracts align with observable progress.

### Why it violates the architecture
Dual progress systems: **SSE ephemeral states** vs **CommerceEvent** store. Incomplete event coverage for tool-level outcomes weakens “event fabric as OS nervous system.”

### Recommended normalization
- Keep SSE as a **projection** of fabric/runtime events (same names where possible).
- Ensure every consequential tool maps to `ToolExecutionFailed` or a domain event; non-consequential tools may batch into run-level events only (document the rule).
- Align `RUNTIME_STATES` with SSE `state` enum 1:1.

---

## 9. AI Artifact lifecycle

### Current implementation
- `artifact-registry.ts` registers kinds (execution_package, recommendation_card, search_evidence, workflow_plan, …).
- Operator persists primarily **OperatorRun** + **OperatorRecommendation** (+ planJson blob).
- Registries are catalogued on `GET /ai/runtime` but not a full artifact store with versioning, approval binding, and immutable blobs per kind.
- Phase B JSON is parsed into `responseSummary` text; structured artifact not always stored as first-class `search_evidence` / package rows.

### Target architecture
Artifacts are versioned, schema-validated, tenant-scoped objects with lifecycle (draft → validated → approved → superseded), referenced by runs and cases.

### Why it violates the architecture
“Artifact” is largely a **registry of kinds** plus **JSON columns**, not a lifecycle subsystem. UI and API treat `responseSummary` and cards as the product, while artifact kinds are underused.

### Recommended normalization
- On run completion, materialize artifacts by kind (package, cards, evidence) with schemaId + hash.
- Approvals reference artifact IDs, not free-text plan snippets.
- Rail shows summary; full workspace loads artifacts by id.

---

## 10. Streaming

### Current implementation
- Sidebar prefers SSE `POST /ai/operator/run/stream` with `event: state` + final `event: result`.
- Progress is host-buffered and pushed from operator cycle `onProgress`.
- No token-level `text.delta` from Cohere; Phase B is request/response.
- Event names do not match a full fabric catalog (`objective.started`, `artifact.validated`, …).

### Target architecture
Streaming exposes **real backend execution stages** (and optionally model deltas) consistently with runtime states; no simulated timers (already largely true).

### Why it violates the architecture
Streaming is a **thin progress channel**, not a first-class runtime projection. Partial alignment with `RUNTIME_STATES`; missing `normalizing` / `awaiting_approval` fidelity in many runs; no artifact validation stream event.

### Recommended normalization
- Map every Phase A/B milestone to `RUNTIME_STATES`.
- Emit `validating` only when schema validation runs; emit `blocked`/`failed` distinctly.
- Optional later: true token stream — only if it remains a projection of the same run id (not a second path).

---

## 11. Data Fabric

### Current implementation
- Honesty via `dataMode` (live/fixture/simulation/shadow/blocked) on envelopes and operator honesty blocks.
- Fixtures and live connectors share manifests; live-http vs fixture paths exist.
- Operator often runs entirely on **fixture products** while still calling Tavily (mixed evidence) — honesty notes exist but mixed mode is easy to misread in UI.
- No single “Data Fabric” module name; behavior is spread across connector-core, Prisma, and AI honesty fields.

### Target architecture
Data Fabric (or equivalent policy layer) decides **source selection, labeling, and mixing rules** for every evidence item before AI synthesis.

### Why it violates the architecture
Labeling is present; **central policy** is not. Mixing public web + fixture catalog can produce coherent prose that still confuses “what is operational truth.”

### Recommended normalization
- Enforce per-evidence `dataMode` in evidence brief to Phase B.
- UI and envelope `meta.dataMode` = strictest or multi-mode summary (`mixed`) as first-class, not only a note string.
- Data Fabric policy: when catalog is fixture, mark run `fixture` even if Tavily is live (or explicit `mixed` enum — contracts currently list single modes; document mixed as warnings[]).

---

## 12. Normalization

### Current implementation
- Connector normalize utilities exist (`connector-core/normalize.ts`).
- Operator maps Prisma products inline to operator product cards.
- Search hits vs operator products vs object-workspace views use different DTOs.

### Target architecture
One normalize step into canonical models before tools score or AI narrates.

### Why it violates the architecture
Multiple DTO pipelines → drift in fields (margin, fixture flags, confidence) between scanner UI, search, and AI cards.

### Recommended normalization
- Single mapper: Prisma/connector payload → canonical Product/Case DTOs → AI tools.
- Operator cycle accepts only canonical DTOs.

---

## 13. Duplication

| Duplicate | Instances | Architectural issue |
|-----------|-----------|---------------------|
| Product search | Search Manager vs Prisma in AI deps | Two retrieval owners |
| Web research | Search `public_web` vs ai-runtime Tavily | Two research owners |
| Planning | Operator planJson vs workflow-engine | Two plan owners |
| AI UI entry | (mitigated) rail vs `/terminal/ai` | Was product-level dup; redirect helps |
| Progress | SSE states vs Event Fabric | Two observation planes |
| Capability listing | ecosystem board vs tool list vs live-feed registry | Overlapping catalogs |
| xAI adapter file | present but generative policy ignores | Dead parallel provider surface |

### Recommended normalization
Collapse to one owner per row (see sections above). Remove or quarantine inactive provider adapters from the “active stack” surface area.

---

## 14. Technical debt (architecture-impacting)

| Debt | Impact |
|------|--------|
| `AiOperatorService` megaservice | Blocks clear ownership; high change risk |
| Operator cycle product-array input | Prevents case/KG-first execution |
| Artifact registry without store | Docs oversell “artifact OS” |
| Incomplete event coverage | Audit/replay gaps |
| Mixed SSE vs RUNTIME_STATES naming | Client/server drift |
| Workflow engine side path | Future “AI executes plans” will fork again |
| Legacy xAI adapter | Confuses “sole provider” story |
| Large unfocused web/AI UI history | IA improved; still residual dual components (`ai-side-panel`) |

### Recommended normalization order (consistency only)

1. **Boundary:** AI service = orchestration shell; domain ports only.  
2. **Retrieval:** Search Manager + Fabric only.  
3. **Case-first** context when caseId present + KG injection.  
4. **Artifacts** materialized + referenced.  
5. **Events** align with SSE/runtime states.  
6. **Workflow** owns multi-step after analysis.  
7. Delete/quarantine unused parallel adapters and UI stubs.

---

## Issue catalog (machine-readable index)

| ID | Area | Severity | Normalization priority |
|----|------|----------|------------------------|
| A1 | AI Runtime vs Nest megaservice | High | P0 |
| A2 | Case not primary unit of AI work | High | P0 |
| A3 | Workflow engine bypassed | Medium | P1 |
| A4 | BO DTOs bypassed | Medium | P1 |
| A5 | Search Manager bypassed | High | P0 |
| A6 | Connector Fabric incomplete for AI I/O | High | P0 |
| A7 | Knowledge Graph unused by operator | Medium | P1 |
| A8 | Event Fabric partial / dual progress | Medium | P1 |
| A9 | Artifact lifecycle incomplete | Medium | P1 |
| A10 | Streaming not full runtime projection | Low–Med | P2 |
| A11 | Data Fabric policy weak on mixed modes | Medium | P1 |
| A12 | Normalize pipeline fragmented | Medium | P1 |
| A13 | Duplication across search/plan/UI | High | P0 |
| A14 | Technical debt concentration | High | P0 |

---

## What is already aligned (do not “fix” away)

These match the vision and should be **preserved**:

- Two-phase AI (tools then synthesis).  
- Cohere-only generative policy; honest block without fixed essays.  
- Typed tool registry with permissions and loop modes.  
- `dataMode` / fixture honesty in envelopes and operator honesty.  
- OperatorRun durability and recommendation rows.  
- Right-rail as contextual entry (post UX normalization).  
- No silent multi-model failover.  
- CanonicalEnvelope direction in contracts.

---

## Closing judgment

The AI Operator is a **working application feature** sitting on top of **partial COS infrastructure**. Architectural inconsistency is not “missing AI features”; it is **wrong ownership**:

- AI Runtime does not fully own AI execution boundaries.  
- Commerce Case, Search, Fabric, KG, Workflow, and Artifacts are **implemented nearby** but **not on the critical path** of a typical operator run.

Normalization means **routing the existing path through existing owners**, not inventing new product surfaces.
