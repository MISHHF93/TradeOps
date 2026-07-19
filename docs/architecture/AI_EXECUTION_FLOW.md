# AI Execution Flow

**Canonical blueprint:** `TRADEOPS_AI_RUNTIME_BLUEPRINT.md`

## Ownership

| Concern | Owner |
|---------|--------|
| Prompts, schemas, tools, artifacts (kinds), validation, repair, orchestration, evidence, provenance, streaming contract, envelopes | **One AI Runtime** |
| Auth, tenant, entitlements, HTTP/SSE, port wiring, persistence | **AI Host Adapter** |
| Durable steps, resume, retry | **One Workflow Engine** |
| Retrieval | **One Search Layer** |
| External commerce I/O | **One Connector Fabric** |
| Process stage | **One Commerce Case** |
| Domain facts | **Business Objects** (One Source of Truth) |
| History | **Event Fabric** |
| Relationships | **Knowledge Graph** (projection) |
| Honesty labels | **Data Fabric** |
| Generative model | Cohere only (no multi-provider fallback) |

## Path

```
Client (contextual rail on BO workspace)
  → Nest /api/v1/ai/*  (auth, entitlement)
  → WorkflowRun + AI Host Adapter
  → AI Runtime AiExecutionEngine.run
       Phase A: classify → plan → tools → evidence + provenance
       Critic + auditor → decision
       Phase B: Cohere synthesis (optional)
       Validate + repair
       Materialize AI artifacts
       CanonicalEnvelope
  → Commit: BO → Case sync → Artifacts → Events → KG refresh
  → Optional Approval pause/resume via Workflow Engine
  → Envelope + stream projection → UI
```

## Structured contract fields

`requestId`, `traceId`, `tenantId`, `state` (`RUNTIME_STATES`), `dataMode`, `confidence`, `warnings`, `blocked?`, `evidence[]`, `actions[]`, `caseId?`, `workflowRunId?`

## Failure

Missing Cohere → blocked generation note (empty text). Tools still execute.  
No silent switch to another model or demo narrative.
