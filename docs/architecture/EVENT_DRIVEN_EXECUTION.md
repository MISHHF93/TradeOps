# Event-Driven Execution — Workflow Engine + Event Fabric

**Role:** Lead Enterprise Architect — workflow & event normalization  
**Status:** Target architecture (consistency; not feature expansion)  
**Goal:** Every **meaningful action** is a **workflow transition** that **emits a domain event**, so every AI interaction can be **replayed, audited, resumed, and traced** end-to-end.  
**Depends on:** `EVENT_FLOW.md`, `workflow-engine`, `EventFabricService`, `AI_RUNTIME_ARCHITECTURE.md`, `COMMERCE_CASE_AI_ORCHESTRATION.md`, `AI_OUTPUT_OWNERSHIP.md`, `RUNTIME_STATES` / `STANDARD_EVENT_TYPES` in contracts  
**Code anchors today:**  
`packages/workflow-engine` (`runner.ts` one-shot, `durable-run.ts` snapshot), `apps/api/src/automation/workflow.service.ts` (persists as OperatorRun), `apps/api/src/ai/ai-operator.service.ts` (partial events), `apps/api/src/events/event-fabric.service.ts`

---

## 1. Principle

```text
Meaningful action
  → Workflow step transition (durable, named, idempotent)
  → Domain event (Event Fabric, correlation + causation + provenance)
  → Optional BO write / Case sync / Artifact materialize
  → Consumers (UI projection, automation triggers, audit, replay)
```

| Object | Role |
|--------|------|
| **Commerce Case** | Process spine (stage) |
| **Workflow Run** | Durable multi-step **execution** of a template or AI-proposed plan |
| **AI Run** | AI Runtime execution record (producer of plans/artifacts/tools) |
| **Domain Event** | Immutable fact that a transition (or external fact) occurred |
| **Approval** | Gate step; resume token for workflow |

**Rules:**

1. AI Runtime **does not** own durable multi-step execution — it proposes and may **drive a step**, then Workflow records the transition.  
2. OperatorRun / AI Run **is not** a substitute Workflow Run (today it often is — **normalize**).  
3. SSE progress is a **projection** of workflow/runtime events — not the audit log.  
4. No silent side effects without an event.  
5. Resume always from **last durable step checkpoint**, never by re-guessing from briefing text.

---

## 2. Current AI execution process (as implemented)

```text
POST /ai/operator/run
  → entitlement
  → OperatorRun.create (status collecting)
  → AIObjectiveStarted  (if emitted)
  → runOperatorCycle (in-process):
       classify → tools (search/profit/policy/web) → rank → critic/auditor → Phase B
       onProgress SSE (ephemeral)
  → persist recommendations, opportunity upsert, optional approval, ProductEvaluated
  → commerceCases.syncOrganization (bulk)
  → harmonization / learning (best-effort)
  → AIObjectiveCompleted
  → HTTP/SSE final result
```

Parallel path:

```text
WorkflowService.runTemplate
  → createDurableRun + executeDurableRun (single shot, all steps mapped at once)
  → persist snapshot inside OperatorRun.planJson
  → event workflow.template_run (non-standard type)
```

These paths **do not share** step checkpoints, retry, or resume.

---

## 3. Gap analysis

### 3.1 Missing workflow transitions

| Gap | Today | Required |
|-----|-------|----------|
| AI cycle steps not workflow steps | Classify/tools/rank/Phase B only in memory + timeline JSON | Each meaningful step = `WorkflowStep` transition with status |
| No AI execution template | Operator is free-form cycle | Template `ai_objective_execution` (or case transform plan) with fixed step graph |
| Case stage ≠ workflow step | Case sync after run only | Domain events drive Case; workflow steps record *how* |
| Template runner completes in one call | `executeDurableRun` maps all steps immediately | Step-by-step advance with checkpoints |
| AI planJson ≠ workflow-engine | Two plan models | AI `workflow_plan` artifact → Workflow Run |
| Live examples / listing draft / PO | Ad-hoc service methods | Named workflow steps + events |
| Search / Fabric invokes | No workflow visibility | Steps `retrieve_evidence`, `invoke_capability` |

**Meaningful actions that must become transitions** (AI path):

| Step id | Meaning |
|---------|---------|
| `ai.run_accepted` | Entitled, run created |
| `ai.classify_objective` | Classification done |
| `ai.retrieve_evidence` | Search Manager completed |
| `ai.invoke_tools` | Tool batch / each consequential tool |
| `ai.normalize_candidates` | Candidates normalized |
| `ai.evaluate_economics` | Profit tools |
| `ai.assess_policy` | Policy tools / PolicyAssessment write |
| `ai.rank_opportunities` | Ranking + Opportunity upserts |
| `ai.critic_auditor` | Validation passes |
| `ai.synthesize_briefing` | Phase B |
| `ai.materialize_artifacts` | Artifacts persisted |
| `ai.sync_cases` | Case ensure/sync |
| `ai.await_approval` | Gate |
| `ai.completed` / `ai.failed` / `ai.blocked` | Terminal |

Commerce side effects remain separate transitions: `listing.prepare`, `approval.request`, `case.advance`, etc., **caused by** AI steps.

### 3.2 Missing events

| Gap | Today | Required |
|-----|-------|----------|
| Sparse AI events | Started/Completed + ProductEvaluated | Full step event catalog (§5) |
| No per-tool success events | Only ToolExecutionFailed sometimes | `ToolExecutionCompleted` + failed |
| No artifact events | None | `AiArtifactMaterialized` |
| No workflow step events | `workflow.template_run` only | `WorkflowRunStarted`, `WorkflowStepStarted/Completed/Failed`, `WorkflowRunAwaitingApproval`, `WorkflowRunResumed`, `WorkflowRunCompleted` |
| Case advanced inconsistently | Sync may not emit | Always `CommerceCaseAdvanced` on stage/status delta |
| Non-standard event names | `workflow.template_run`, Sync* | Prefer PascalCase standard catalog + versioned schema |
| Weak entity addressing | Often product without case | `entityType: commerce_case` when bound |
| Missing causation chain | correlationId partial | Every event: `correlationId` (run), `causationId` (parent event), `traceId` |

### 3.3 Missing audit history

| Gap | Today | Required |
|-----|-------|----------|
| Timeline only on run JSON | Not queryable event stream | Event Fabric is audit spine; run embeds event ids |
| Identity AuditService ≠ domain | Separate | Domain events for commerce; identity audit for auth |
| No immutable step log | Durable steps rewritten in one blob | Append-only step attempts + events |
| Prior knowledge from planJson | Weak | Replay from events + artifact store |

### 3.4 Missing retries

| Gap | Today | Required |
|-----|-------|----------|
| Tool failure often swallowed | catch → continue | Classify retryable vs terminal; record attempt |
| No retry policy on Fabric/Search | One-shot | Exponential backoff, max attempts, jitter; event per attempt |
| Phase B failure | Blocked briefing | Optional single repair (existing) + event; no infinite LLM retry |
| No dead-letter | — | Failed steps → `WorkflowStepDeadLettered` after max retries |

### 3.5 Missing resumable execution

| Gap | Today | Required |
|-----|-------|----------|
| Durable run executed fully in memory | Not paused mid-graph | Persist after each step; resume API |
| Approval does not resume workflow | Approval decides listing only | ApprovalDecided → workflow engine continues from `awaiting_approval` step |
| SSE disconnect loses progress | Client only | Server durable; client resubscribes by runId |
| Crash mid-cycle | Partial OperatorRun | Recover from last completed step checkpoint |

### 3.6 Missing approvals

| Gap | Today | Required |
|-----|-------|----------|
| Approval only for some publish paths | Inconsistent | Any `financial_contractual` / contract.approvalRequired step → workflow status `awaiting_approval` + `ApprovalRequested` |
| AI decision ≠ Approval BO | Confusable | Approval is human BO; AI decision is run-level only |
| No approval timeout / escalate event | — | Optional `ApprovalExpired` / escalate (policy later) |

### 3.7 Missing provenance

| Gap | Today | Required |
|-----|-------|----------|
| Provenance on envelope uneven | Partial honesty | Every domain event `_domain.dataMode` + source + evidenceIds |
| Tool outputs not linked to events | — | Event payload `toolTraceEntryId` / `artifactIds` |
| Mixed fixture/live unmarked on events | Sometimes | Required field |
| Replay cannot rebuild evidence | — | Events reference immutable artifact/content hashes |

---

## 4. Target event-driven execution model

### 4.1 Correlation model

```text
traceId          — one user/API request or automation trigger
correlationId    — Workflow Run id (preferred) or AI Run id if single-step
aiRunId          — AI Runtime execution
workflowRunId    — durable workflow
commerceCaseId   — case spine when applicable
causationId      — parent event id that caused this event
```

All four ids appear on AI Run, Workflow Run, and every related event payload `_domain`.

### 4.2 Lifecycle (case-bound AI objective)

```text
[Trigger]
  User / automation / workflow step "run_ai"
       │
       ▼
WorkflowRun created (template: ai_objective_execution | case_transform)
  event: WorkflowRunStarted
       │
       ▼
Step ai.run_accepted
  → AI Run created (child)
  event: AIObjectiveStarted, WorkflowStepCompleted
       │
       ▼
Step ai.classify_objective → event WorkflowStepCompleted + AiObjectiveClassified
       │
       ▼
Step ai.retrieve_evidence
  → Search Manager
  event: EvidenceRetrieved (hits count, dataMode, search plan id)
  on fail: retry policy → ToolExecutionFailed / StepFailed
       │
       ▼
Step ai.invoke_tools / evaluate / policy / rank
  → each BO write emits domain event (ProductEvaluated, etc.)
  → each tool: ToolExecutionCompleted | ToolExecutionFailed
       │
       ▼
Step ai.critic_auditor → AiValidationCompleted
       │
       ▼
Step ai.synthesize_briefing → AiBriefingSynthesized (or blocked)
       │
       ▼
Step ai.materialize_artifacts → AiArtifactMaterialized (per kind or batch)
       │
       ▼
Step ai.sync_cases → CommerceCaseAdvanced if delta
       │
       ├─ if approval required ──► status awaiting_approval
       │     ApprovalRequested + WorkflowRunAwaitingApproval
       │     [pause — durable checkpoint]
       │     ApprovalDecided → WorkflowRunResumed → continue
       │
       ▼
Terminal: WorkflowRunCompleted + AIObjectiveCompleted
  envelope projection for client
```

### 4.3 Dual record, single spine

| Concern | Store |
|---------|--------|
| Process stage | Commerce Case |
| Step machine + resume | **Workflow Run** (first-class table, not only planJson) |
| Model/tools/artifacts producer | AI Run |
| Immutable history | **Event Fabric** |
| Human gate | Approval (linked workflowStepId + caseId) |

Today’s use of OperatorRun as workflow dump is a **migration transitional** state only.

### 4.4 Workflow transition definition

```ts
type WorkflowTransition = {
  workflowRunId: string;
  stepId: string;
  fromStatus: StepStatus;
  toStatus: StepStatus;
  at: string;
  attempt: number;
  inputRef?: string;   // artifact or hash
  outputRef?: string;
  error?: { code: string; message: string; retryable: boolean };
};
```

Every transition **must** call Event Fabric before returning success to the caller (same transaction boundary when possible; else outbox pattern).

---

## 5. Expanded domain event catalog

### 5.1 Keep existing standard types

ProductDiscovered, ProductEvaluated, CommerceCaseAdvanced, ApprovalRequested, ApprovalDecided, ListingPrepared, ListingPublished, OrderReceived, PaymentVerified, SupplierOrderPrepared, ShipmentCreated, ShipmentUpdated, ReconciliationCompleted, PredictionEvaluated, ConnectorHealthChanged, AIObjectiveStarted, AIObjectiveCompleted, ToolExecutionFailed.

### 5.2 Add (AI + workflow completeness)

| Event | When |
|-------|------|
| `WorkflowRunStarted` | Durable run created/started |
| `WorkflowStepStarted` | Step begins (attempt N) |
| `WorkflowStepCompleted` | Step success checkpoint |
| `WorkflowStepFailed` | Step failed (may retry) |
| `WorkflowStepDeadLettered` | Retries exhausted |
| `WorkflowRunAwaitingApproval` | Paused on gate |
| `WorkflowRunResumed` | After approval or manual resume |
| `WorkflowRunCompleted` | Terminal success/partial policy |
| `WorkflowRunFailed` | Terminal failure |
| `WorkflowRunCancelled` | User/system cancel |
| `AiObjectiveClassified` | Classification result |
| `EvidenceRetrieved` | Search Manager response committed to evidence artifact |
| `ToolExecutionCompleted` | Tool success (consequential or sampled) |
| `AiValidationCompleted` | Critic/auditor decision |
| `AiBriefingSynthesized` | Phase B done/blocked |
| `AiArtifactMaterialized` | Artifact persisted |
| `CapabilityInvoked` | Fabric capability result (success/blocked) |
| `OpportunityUpserted` | Opportunity BO write (or fold into ProductEvaluated with schema) |

**Emission policy for high-volume tools:**  
- Always emit for writes, Fabric invokes, Search batches, failures.  
- Pure calc tools may batch into step completion event with tool count (document rule) — still checkpointed on workflow step.

### 5.3 Event envelope (required fields)

```text
eventType
tenantId (organizationId)
entityType, entityId          — prefer commerce_case when bound
correlationId                 — workflowRunId
causationId                   — parent event
traceId
schemaVersion
occurredAt
dataMode
source                        — ai_runtime | workflow_engine | fabric | search | domain
payload:
  aiRunId?, workflowRunId?, stepId?, attempt?
  caseId?, productId?
  artifactIds[]?
  provenance[]?
  inputHash?, outputHash?
```

---

## 6. Retry model

```text
attempt 1..N
  → WorkflowStepStarted (attempt)
  → execute
  → success → WorkflowStepCompleted (checkpoint)
  → retryable fail → WorkflowStepFailed + schedule backoff
  → non-retryable → WorkflowStepFailed → WorkflowRunFailed or compensate
  → N exhausted → WorkflowStepDeadLettered → run blocked/failed
```

| Class | Retryable? | Examples |
|-------|------------|----------|
| Transient IO | Yes | Search 429/5xx, Fabric timeout |
| Auth/config | No | Missing credentials, blocked capability |
| Validation | No | Schema fail after repair budget |
| Business rule | No | Policy blocked, approval required |
| LLM Phase B | Limited (0–1 repair) | Empty/invalid JSON |

Idempotency keys: `(workflowRunId, stepId, attempt)` and event `externalEventId` stable per attempt.

---

## 7. Resume model

### 7.1 Checkpoints

After each successful step:

- Persist Workflow Run step status + outputRef  
- Persist event  
- Optional AI Run status mirror  

### 7.2 Resume triggers

| Trigger | Action |
|---------|--------|
| `POST .../workflows/:id/resume` | Continue from first non-terminal step |
| `ApprovalDecided` (approved) | Resume step after `awaiting_approval` |
| `ApprovalDecided` (rejected) | Fail/compensate path; Case stays prepare |
| Worker pickup | Crashed `running` steps past lease → retry or fail |
| Client SSE reconnect | Read events + current step; no re-execution |

### 7.3 Replay vs resume

| Mode | Behavior |
|------|----------|
| **Resume** | Execute remaining steps; do not redo completed side effects (idempotent handlers) |
| **Replay (audit)** | Re-read events + artifacts; rebuild envelope/UI; **no** live Fabric side effects |
| **Reprocess** | Explicit admin: mark steps pending with new run or compensating transactions |

---

## 8. Approval integration

```text
Step requires approval
  → create Approval BO (caseId, listingId/poId, workflowRunId, stepId)
  → ApprovalRequested event
  → WorkflowRunAwaitingApproval
  → run.status = awaiting_approval
  → STOP scheduler

Human decides
  → ApprovalDecided event
  → if approved: WorkflowRunResumed → next step (e.g. publish_listing capability)
  → if rejected: WorkflowRunCompleted(partial) or Failed per policy
```

AI `decision: escalate|block` maps to **not** skipping Approval BO when consequential.

---

## 9. Provenance end-to-end

Every step stores:

1. **Input refs** — prior artifact ids, search response hash, BO versions  
2. **Output refs** — new artifact ids, BO ids written  
3. **dataMode** — aggregate of inputs  
4. **Provider/source** — search capability, fabric capability, cohere, internal  

Trace query:

```text
traceId → all events ordered
  → reconstruct step graph
  → load artifacts by id
  → show case stage at each CommerceCaseAdvanced
```

---

## 10. Mapping AI Runtime states → workflow + events

| RUNTIME_STATES | Workflow | Events (min) |
|----------------|----------|--------------|
| queued | run pending | WorkflowRunStarted |
| classifying | step classify | AiObjectiveClassified |
| retrieving | step retrieve | EvidenceRetrieved |
| calling_tools | step tools | ToolExecution* |
| normalizing | step normalize | WorkflowStepCompleted |
| validating | critic/auditor | AiValidationCompleted |
| awaiting_approval | paused | ApprovalRequested, WorkflowRunAwaitingApproval |
| executing | domain side effects | Listing*/Shipment*/… |
| reconciling | payment steps | PaymentVerified, … |
| completed | terminal | WorkflowRunCompleted, AIObjectiveCompleted |
| blocked/failed | terminal | WorkflowRunFailed/Blocked, AIObjectiveCompleted (status) |

SSE emits the same names as projections of these events.

---

## 11. Audit history (query model)

| Question | Answer source |
|----------|---------------|
| What happened on this case? | Events where caseId / entityId |
| Why did AI recommend X? | Artifacts + EvidenceRetrieved + ProductEvaluated chain |
| Can we resume? | Workflow Run step statuses |
| Who approved? | ApprovalDecided + identity audit |
| Was data fixture? | event.dataMode + provenance |
| Full request trace? | traceId stream |

Identity `AuditService` remains for login/RBAC; **commerce execution audit = Event Fabric**.

---

## 12. Templates: AI + commerce unification

| Template | Role |
|----------|------|
| `ai_objective_execution` | Generic AI objective (steps in §3.1) |
| `product_opportunity_discovery` | Existing; implement **real** step handlers + events (not one-shot fake complete) |
| `supplier_routing`, `margin_protection`, … | Same durable engine |
| Case transform plans | From commerce state engine transforms as steps |

AI-produced `workflow_plan` artifact **creates** a Workflow Run with those steps — does not execute them inside AI Runtime.

---

## 13. Outbox & reliability (host)

```text
Domain write + outbox row (same DB transaction)
  → publisher drains outbox → CommerceEvent
  → consumers ack
```

Prevents “BO written, event lost” and supports replay of delivery.

---

## 14. Normalization sequence

1. **First-class WorkflowRun persistence** (table or dedicated model); stop stuffing durable snapshots only in OperatorRun.planJson.  
2. **Step-wise executor** (replace one-shot `executeDurableRun` as sole path).  
3. **Standardize events** in contracts; map `workflow.template_run` → WorkflowRun* events.  
4. **AI host:** create Workflow Run for every operator objective; drive steps; emit step events.  
5. **Tool/Fabric/Search:** emit Tool/Evidence/Capability events; retries.  
6. **Approval resume** hook from ApprovalService → WorkflowService.resume.  
7. **CaseAdvanced** on every real stage delta.  
8. **Trace API:** GET events by traceId / workflowRunId / caseId.  
9. **Replay read API** for audit UI (no side effects).  
10. **SSE** subscribed to event stream or step projections for runId.

---

## 15. Gap checklist (acceptance)

| Capability | Status target |
|------------|---------------|
| Workflow transition per meaningful action | Yes |
| Domain event per transition | Yes |
| Audit history (queryable) | Event Fabric |
| Retries with attempts | Yes |
| Resumable after crash/approval | Yes |
| Approvals as pause/resume | Yes |
| Provenance on events + artifacts | Yes |
| End-to-end traceId | Yes |
| Replay without re-side-effects | Yes |

---

## 16. Closing judgment

Today TradeOps has **pieces** of an event-driven OS (Event Fabric, durable run *types*, AI started/completed) but AI execution is still largely an **in-process script** with a **parallel, one-shot workflow runner**.

Normalization means:

1. **Workflow Engine** owns durable step transitions and resume.  
2. **Event Fabric** owns immutable history and trace.  
3. **AI Runtime** owns intelligence inside steps.  
4. **Case** owns process stage.  
5. **Approvals** pause and resume workflows.  
6. **Retries + provenance** make execution production-grade and auditable.

Every AI interaction becomes a **traced, event-sourced execution graph** — not a single blob on OperatorRun.
