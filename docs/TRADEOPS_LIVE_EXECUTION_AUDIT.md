# TradeOps Live Execution Audit

**Date:** 2026-07-16  
**Scope:** Run Objective → AI runtime → persistence → UI  
**Mode:** Honest — fixture-capable local founder stack

---

## 1. Where execution begins

| Layer | Entry |
| --- | --- |
| UI | Docked `AiContextPanel`, `/terminal/ai` `AiOperatorConsole`, `/terminal/live-examples` |
| API | `POST /api/v1/ai/operator/run`, `POST /api/v1/ai/live-examples/:id/run` |
| Service | `AiOperatorService.runObjective` / `runLiveExample` |
| Runtime | `@tradeops/ai-runtime` `runOperatorCycle` + typed tools |
| Persistence | `OperatorRun`, `OperatorRecommendation`, optional `ShadowDecision`, audit + events |

---

## 2. Services touched

1. Auth / founder_direct identity  
2. SaaS entitlement `assertAiEvaluationAllowed`  
3. Prisma product + opportunity + connectorInstallation load  
4. Tool registry: listConnectorCapabilities, searchConnectedProducts, calculateContributionProfit, assessPolicyRisk  
5. Commerce engine unit economics + policy + opportunity score  
6. Critic + auditor passes  
7. OperatorRun planJson envelope (timeline, sources, finalAnswer, filters)  
8. Frontend poll/restore via GET `/api/v1/ai/runs/:id`  

---

## 3. Where the chain previously stopped (fixed)

| Stop | Fix |
| --- | --- |
| Shadow mode forced `approvalRequired` on research | `classifyObjective` → READ_ONLY_ANALYSIS |
| Auto `publish_listing` on analysis | Queue only for publish intent |
| UI showed escalate / awaiting approval only | Full timeline + product cards + Completed state |
| Empty approval Action column | Status-aware `ApprovalActionCell` |
| Results disappeared on navigation | OperatorRun + `/terminal/objectives` + opportunities |

---

## 4. Current honesty matrix

| Area | Status |
| --- | --- |
| Read-only product evaluation | **Operational** (product store / fixture-labeled sources) |
| Live marketplace OAuth publish | **Credential-blocked** until Google/Shopify tokens |
| Supplier live PO submission | **Partial** (fixture marketplace + draft PO + approval) |
| Margin protection schedule | **Not implemented** (example defined, `runnable: false`) |
| Durable browser-independent workers | **Partial** — OperatorRun is durable; long jobs still sync HTTP |

---

## 5. Fixture policy

- Fixtures allowed for tests + local founder store.  
- UI labels: `TEST FIXTURE — NOT LIVE DATA`.  
- Never claim fixture rows as live marketplace traffic.

---

## 6. Disconnected / remaining gaps

- Full durable workflow engine (checkpoints across worker restart for multi-hour jobs) not complete.  
- Multi-supplier offer comparison uses product economics; multi-offer matrix incomplete.  
- Webhook-verified order ingest is fixture-first.  
- Real-time SSE for objective progress not wired (request/response + persisted timeline).  

---

## 7. Repair priority completed in this pass

1. Live Example Framework + readiness API  
2. `/terminal/live-examples`, `/terminal/objectives`, `/terminal/objectives/[id]`  
3. Canadian Product Opportunity Scan as runnable example #1  
4. Docs + frontend-backend map  
5. Approval/action loop already repaired for research vs publish  

**Do not stop at audit** — implementation ships with this document.
