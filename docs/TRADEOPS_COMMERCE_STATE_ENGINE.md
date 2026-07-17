# Commerce State Engine

## Conceptual inspiration (not RF)

The [Smith Chart](https://en.wikipedia.org/wiki/Smith_chart) is useful to engineers because it encodes:

1. **Complete state** of a system at a glance  
2. **Valid transformations** with known geometry  
3. **Measurable consequences** of every move  
4. Always a **current** state and an **optimal target**  
5. Always a **next best operation** toward that target  

TradeOps adopts those *engineering disciplines* — **not** RF equations or a literal Smith Chart UI.

## What we built

| Layer | Module | Role |
|-------|--------|------|
| Friction | `commerce-friction.ts` | Business impedance: incomplete data, supplier uncertainty, policy, connectors, approvals, confidence |
| Matching | `commerce-matching.ts` | Merchant objectives ↔ market conditions alignment |
| State Engine | `commerce-state-engine.ts` | Full state vector + ranked transformations |
| Lifecycle | `commerce-lifecycle.ts` | Finite stages + legal transitions (spine) |
| Resolver API | `CommerceCaseService.resolveState` | DB facts → state vector |
| UI | `CommerceStatePanel` | Answers: where am I / blockers / optimal next |

## State vector (every Commerce Case)

* `currentState` / `stageStatus`  
* `targetState` / `distanceToTarget`  
* `operationalFriction` (0–100, lower better)  
* `executionReadiness` / `businessRisk` / `confidenceScore` / `opportunityScore`  
* `blockers` / `missingInformation`  
* `recommendedTransformation` + ranked alternatives  
* `screen.*` — copy for state-centric UI  

## Transformations

Deterministic, auditable catalog (`discover_product` → `learn` / `close_case`).  
Each transform has: AI eligibility, approval flag, permissions, tools, value score, reversibility.

`POST /api/v1/commerce/cases/:id/transform` applies a transform, optionally advances stage, writes audit.

## AI

AI must **optimize cases toward target state**, not chat for its own sake.

* `buildStateEngineAiPreamble(state)` injects friction, readiness, recommended transform  
* Case AI context merges state preamble + stage SOP context  

## APIs

* `GET /api/v1/commerce/state` — org state board  
* `GET /api/v1/commerce/cases/:id/state` — single vector  
* `POST /api/v1/commerce/cases/:id/transform` — apply transform  

## Persona workspaces

`resolveCommerceState({ persona })` boosts transforms relevant to Researcher / Operator / Executive / Analyst / Developer / Administrator without duplicating case data.

## Honesty

* No RF mathematics in the product.  
* Friction scores are **heuristic business metrics**, not physical impedance.  
* Live channel publish still requires connectors + approvals.  
