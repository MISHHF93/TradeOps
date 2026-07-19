# AI Architecture — Production Readiness Review

**Role:** Lead Enterprise Architect  
**Date context:** 2026-07-19  
**Scope:** Production readiness of the **existing** AI stack — not feature expansion  
**Evidence base:** `packages/ai-runtime`, `apps/api/src/ai`, health, events, workflow-engine, prior architecture docs (divergence A1–A14, runtime, case, search, fabric, events, UX)  
**Constraint:** Roadmap prioritizes **shipping safely**, not new product surfaces

---

## 1. Executive judgment

| Dimension | Verdict |
|-----------|---------|
| **Can Phase B run live with Cohere?** | **Yes** — Chat V2 + `json_object`, Cohere-only policy, honest block without fixed essay when key missing/fail |
| **Is the AI path production-complete as a COS kernel?** | **No** — working vertical slice; ownership, durability, search/fabric path, and ops hardening incomplete |
| **Ship gate** | **Conditional** — developer/founder and controlled tenants possible with env + fixture honesty; **not** multi-tenant production commerce without Critical/High remediation |

**Bottom line:** Generative path and anti-demo narrative policy are relatively mature. **Execution OS** (workflow durability, event audit, Search Manager/Fabric exclusivity, case-first, multi-tenant hardening of public AI diagnostics, schema enforcement depth) is the readiness gap.

---

## 2. Verification by criterion

### 2.1 Live Cohere execution

| Check | Status | Evidence |
|-------|--------|----------|
| Cohere sole generative provider | **Pass** | `provider-abstraction` ignores xAI for generation; `isCohereSoleActivePolicy()` |
| Chat V2 + structured JSON | **Pass** | `cohere-adapter` `response_format: json_object` + schema |
| Env key loading | **Pass** | `COHERE_API_KEY` / `CO_API_KEY`, `effectiveCohereEnv` |
| Honest failure (no demo model swap) | **Pass** | Empty text + `briefingSource: blocked` |
| Deep health probe | **Pass** | `GET /ai/health?deep=true`, `probeCohereDeepHealth` |
| Token budget for thinking models | **Pass** | Phase B `maxTokens: 2500` |
| Production key/ops SLOs | **Gap** | No rate-limit budget, circuit breaker, or multi-region; health not on main `/health` |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-C1 | **Medium** | Cohere health not part of aggregate API health/readiness gates |
| PR-C2 | **Medium** | No production circuit breaker / backoff on 429 beyond single-call fail |
| PR-C3 | **Low** | xAI adapter still in package surface (policy ignores; confuses ops) |

---

### 2.2 Removal of fixture responses (fake generative narratives)

| Check | Status | Evidence |
|-------|--------|----------|
| No fixed multi-line product essay on Cohere fail | **Pass** | operator-cycle blocked path |
| Empty store / no qualifiers short status | **Pass** | explicit `empty_store` / `no_qualifiers` |
| Fixture **catalog data** still used | **By design** | Products with `fixture*` sources; honesty flags |
| UI could still misread fixture as live | **Gap** | Mixed Tavily live + fixture catalog; dataMode policy incomplete |
| Live examples force shadow by default | **Pass** | controller `forceShadow !== false` for examples |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-F1 | **High** | Mixed fixture catalog + live web without first-class envelope `mixed` / strict UI banner enforcement everywhere |
| PR-F2 | **Medium** | Operator still product-preloads fixture rows as primary path — easy to over-trust in demos as “production AI” |
| PR-F3 | **Low** | Residual copy in older UI components if console still referenced |

---

### 2.3 Streaming integrity

| Check | Status | Evidence |
|-------|--------|----------|
| SSE endpoint | **Pass** | `POST /ai/operator/run/stream` |
| Real progress from backend | **Pass** | `onProgress` from cycle (not client fake timers) |
| Auth on stream | **Pass** | `RequirePermissions('ai:write','products:read')` |
| Align with RUNTIME_STATES | **Partial** | Cycle states include `evaluating`/`ranking`/`synthesizing` not in contracts list |
| Token streaming | **N/A / absent** | Request/response Phase B only |
| Disconnect / resume | **Fail** | No durable stream resume; run continues server-side without client recovery contract |
| Heartbeats / proxy timeouts | **Gap** | No documented SSE heartbeat |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-S1 | **High** | Stream state enum ≠ `RUNTIME_STATES` — client/server drift risk |
| PR-S2 | **Medium** | No SSE heartbeat / reconnect protocol for long runs |
| PR-S3 | **Medium** | Stream not projection of Event Fabric (dual progress plane) |
| PR-S4 | **Low** | No token deltas (acceptable if documented) |

---

### 2.4 Runtime validation

| Check | Status | Evidence |
|-------|--------|----------|
| Critic + auditor | **Pass** | After recommendations |
| Decision accept/block/escalate | **Pass** | `decideFromPasses` |
| Tool permission / loop mode | **Pass** | `invokeTool` |
| Entitlement pre-run | **Pass** | `assertAiEvaluationAllowed` |
| Input validation (objective length, body schema) | **Partial** | Soft defaults; limited DTO validation |
| Output schema enforcement post-LLM | **Partial** | JSON.parse best-effort; no strict registry validate module |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-V1 | **High** | No dedicated post-parse **schema validation + repair budget** as first-class runtime stage |
| PR-V2 | **Medium** | Request DTOs not zod/class-validated end-to-end |
| PR-V3 | **Medium** | Critic/auditor not always mirrored as domain events |

---

### 2.5 Approval policies

| Check | Status | Evidence |
|-------|--------|----------|
| Objective classification risk | **Pass** | publish/PO → approvalRequired |
| Tool risk classes | **Pass** | registry |
| Queue listing approval on publish intent | **Partial** | host path exists |
| Approval as workflow pause/resume | **Fail** | No durable workflow gate (EVENT_DRIVEN_EXECUTION gaps) |
| AI cannot decide Approval BO | **Pass** (design) | human gate separate |
| All consequential Fabric writes gated | **Gap** | Fabric invoke not exclusive path |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-A1 | **Critical** | Consequential actions not consistently **workflow-paused** with Approval + resume — risk of inconsistent publish/PO gates under load/features |
| PR-A2 | **High** | Approval not correlated to workflowRunId/stepId for audit resume |
| PR-A3 | **Medium** | Shadow decisions vs real approval UX can confuse operators |

---

### 2.6 Response contracts

| Check | Status | Evidence |
|-------|--------|----------|
| CanonicalEnvelope type in contracts | **Pass** | `wrapEnvelope` exists |
| Operator always returns envelope | **Partial** | Some paths attach `envelope`; not sole response contract |
| dataMode / confidence / warnings | **Partial** | honesty blocks present; uneven |
| actions[] stable | **Partial** | nextActions on cards |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-R1 | **High** | Envelope not mandatory on every AI HTTP response |
| PR-R2 | **Medium** | Dual shapes (cycle DTO vs navigator package vs envelope) |
| PR-R3 | **Low** | schemaVersion not always stamped |

---

### 2.7 Schema validation

| Check | Status | Evidence |
|-------|--------|----------|
| Schema registry | **Pass** | `operator_briefing`, execution_package, … |
| Sent to Cohere | **Pass** | when schemaId set |
| Server-side AJV/zod against registry | **Fail / weak** | parse + field presence, not full schema validate |
| Artifact kind ↔ schemaId | **Partial** | registered but not enforced on persist |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-SC1 | **High** | Missing hard validation gate before persist/UI “generative success” |
| PR-SC2 | **Medium** | Artifact payloads not schema-checked on write |
| PR-SC3 | **Low** | Schema version evolution/compat policy undocumented |

---

### 2.8 Observability

| Check | Status | Evidence |
|-------|--------|----------|
| Nest Logger on AI service | **Pass** | partial |
| Ops metrics hooks | **Partial** | `recordOpsMetric` on live sync, not full AI path |
| Sentry/OTEL on AI failures | **Gap** | connectors registered; AI path not systematically instrumented |
| Structured log fields (org, runId, traceId) | **Partial** | correlation ids generated; not consistent in all logs |
| Aggregate health includes AI | **Fail** | `/health` = postgres + redis only |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-O1 | **High** | No production-grade AI RED metrics (rate, errors, duration) for Phase A/B |
| PR-O2 | **High** | Readiness probe ignores Cohere/Tavily critical deps for AI SKU |
| PR-O3 | **Medium** | Incomplete Sentry/OTEL spans for operator runs |
| PR-O4 | **Low** | Log PII/objective truncation policy not standardized |

---

### 2.9 Tracing

| Check | Status | Evidence |
|-------|--------|----------|
| requestId / traceId on runs | **Partial** | `newRequestIds` in operator |
| Distributed OTEL trace | **Gap** | not end-to-end for AI |
| Event causation chain | **Gap** | sparse events; weak causation |
| Client can query trace | **Fail** | no trace API |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-T1 | **High** | Cannot reconstruct full AI execution from Event Fabric alone |
| PR-T2 | **Medium** | SSE progress not linked to event ids |
| PR-T3 | **Medium** | No GET `/traces/:traceId` or case activity stream |

---

### 2.10 Diagnostics

| Check | Status | Evidence |
|-------|--------|----------|
| `GET /ai/health` | **Pass** | shallow + deep |
| `GET /ai/runtime` catalog | **Pass** | tools/prompts/schemas |
| Loop modes catalog | **Pass** | |
| **Public** unauthenticated access | **Fail for prod** | `@Public()` on tools, health, runtime |
| Connector diagnostics | **Partial** | ops endpoints exist |
| Wiring matrix | **Partial** | documented |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-D1 | **Critical** | Unauthenticated `/api/v1/ai/tools`, `/ai/runtime`, `/ai/health` expose stack surface (tools, policy, models) — lock down in production |
| PR-D2 | **Medium** | Diagnostics not unified into single authenticated ops diagnostics pack |
| PR-D3 | **Low** | Deep Cohere probe cost if abused (mitigate with auth + rate limit) |

---

### 2.11 Security

| Check | Status | Evidence |
|-------|--------|----------|
| Run endpoints permission-gated | **Pass** | `ai:write`, `products:read` |
| Org from AuthContext | **Pass** | not client-supplied org |
| Secrets not logged | **Pass** (policy) | keys not in health body |
| Public catalog endpoints | **Fail** | see PR-D1 |
| Prompt injection / tool allow-list | **Partial** | tools registry; persona allow-list optional |
| SSRF via research extract URL | **Gap** | Tavily extract needs allowlist policy review |
| Rate limit per org on AI | **Gap** | entitlement exists; burst limits unclear |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-SEC1 | **Critical** | Public AI discovery endpoints in production |
| PR-SEC2 | **High** | Org AI rate limiting / abuse controls incomplete |
| PR-SEC3 | **High** | URL extract / web research SSRF and data-exfil policy not hardened |
| PR-SEC4 | **Medium** | Permissions on tools vs host deps must be re-audited after megaservice shrink |
| PR-SEC5 | **Low** | Objective text retention / redaction policy |

---

### 2.12 Multi-tenancy

| Check | Status | Evidence |
|-------|--------|----------|
| Runs scoped by organizationId | **Pass** | list/get use auth org |
| Prisma queries org-scoped in host | **Pass** (typical) | |
| CaseId cross-tenant check | **Must verify** | getCaseAiContext should 404 other org — assume service scoped; treat gap if not tested |
| Event tenant isolation | **Pass** | org on CommerceEvent |
| No shared provider cache of tenant data | **Likely OK** | adapters stateless |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-MT1 | **High** | Explicit tests for cross-tenant caseId / runId access required before multi-tenant prod |
| PR-MT2 | **Medium** | Entitlement tier enforcement under concurrent load not proven |
| PR-MT3 | **Low** | Fixture seed data isolation per org hygiene |

---

### 2.13 Connector health

| Check | Status | Evidence |
|-------|--------|----------|
| Installation status / catalog | **Pass** | LiveConnectorService, ecosystem board |
| AI path uses health for selection | **Partial** | board injected; main path Prisma products |
| No silent live→fixture failover | **Pass** (principle) | documented |
| Fabric exclusive I/O | **Fail** | audit A6; AI bypasses |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-CH1 | **High** | AI critical path not gated on connector health for “live” claims |
| PR-CH2 | **High** | Connector Fabric not sole external I/O for AI tools |
| PR-CH3 | **Medium** | Health not blocking automated_live mode rigorously |

---

### 2.14 Knowledge Graph synchronization

| Check | Status | Evidence |
|-------|--------|----------|
| Projection functions exist | **Pass** | `projectCaseKnowledgeGraph` |
| Updated after every AI run | **Fail** | not on operator critical path |
| Search uses KG | **Fail** | Search Manager incomplete for AI |
| Edges for ai_run / artifacts | **Designed** | not enforced post-run |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-KG1 | **Medium** | KG not refreshed/consumed after AI commits (consistency for UI/AI context) |
| PR-KG2 | **Low** | No cache invalidation strategy for projections |

---

### 2.15 Workflow durability

| Check | Status | Evidence |
|-------|--------|----------|
| Durable types in package | **Pass** | durable-run.ts |
| Step-wise resume | **Fail** | one-shot executeDurableRun |
| AI uses workflow engine | **Fail** | in-process cycle |
| Persistence as OperatorRun dump | **Fail** for durability | not WorkflowRun SoR |
| Retries / DLQ | **Fail** | see EVENT_DRIVEN_EXECUTION |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-W1 | **Critical** | AI execution not durable/resumable — crash loses mid-run integrity; no approval resume |
| PR-W2 | **High** | Workflow templates not real step handlers with events |
| PR-W3 | **Medium** | No outbox for event reliability |

---

### 2.16 Data consistency

| Check | Status | Evidence |
|-------|--------|----------|
| Opportunity upsert after rank | **Partial** | host path |
| Case sync after run | **Partial** | org-wide sync, not always case-targeted |
| Recommendation vs Opportunity dual write risk | **Gap** | scores can diverge (AI_OUTPUT_OWNERSHIP) |
| Transaction boundaries BO+event | **Gap** | best-effort catches |
| Search evidence vs Product identity | **Gap** | SERP not import-gated in UX always |

**Blockers:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-DC1 | **High** | No single transactional commit order (BO → Case → Artifact → Event) |
| PR-DC2 | **High** | Dual score ownership (card JSON vs Opportunity) risk |
| PR-DC3 | **Medium** | Bulk case sync vs per-case consistency |
| PR-DC4 | **Medium** | Harmonization/learning failures only warned |

---

## 3. Blocker register (by severity)

### Critical

| ID | Area | Blocker |
|----|------|---------|
| **PR-D1 / PR-SEC1** | Security / Diagnostics | Unauthenticated AI catalog/health/tools endpoints |
| **PR-A1** | Approvals | Consequential actions not consistently workflow-gated with pause/resume |
| **PR-W1** | Workflow | AI path not durable/resumable |

### High

| ID | Area | Blocker |
|----|------|---------|
| **PR-F1** | Fixture honesty | Mixed live/fixture evidence UX/policy incomplete |
| **PR-S1** | Streaming | State enum drift vs RUNTIME_STATES |
| **PR-V1 / PR-SC1** | Validation | Weak post-LLM schema validation before success |
| **PR-R1** | Contracts | Envelope not mandatory |
| **PR-O1 / PR-O2** | Observability | Missing AI metrics + readiness composition |
| **PR-T1** | Tracing | Incomplete event reconstruction |
| **PR-SEC2 / PR-SEC3** | Security | Rate limit + web research SSRF policy |
| **PR-MT1** | Multi-tenancy | Cross-tenant access tests required |
| **PR-CH1 / PR-CH2** | Connectors | AI bypasses fabric/health for live claims |
| **PR-DC1 / PR-DC2** | Consistency | Dual writes / non-atomic pipeline |
| **PR-W2** | Workflow | Template runner not production durable |
| **PR-A2** | Approvals | Missing workflow correlation on approvals |

### Medium

| ID | Area | Blocker |
|----|------|---------|
| PR-C1, PR-C2 | Cohere ops | Health aggregation, circuit breaker |
| PR-F2 | Fixtures | Product-preload primary path |
| PR-S2, PR-S3 | Streaming | Heartbeat; event projection |
| PR-V2, PR-V3 | Validation | Request DTO; event on critic |
| PR-R2 | Contracts | Dual response shapes |
| PR-SC2 | Schema | Artifact write validation |
| PR-O3 | Observability | OTEL/Sentry spans |
| PR-T2, PR-T3 | Tracing | SSE↔events; trace API |
| PR-D2 | Diagnostics | Unified ops pack |
| PR-SEC4 | Security | Tool permission re-audit |
| PR-MT2 | Multi-tenancy | Entitlement under load |
| PR-CH3 | Connectors | automated_live gating |
| PR-KG1 | KG | Post-run projection |
| PR-W3 | Workflow | Outbox |
| PR-DC3, PR-DC4 | Consistency | Sync/learning edge cases |
| PR-A3 | Approvals | Shadow vs real UX |

### Low

| ID | Area | Blocker |
|----|------|---------|
| PR-C3 | Cohere | Quarantine xAI adapter surface |
| PR-F3 | Fixtures | Dead UI copy |
| PR-S4 | Streaming | Token stream optional |
| PR-R3, PR-SC3 | Contracts/schema | versioning docs |
| PR-O4, PR-SEC5 | Privacy | Objective redaction |
| PR-MT3 | Tenancy | Fixture seed hygiene |
| PR-KG2 | KG | Cache invalidation |
| PR-D3 | Diagnostics | Deep probe cost |

---

## 4. What is already production-leaning (preserve)

1. Cohere-only generative policy; no silent multi-model failover  
2. Honest empty/blocked briefing (no fixed essay substitute)  
3. Tool registry with risk + loop modes  
4. Session auth + permission on run endpoints  
5. Org-scoped run list/get pattern  
6. Deep Cohere diagnostics (when authenticated in future)  
7. Live examples default shadow  
8. Fixture labeling on products/honesty notes  
9. SSE progress from real backend steps (needs state alignment)  
10. Architecture docs for target ownership (execute normalization, don’t invent features)

---

## 5. Production readiness roadmap

Focused on **readiness**, not features. Order is dependency-aware.

### Phase P0 — Ship gate (Critical + blocking High)  
**Goal:** Safe multi-tenant beta / production with known limits  

| # | Work item | Clears | Effort (indicative) |
|---|-----------|--------|---------------------|
| 1 | **Auth-lock AI diagnostics** — remove `@Public()` from `/ai/tools`, `/ai/runtime`; protect `/ai/health` (or ops-only + rate limit) | PR-D1, PR-SEC1 | S |
| 2 | **Org AI rate limits** + abuse caps on run/stream | PR-SEC2 | M |
| 3 | **Cross-tenant tests** — caseId, runId, stream | PR-MT1 | S–M |
| 4 | **Mandatory CanonicalEnvelope** on all AI run responses | PR-R1 | M |
| 5 | **Post-LLM schema validate + bounded repair** before briefingSource=cohere success | PR-V1, PR-SC1 | M |
| 6 | **Align SSE states to RUNTIME_STATES** 1:1 | PR-S1 | S |
| 7 | **Approval gate audit** — every publish/PO path requires Approval BO before live side effect; fail closed | PR-A1 (partial) | M |
| 8 | **dataMode mixed policy** + UI banner enforcement | PR-F1 | M |
| 9 | **AI metrics + readiness** — include Cohere configured (and optional deep) in authenticated readiness; RED metrics | PR-O1, PR-O2, PR-C1 | M |
| 10 | **Web research SSRF/allowlist policy** for extract | PR-SEC3 | M |

**Exit criteria P0:** No public AI surface; envelope always; generative success only if schema-valid; SSE states stable; tenant isolation tested; publish/PO cannot skip approval; fixture/live not silent.

### Phase P1 — Operational durability (remaining High + key Medium)  
**Goal:** Crash-safe, auditable AI operations  

| # | Work item | Clears |
|---|-----------|--------|
| 11 | **WorkflowRun persistence + step executor** for AI objective template | PR-W1, PR-W2 |
| 12 | **Event per step + ToolExecutionCompleted/Failed** with causation | PR-T1, PR-V3 |
| 13 | **Approval ↔ workflow resume** | PR-A1 complete, PR-A2 |
| 14 | **Commit order** BO → Case → Artifact → Event (transaction/outbox) | PR-DC1, PR-W3 |
| 15 | **Opportunity SoR** for scores; cards reference opportunityId | PR-DC2 |
| 16 | **SearchPort + FabricPort only** for retrieval/I/O (no Prisma search in AI) | PR-CH2, A5/A6 |
| 17 | **Live claims gated on connector health** | PR-CH1, PR-CH3 |
| 18 | **OTEL/Sentry spans** for runId/traceId | PR-O3, PR-T2 |
| 19 | **SSE heartbeat + reconnect by runId** | PR-S2, PR-S3 |

**Exit criteria P1:** Resume after crash/approval; full event audit for a run; no dual score stores; AI cannot claim live without healthy connector path.

### Phase P2 — Consistency & COS alignment (Medium)  
**Goal:** Architecture docs match runtime  

| # | Work item | Clears |
|---|-----------|--------|
| 20 | Case-first bind default + per-case sync | PR-F2, PR-DC3, A2 |
| 21 | KG projection refresh post-run | PR-KG1 |
| 22 | Request DTO validation | PR-V2 |
| 23 | Artifact schema on persist | PR-SC2 |
| 24 | Unified authenticated diagnostics pack | PR-D2 |
| 25 | Shrink AiOperatorService to host adapter | A1/A14 debt (readiness: change risk) |
| 26 | Circuit breaker for Cohere 429 | PR-C2 |
| 27 | Trace query API by traceId/caseId | PR-T3 |

**Exit criteria P2:** Case is default AI context; KG available to context; host service thin; ops can diagnose in one place.

### Phase P3 — Hardening polish (Low + residual)  

| # | Work item | Clears |
|---|-----------|--------|
| 28 | Quarantine xAI from public runtime index | PR-C3 |
| 29 | Remove dead AI UI components | PR-F3, UX doc |
| 30 | Objective retention/redaction policy | PR-O4, PR-SEC5 |
| 31 | Document schema versioning | PR-SC3 |
| 32 | Optional token streaming (only if needed) | PR-S4 |

---

## 6. Explicit non-goals (this roadmap)

- New AI personas or chat product  
- Multi-model generative failover  
- New marketplace connectors  
- Token streaming as a vanity feature  
- Graph database productization of KG  

These are features; readiness is **hardening and ownership normalization** of what exists.

---

## 7. Go / No-Go snapshot

| Environment | Go? | Conditions |
|-------------|-----|------------|
| Local / founder_direct | **Go** | Cohere + honesty known |
| Internal staging | **Go** after P0 items 1–3, 5–6 minimum | |
| Multi-tenant production | **No-Go** until P0 complete | Critical security + approval + envelope + validation |
| Automated live commerce AI | **No-Go** until P1 workflow + fabric + consistency | |

---

## 8. Closing

Production readiness is **not** blocked primarily by “Cohere doesn’t work.” It is blocked by:

1. **Security surface** on public AI diagnostics  
2. **Non-durable AI execution** and weak approval/workflow integration  
3. **Contract/validation gaps** (envelope + schema)  
4. **Honesty and connector truth** on mixed/fixture/live paths  
5. **Observability and audit incompleteness**

Execute **P0 → P1 → P2** as readiness work. Preserve Cohere-only honesty and two-phase tools. Treat architecture docs (runtime, case, search, fabric, events, UX) as the **implementation checklist**, not a feature backlog.
