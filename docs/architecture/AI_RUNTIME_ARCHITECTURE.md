# AI Runtime Architecture

**Role:** Lead Enterprise Architect — redesigned execution ownership  
**Status:** Target architecture (normalization of ownership; not feature expansion)  
**Supersedes (for AI execution):** ad-hoc orchestration inside `AiOperatorService`  
**Aligns with:** `END_TO_END_RUNTIME.md`, `AI_EXECUTION_FLOW.md`, `DOMAIN_OBJECT_OWNERSHIP.md`, `AI_OPERATOR_ARCHITECTURE_DIVERGENCE.md` (A1–A14)  
**Package:** `@tradeops/ai-runtime`

---

## 1. Purpose

The **AI Runtime** is the **single execution engine** for every AI interaction in TradeOps, regardless of:

- persona (operator, researcher, executive, developer, administrator)
- surface (context rail, case workspace, command bar, automation, live examples)
- objective class (research, draft, publish proposal, payment explain, ops diagnose)

It owns **how** AI work is planned, evidenced, validated, synthesized, streamed, and packaged.

It does **not** own commerce domain state, connector I/O, search indexes, durable workflow runs, or tenant auth. Those remain COS owners, reached only through **typed ports**.

---

## 2. Design principles

| Principle | Meaning |
|-----------|---------|
| **One engine** | No second orchestration path in Nest services, Next clients, or workflow adapters. |
| **Registries first** | Prompts, tools, schemas, and artifact kinds are versioned source-controlled catalogs — not ad-hoc strings. |
| **Two-phase always** | Phase A = deterministic tools + evidence; Phase B = generative synthesis under contract. |
| **Honest failure** | Missing provider, empty store, or blocked capability → empty/blocked text + warnings; never substitute narrative. |
| **Ports at the edge** | Runtime never imports Prisma, Nest, or HTTP clients for domain I/O. Hosts inject ports. |
| **Envelope out** | Every completed run yields a `CanonicalEnvelope` (+ typed artifacts). |
| **Streaming is projection** | Progress events are the runtime state machine projected outward; transport (SSE) is host-only. |
| **Persona is profile, not fork** | Personas select prompts, tool allow-lists, and risk defaults — they do not fork engines. |

---

## 3. Current vs target (ownership)

| Concern | Current (divergence) | Target |
|---------|----------------------|--------|
| Orchestration | Split: `runOperatorCycle` + ~2.2k-line `AiOperatorService` | **Runtime only** (`AiExecutionEngine`) |
| Product load / ranking input | Host preloads Prisma products into cycle | **Tools + ports** supply candidates; engine does not require preloaded arrays |
| Envelope / honesty assembly | Mostly host | **Runtime Response Contracts** |
| Execution package | Partial in runtime, completed in host | **Runtime Artifact materializer** |
| Streaming states | Host-buffered ad-hoc names | **Runtime Stream Projector** (`RUNTIME_STATES`) |
| Phase B validation/repair | Scattered (adapter + cycle) | **Runtime Validation + Repair** |
| Evidence / provenance | Implicit in rec cards | **Runtime Evidence + Provenance packages** |
| Nest AI module | Megaservice | **Thin AI Host Adapter** |

---

## 4. System placement

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Personas / UI / Automation / Workflow hooks                             │
│  (rail, case page, command bar, live examples, durable handoff)         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP / internal call
┌───────────────────────────────▼─────────────────────────────────────────┐
│  AI HOST ADAPTER  (apps/api — thin)                                      │
│  Auth · tenant · entitlements · transport (SSE/HTTP) · port wiring       │
│  Persist run rows · emit Event Fabric · call domain services via ports   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ AiRunRequest + AiHostPorts
┌───────────────────────────────▼─────────────────────────────────────────┐
│  AI RUNTIME  (@tradeops/ai-runtime)  ← SINGLE EXECUTION ENGINE          │
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ Prompt Reg.  │ │ Tool Reg.    │ │ Schema Reg.  │ │ Artifact Reg.  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Agent Orchestrator (classify → plan → Phase A → critic/auditor     │ │
│  │                   → validate/repair → Phase B → materialize)       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────────┐ │
│  │ Evidence   │ │ Provenance │ │ Validation │ │ Repair               │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────────┐ │
│  │ Streaming  │ │ Response   │ │ Provider   │ │ Artifact             │ │
│  │ Projector  │ │ Contracts  │ │ Abstraction│ │ Materializer         │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ port calls only
┌───────────────────────────────▼─────────────────────────────────────────┐
│  COS OWNERS (not AI Runtime)                                             │
│  Search Manager · Connector Fabric · Commerce Case · Business Objects    │
│  Knowledge Graph · Workflow Engine · Event Fabric · Prisma / Data Fabric │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component catalog and responsibilities

### 5.1 Prompt Registry

**Owns**

- Versioned prompt templates (`id`, `version`, `variables`, `body`)
- Persona system prompts, case-context frames, research/draft/consequential framings
- Phase B system and user prompt composition **via templates only**

**Does not own**

- Runtime case data (loaded by host/ports, then injected as variables)
- Model selection policy beyond documenting which template feeds which phase

**Public API (conceptual)**

- `registerPrompt` / `getPrompt` / `listPrompts` / `renderPrompt`
- `composePhaseBMessages(profile, evidenceBrief, vars) → messages`

**Relocates from Operator**

- Inline objective string concatenation for case/workspace preambles → **render templates in runtime** after host supplies variable values

---

### 5.2 Tool Registry

**Owns**

- Tool definitions (name, schema, permissions, risk class, loop-mode allow list, timeout, idempotency)
- Invocation policy enforcement (permission, loop mode, prohibited)
- Trace production (`ToolTraceEntry`) for every invoke
- Tool catalog export for UI / diagnostics

**Does not own**

- Domain implementation of side effects (those live in **port-backed handlers** registered at bootstrap)
- Prisma, billing, listing, or connector HTTP

**Public API**

- `registerTool` / `invokeTool` / `listTools` / `listToolsPublic`
- Bootstrap: `registerBuiltinTools(ports)` binds pure tool contracts to host ports

**Relocates from Operator**

- Permission and loop-mode checks that today sit only around `runObjective` → **always inside invoke path**
- Tool allow-list filtering by persona → **orchestrator policy**, registry remains source of truth

---

### 5.3 Schema Registry

**Owns**

- Versioned structured output schemas (`operator_briefing`, `execution_package`, `search_response`, artifact payloads)
- Schema lookup by `schemaId` for Phase B and artifact validation

**Does not own**

- Prisma models
- UI form schemas unrelated to AI contracts

**Public API**

- `registerSchema` / `getSchema` / `listSchemas`

---

### 5.4 Artifact Registry

**Owns**

- Artifact **kinds** and default approval posture (`execution_package`, `recommendation_card`, `search_evidence`, `workflow_plan`, …)
- Kind ↔ schemaId binding

**Does not own**

- Durable blob storage (host ArtifactStore port)
- Approval decision lifecycle (Approval domain)

**Companion: Artifact Materializer (runtime)**

- On run completion, builds **in-memory artifact instances** (kind, schemaId, version, payload hash, provenance refs)
- Host persists via `ArtifactStorePort` if configured

**Relocates from Operator**

- Ad-hoc packing of `planJson`, recommendation rows, navigator snapshot assembly that encodes AI shape rather than domain writes

---

### 5.5 Validation

**Owns**

- Schema validation of Phase B model output against Schema Registry
- Structural validation of recommendation drafts and execution packages
- Critic + auditor **as validation layers** (faulty assumptions, calc integrity, policy, permissions)
- Decision gates: `accept | revise | downgrade | block | escalate`

**Does not own**

- Business policy content beyond calling registered policy tools/ports
- Entitlement SaaS checks (host, pre-run)

**Public API**

- `validateAgainstSchema(schemaId, payload)`
- `runCriticPass` / `runAuditorPass` / `decideFromPasses`
- `validateRunArtifacts(artifacts[])`

**Relocates from Operator**

- Any post-cycle shaping that re-interprets model JSON without registry schemas

---

### 5.6 Repair

**Owns**

- Bounded repair of model output when validation fails (e.g. extract JSON object, coerce known fields, drop unknown keys **within schema**)
- Single repair budget (count + token ceiling) — no infinite loops
- Honest demotion: if repair fails → `briefingSource: blocked|tools_structured` and empty generative text

**Does not own**

- Re-running commerce side effects
- Silent swap to another generative provider

**Public API**

- `repairStructuredOutput({ schemaId, rawText, maxAttempts }) → { ok, payload, notes }`

**Relocates from Operator / adapters**

- Ad-hoc JSON scrape and partial parse currently buried in Cohere/cycle glue → **central Repair module** used by all providers

---

### 5.7 Response Contracts

**Owns**

- Mapping engine results → `CanonicalEnvelope` (`meta`, `text`, `data`, `evidence`, `actions`, `blocked`)
- `dataMode` aggregation policy (strictest / mixed warnings)
- Confidence and warnings aggregation
- Alignment of `meta.state` with `RUNTIME_STATES`
- Stable `data` payload shape for UI (recommendations, plan summary, honesty, artifact refs)

**Does not own**

- HTTP status codes
- Cookie/session serialization

**Public API**

- `toCanonicalEnvelope(runResult, ids, tenantId) → CanonicalEnvelope`
- `toOperatorViewModel(runResult)` (optional facade for existing UI fields — built **from** envelope data, not a second source of truth)

**Relocates from Operator**

- Envelope wrap, honesty blocks, dataMode derivation currently assembled in Nest after cycle

---

### 5.8 Agent Orchestration

**Owns**

- End-to-end run lifecycle for **any** agent profile:

  1. `queued` → accept `AiRunRequest`
  2. `classifying` → objective classification + risk class
  3. `retrieving` / `calling_tools` → Phase A tool plan + invoke
  4. `normalizing` → candidate/evidence normalization **of AI-facing DTOs only**
  5. Critic + auditor
  6. `validating` → schema/artifact validation
  7. `synthesizing` (maps to retrieving/calling or intermediate; final states stay in `RUNTIME_STATES`) Phase B via Provider Abstraction
  8. Repair if needed
  9. Artifact materialization
  10. `completed` | `partial` | `blocked` | `failed` | `awaiting_approval`

- Plan construction (`OperatorPlan` generalized to `AiPlan`)
- Loop-mode resolution inputs (host supplies flags; runtime applies pure policy)
- Tool sequence execution with timeline
- Recommendation draft assembly for commerce-evaluation profiles
- Entry point: **`runAiCycle` / `AiExecutionEngine.run`** (replaces host-owned orchestration)

**Does not own**

- Loading products from Prisma
- Creating listings, POs, payments, cases (tools call ports)
- Workflow durable execution after analysis (hands off proposal artifact)

**Public API**

```ts
// conceptual
type AiRunRequest = {
  requestId: string;
  traceId: string;
  tenantId: string;           // organizationId
  userId?: string | null;
  objective: string;
  profile: AgentProfileId;    // e.g. 'operator.commerce', 'researcher.scan', 'executive.brief'
  loopMode: OperationLoopMode;
  permissions: string[];
  allowedTools?: string[];    // persona allow-list
  context?: AiRunContext;     // caseId, productId, workflowCorrelationId, vars
  synthesizeWithLlm?: boolean;
};

type AiRunResult = {
  classification: ObjectiveClassification;
  plan: AiPlan;
  toolTrace: ToolTraceEntry[];
  recommendations: RecommendationDraft[];
  critic: CriticResult;
  auditor: AuditorResult;
  decision: OperatorDecision;
  timeline: TimelineStep[];
  evidencePackage: EvidencePackage;
  provenance: ProvenanceRecord[];
  artifacts: AiArtifactInstance[];
  responseSummary: string;
  briefingSource: 'cohere' | 'blocked' | 'empty_store' | 'no_qualifiers' | 'tools_structured';
  envelope: CanonicalEnvelope;
  // ... candidateStats, filtersApplied, sources
};

AiExecutionEngine.run(request, ports, { onProgress }): Promise<AiRunResult>
```

**Relocates from Operator**

- Entire `runObjective` body after entitlement/auth: loop mode application, objective framing composition, product preload-as-input, cycle call, progress buffer, post-cycle interpretation of results for AI shape
- Live-example “special path” orchestration that reimplements ranking → becomes **profile + objective + tools**, not parallel engines

---

### 5.9 Evidence

**Owns**

- `EvidencePackage`: structured collection of claims, tool facts, search hits, graph snippets, connector capability snapshots
- Phase B **evidence brief** construction (machine-readable facts only — no invented prose)
- Attachment of evidence IDs to recommendation cards and execution packages
- `search_evidence` artifact payload shape

**Does not own**

- Search Manager ranking algorithms
- KG storage
- Web provider HTTP (port or tool dep)

**Public API**

- `buildEvidencePackage({ toolTrace, recommendations, contextHits, graphProjection })`
- `toPhaseBEvidenceBrief(package) → string | structured`

**Relocates from Operator**

- Ad-hoc `toolFactsLines` / briefing fact blobs built only inside operator-cycle → **Evidence module** shared by all profiles

---

### 5.10 Streaming

**Owns**

- Canonical progress event model aligned 1:1 with `RUNTIME_STATES` (+ optional `step`, `detail`, `at`, `artifactKind`)
- Emission hooks from orchestrator milestones
- Mapping: internal micro-steps → public runtime states (e.g. ranking → `calling_tools` or `normalizing` as documented)

**Does not own**

- SSE/WebSocket framing (host transport adapter)
- Client fake timers

**Public API**

```ts
type AiStreamEvent = {
  state: RuntimeExecutionState;
  step: string;
  detail?: string;
  at: string;
  requestId: string;
  runId?: string;
};

// onProgress?: (event: AiStreamEvent) => void | Promise<void>
```

**Relocates from Operator**

- Progress buffer and state naming currently defined ad-hoc in Nest + partial in cycle
- Guarantee: UI never invents stages the runtime did not emit

---

### 5.11 Provenance

**Owns**

- `ProvenanceRecord` aggregation from tool outputs, search hits, fixtures, web research, KG nodes
- Per-item `dataMode`, `source`, `providerKey`, `collectedAt`, `confidence`, optional `url`/`evidenceId`
- Envelope `evidence[]` population
- Honesty notes when mixed modes appear

**Does not own**

- Connector probe persistence
- Event Fabric log

**Public API**

- `collectProvenance(toolTrace, evidencePackage) → ProvenanceRecord[]`
- `aggregateDataMode(records) → { dataMode, warnings[] }`

**Relocates from Operator**

- Scattered fixture flags on product cards → first-class provenance rows built once in runtime

---

### 5.12 AI Artifacts (lifecycle in-runtime)

**Owns**

- Instantiation of artifacts after validation (payload, kind, version, hash, parent run correlation)
- Lifecycle **states in memory**: `draft → validated → (awaiting_approval) → ready | superseded | rejected`
- Cross-links: recommendation_card → search_evidence ids; execution_package → cards

**Does not own**

- Database tables (host port)
- Human approval UI
- Publishing artifacts as marketplace listings

**Public API**

- `materializeArtifacts(run partial) → AiArtifactInstance[]`
- `assertArtifactReady(instance)` before consequential tool proposals

**Relocates from Operator**

- Navigator package construction and recommendation packing that is AI-shaped rather than domain CRUD

---

### 5.13 Supporting runtime modules (keep / refine)

| Module | Responsibility |
|--------|----------------|
| **Provider Abstraction** | Sole generative path policy (Cohere); embed/rerank; offline/blocked adapters; no silent failover |
| **Cohere Adapter** | Transport to Cohere Chat/Embed/Rerank only |
| **Critic / Auditor** | Subsystem of Validation |
| **Builtin Tools** | Tool **contracts** + port calls; no Prisma |
| **Execution Navigator builders** | Map `AiRunResult` → `execution_package` artifact payload |
| **Live Examples catalog** | Metadata for demos; execution still goes through `AiExecutionEngine` |
| **Web search provider** | Thin provider config for tools; ideally invoked via Search/Fabric port long-term |

**Quarantine**

- `xai-adapter` — not on generative critical path; do not surface as active stack without policy change

---

## 6. Host ports (domain boundary)

Runtime depends on **interfaces**, not Nest services. Host adapter implements and injects:

| Port | Responsibility | COS owner behind port |
|------|----------------|------------------------|
| `SearchPort` | Unified evidence retrieval by **capability** only (never providers) | Search Manager — see `SEARCH_MANAGER_ARCHITECTURE.md` |
| `FabricPort` | List **business** capabilities + `invoke(capability, canonical input)` only — never vendor APIs | Connector Fabric — see `CONNECTOR_FABRIC_ARCHITECTURE.md` |
| `CasePort` | Case AI context, stage-safe reads | Commerce Case |
| `BusinessObjectPort` | Canonical product/case/listing summaries by id | commerce-engine / BO |
| `KnowledgeGraphPort` | Projection for case/product neighborhood | KG module |
| `WorkflowPort` | Optional handoff of `workflow_plan` artifact | Workflow Engine |
| `EventPort` | Publish AI lifecycle / tool failure events | Event Fabric |
| `ArtifactStorePort` | Persist/load artifact instances | API persistence |
| `RunStorePort` | Persist OperatorRun / generic AiRun rows | API persistence |
| `EntitlementPort` | Pre-check AI evaluation allowed | SaaS (called **before** engine or as first host step) |
| `WorkspacePort` | Persona allow-list + context preamble vars | Workspace |

**Rule:** If a tool needs domain data, it calls a port. Runtime orchestration never `prisma.*`.

---

## 7. What the AI Operator becomes

“AI Operator” is a **product surface + agent profile**, not a second engine.

### 7.1 Nest module responsibilities (only)

| Keep in host | Remove from host (move to runtime) |
|--------------|-------------------------------------|
| HTTP controllers / routes | Phase A/B orchestration |
| AuthGuard, org scope | Objective classification / plan build |
| Entitlement assert | Critic/auditor sequencing |
| Wire ports from Nest services | Evidence brief / tool facts |
| SSE write of runtime stream events | Envelope construction |
| Persist runs/recommendations via ports | Schema validation / repair |
| Domain side-effect services used by port impls | Ranking / recommendation draft assembly |
| Bootstrap: `registerBuiltinTools(ports)`, provider env | Progress state machine |
| Map URL params → `AiRunRequest` | Artifact kind materialization |

### 7.2 Suggested host shape

```text
apps/api/src/ai/
  ai.module.ts              — DI wiring
  ai.controller.ts          — HTTP + SSE transport
  ai-host.adapter.ts        — thin: authz → ports → engine.run → persist → events
  ports/                    — Nest implementations of SearchPort, CasePort, …
```

`AiOperatorService` **ceases to be an orchestrator**. Its logic is either:

- deleted in favor of `AiExecutionEngine`, or
- reduced to port adapters + persistence helpers renamed to `AiHostAdapter`.

### 7.3 Live examples

Examples supply a fixed objective + profile + optional seed context. They **call the same engine**. No private ranking/publish pipelines inside the service except as **domain port** operations already available to tools.

---

## 8. Agent profiles (persona reuse)

| Profile id | Persona primary | Default risk | Typical tools |
|------------|-----------------|--------------|---------------|
| `operator.commerce` | operator | research read-only; draft/publish gated | search, profit, policy, draftListing, capabilities |
| `researcher.scan` | researcher | read_only | search, web research, profit, policy |
| `executive.brief` | executive | read_only; escalate | search summary, billing status (read), approvals list |
| `developer.diagnose` | developer | read_only | capabilities, connector health, wiring |
| `automation.worker` | system | constrained by template | tools allowed by workflow template |

Profiles define:

- prompt ids
- default tool allow-list
- default filters / objective classification hints
- whether Phase B is required
- artifact kinds to materialize

**One engine; many profiles.**

---

## 9. Workflow reuse

| Stage | Owner |
|-------|--------|
| AI proposes multi-step plan | AI Runtime → `workflow_plan` artifact |
| Durable execution / resume | Workflow Engine |
| Correlation | `operatorRunId` / `aiRunId` ↔ `workflowRunId` via host |
| AI step inside a workflow | Workflow invokes `AiExecutionEngine.run` with profile `automation.worker` |

AI Runtime never becomes a durable job scheduler.

---

## 10. State machine (streaming + envelope)

Authoritative list remains contracts `RUNTIME_STATES`:

```text
idle → queued → classifying → retrieving → calling_tools → normalizing
  → validating → awaiting_approval → executing → reconciling
  → completed | partial | blocked | failed
```

**Runtime ownership:** emit only these states (plus step/detail).  
**Host ownership:** translate to SSE `event: state` / `event: result` without renaming.

Micro-steps (e.g. “ranking”, “synthesizing”) are `step` strings under a parent `RUNTIME_STATES` value, not a parallel enum.

---

## 11. Target package layout

```text
packages/ai-runtime/src/
  index.ts                      # public surface
  types.ts                      # shared run/tool types
  engine/
    ai-execution-engine.ts      # Agent Orchestration entry
    classify.ts                 # from operator-cycle classify
    plan.ts
    phase-a.ts
    phase-b.ts
    loop-mode.ts
  registries/
    prompt-registry.ts
    tool-registry.ts
    schema-registry.ts
    artifact-registry.ts
  validation/
    critic-auditor.ts
    schema-validate.ts
    decide.ts
  repair/
    structured-repair.ts
  evidence/
    evidence-package.ts
    phase-b-brief.ts
  provenance/
    collect-provenance.ts
    data-mode.ts
  streaming/
    progress.ts                 # AiStreamEvent + helpers
  contracts/
    envelope.ts                 # Response Contracts → CanonicalEnvelope
    view-models.ts              # optional UI facades
  artifacts/
    materialize.ts
    execution-navigator.ts      # package builder
  providers/
    provider-abstraction.ts
    cohere-adapter.ts
    web-search-provider.ts      # until SearchPort fully owns public_web
  tools/
    builtin-tools.ts
    register-builtins.ts
  profiles/
    catalog.ts                  # agent profiles
  ports/
    types.ts                    # SearchPort, FabricPort, … interfaces only
  examples/
    live-examples.ts            # catalog only
```

Existing files migrate into this layout; behavior preserved unless ownership demands a pure move.

---

## 12. Explicit non-ownership (guardrails)

AI Runtime **must not**:

| Forbidden | Owner |
|-----------|--------|
| `prisma.*` product/listing/order queries | Domain services via ports |
| Connector HTTP / OAuth | Connector Fabric |
| Case stage machine transitions | Commerce Case service |
| Durable workflow step execution | Workflow Engine |
| Auth sessions / cookies | API auth |
| SaaS plan mutation | Billing |
| Invent products from SERP | Evidence honesty rules |
| Multi-provider generative failover | Provider policy |
| New product features under “runtime” guise | Out of scope for this redesign |

---

## 13. Relocation map (Operator → Runtime)

| Logic today | Location today | Target |
|-------------|----------------|--------|
| `classifyObjective` / filters / `buildPlan` | `operator-cycle` | Engine (keep in runtime; expand profiles) |
| `runOperatorCycle` | `operator-cycle` | `AiExecutionEngine` |
| Tool invoke + risk | `tool-registry` | unchanged owner |
| Critic / auditor | `critic-auditor` | Validation |
| Phase B generate + parse | cycle + cohere | Phase B + Repair + Validation |
| Tool facts / briefing policy | `operator-cycle` | Evidence + Response Contracts |
| Progress events | cycle + Nest | Streaming module |
| Envelope wrap / honesty | Nest service | Response Contracts |
| Navigator / execution package | Nest + execution-navigator | Artifact materializer |
| Product preload `loadOperatorProducts` | Nest | **Delete from orchestration input**; Search/BO ports via tools |
| Case/workspace preamble string merge | Nest | Host supplies vars → Prompt Registry render in engine |
| `deps` bag Prisma closures | Nest | Typed ports; tools depend on ports |
| Recommendation persistence | Nest | Host `RunStorePort` after engine returns |
| Opportunity upsert / learning | Nest | Domain side-effect after run (host), not engine |
| Listing draft / approval queue | Nest methods | Tool → commerce ports only |
| Live example multi-page scripts | Nest private methods | Profile + tools + domain ports; no parallel engine |
| SSE endpoint | Nest controller | stays; consumes runtime stream |
| Provider bootstrap | Nest `onModuleInit` | Host bootstrap only (env → provider) |

---

## 14. Request lifecycle (target)

```text
1. UI / automation → POST /ai/operator/run | /ai/run | internal Workflow call
2. Host: AuthGuard + tenant + EntitlementPort
3. Host: build AiRunRequest (profile, objective, context ids, permissions)
4. Host: construct ports from Nest services
5. Host: RunStorePort.create(queued) → runId
6. Host: EventPort AIObjectiveStarted
7. Runtime: AiExecutionEngine.run(request, ports, onProgress)
     7a. classify + plan
     7b. Phase A tools (Search/Fabric/BO/KG via ports)
     7c. evidence + provenance
     7d. critic + auditor + decision
     7e. Phase B provider (optional)
     7f. validate + repair
     7g. materialize artifacts
     7h. toCanonicalEnvelope
8. Host: persist recommendations + artifacts + run status
9. Host: EventPort AIObjectiveCompleted
10. Host: optional WorkflowPort.handoff(workflow_plan)
11. Host: HTTP body = envelope (and/or legacy view model derived from envelope)
12. SSE: same runId stream of AiStreamEvent then final result
```

---

## 15. Alignment with divergence audit

| ID | How this architecture normalizes |
|----|----------------------------------|
| A1 | Engine is sole AI execution owner; host is adapter |
| A2 | Case context via CasePort + profile; not product-array primary |
| A3 | `workflow_plan` artifact + WorkflowPort handoff |
| A4 | BusinessObjectPort; tools return BO summaries |
| A5 | SearchPort mandatory for retrieval tools |
| A6 | FabricPort for capability and external I/O tools |
| A7 | KnowledgeGraphPort injects into Evidence |
| A8 | EventPort from host; stream states match fabric-aligned RUNTIME_STATES |
| A9 | Artifact Registry + Materializer + ArtifactStorePort |
| A10 | Streaming module owns progress contract |
| A11 | Provenance + dataMode aggregation in runtime |
| A12 | Normalize AI-facing DTOs in engine; domain normalize stays fabric/commerce |
| A13 | Single engine eliminates parallel search/plan/progress owners on AI path |
| A14 | Megaservice dissolved by relocation map |

---

## 16. What is preserved (do not redesign away)

- Two-phase AI (tools then synthesis)
- Cohere-only generative policy; honest empty text when blocked
- Typed tools with permissions and loop modes
- `dataMode` honesty
- OperatorRun durability at host persistence layer
- CanonicalEnvelope direction in `@tradeops/contracts`
- No silent multi-model failover
- Right-rail / persona entry as **clients** of the same engine

---

## 17. Normalization sequence (implementation order)

Consistency-only migration; no new product features:

1. **Extract ports interfaces** in `ai-runtime` + Nest adapters (Search still may wrap existing Prisma temporarily behind port).
2. **Move envelope, provenance, evidence brief, stream states** into runtime modules; Nest calls them.
3. **Replace `runOperatorCycle(products[])`** with engine request that retrieves via tools/ports (stop host product preload as primary input).
4. **Collapse `AiOperatorService` orchestration** into `AiHostAdapter`.
5. **Materialize artifacts** on every successful run; persist via port.
6. **Wire SearchPort / FabricPort** for retrieval tools (retire direct Prisma in tool deps).
7. **Profiles catalog** for persona reuse; live examples as profiled runs.
8. **WorkflowPort handoff** for multi-step plans; keep planJson only as artifact mirror during transition.
9. Quarantine xAI adapter from public runtime index / diagnostics “active stack”.

---

## 18. Closing judgment

The AI Runtime becomes the **Commerce OS AI execution kernel**:

- **Registries** define what can be said, called, validated, and produced.
- **Orchestration** runs every interaction the same way.
- **Evidence, provenance, validation, repair, streaming, artifacts, and response contracts** are kernel services — not Nest leftovers.
- **Hosts and personas** are adapters and profiles.
- **COS owners** remain authoritative for commerce truth; runtime only reasons and packages.

This is architectural consistency with the audit — **one engine, clear owners, no parallel AI stacks**.
