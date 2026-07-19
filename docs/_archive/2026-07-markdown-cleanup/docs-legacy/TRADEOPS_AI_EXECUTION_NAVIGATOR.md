# TradeOps AI Execution Navigator

## Purpose

The AI Operator is an **Objective Resolution Engine**, not a conversational chatbot.

Every interaction **starts with an objective**. Every response is a structured **Execution Package** that guides the user from goal → verified outcome.

---

## Execution Package (10 sections)

| # | Section | Content |
|---|---------|---------|
| 1 | **Objective** | Business goal, desired outcome, objective type, risk class, filters |
| 2 | **Current State** | Products, connectors, cases, what is already implemented, gaps |
| 3 | **Live Evidence** | Claims with source, timestamp, confidence, live vs fixture/simulation |
| 4 | **Recommendations** | Ranked implementation options (impact, effort, confidence, business value) |
| 5 | **Execution Plan** | Engineering tasks with files, services, models, APIs, UI |
| 6 | **Timeline** | Immediate (hours), short-term (days), longer-term (weeks) |
| 7 | **Dependencies** | Credentials, OAuth, infrastructure, approvals |
| 8 | **Risks** | Technical, security, operational, business + mitigations |
| 9 | **Execution Status** | planned · in_progress · blocked · completed · failed |
| 10 | **Verification** | Measurable acceptance criteria + overall pass/partial/fail |

Plus: `knowledgeBaseDelta` and `priorKnowledgeApplied` for continuous learning.

---

## Package locations

| Layer | Path |
|-------|------|
| Pure builder | `packages/ai-runtime/src/execution-navigator.ts` |
| API host | `apps/api/src/ai/ai-operator.service.ts` → `resolveObjective`, `runObjective` |
| Endpoints | `POST /ai/navigator/resolve`, `POST /ai/operator/run` (default navigate), `GET /ai/navigator/knowledge` |
| Persistence | `OperatorRun.planJson.executionPackage` + knowledge deltas |
| Events | `ai.objective.resolved` |
| UI | `AiOperatorConsole` Execution Package panel · `/terminal/objectives/[id]` |

---

## Operational principles

1. **Objectives, not conversations** — free-form chat is not the unit of work.  
2. **Execution, not explanation** — packages include tasks, files, APIs, acceptance criteria.  
3. **Official sources first** — live connectors, canonical store, official docs; secondary sources last.  
4. **Data classes** — `live_connector` · `canonical_store` · `derived_model` · `fixture` · `simulation`.  
5. **Traceable recommendations** — each option cites `evidenceIds`.  
6. **Knowledge compounds** — completed packages write `knowledgeBaseDelta`; later objectives load prior knowledge.

---

## API usage

```http
POST /api/v1/ai/navigator/resolve
Content-Type: application/json

{
  "objective": "Find three products under $20 with 25% margin for Canada",
  "forceShadow": true,
  "runCycle": true
}
```

```http
POST /api/v1/ai/operator/run
{
  "objective": "Connect Shopify and sync live products",
  "navigate": true
}
```

```http
GET /api/v1/ai/navigator/knowledge
```

Set `"navigate": false` on `operator/run` to skip the navigator wrapper (legacy cycle-only).

---

## Ranking formula

```
score = impact×2 + businessValue×2 + confidence×5 − effort
```

(impact/effort/value on 1–5 scales; confidence 0–1.)

Top-scoring option is marked `recommended: true`.

---

## Relation to operator cycle

| Mode | Behavior |
|------|----------|
| Analysis / product objectives | Navigator runs full operator cycle + attaches package |
| Platform / connector objectives | Package from platform snapshot; cycle optional (`runCycle: false`) |
| Publish / PO | Package includes approval dependencies + critical risks |

The product-ranking cycle remains the **commerce evaluation engine**. The navigator is the **objective orchestration layer** around it.

---

## Honesty rules

- Never fabricate live connector status.  
- Fixture products counted separately and labeled.  
- Credential presence is boolean only — secrets never in package.  
- Empty stores produce partial verification, not fake rankings.
