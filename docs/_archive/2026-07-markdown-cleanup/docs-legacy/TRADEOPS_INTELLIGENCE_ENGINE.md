# TradeOps Operational Intelligence Engine

## Purpose

Make TradeOps a **smart** Commerce OS: the platform ranks live operational signals by persona, proposes a focus objective, and drives navigation, workspace home, and AI context from that ranking — without fabricating KPIs.

---

## Pipeline

```
Live org state (DB + connectors)
  → IntelligenceSignals
  → generateInsights (persona-weighted)
  → IntelligenceBrief (attention score, narrative, focus objective)
  → Workspace surface + AI preamble + sidebar next action
  → User / AI Execution Navigator
```

---

## Components

| Piece | Location |
|-------|----------|
| Pure engine | `packages/commerce-engine/src/intelligence-engine.ts` |
| Workspace integration | `resolveWorkspace` + `buildWorkspaceSurface` |
| Signal loading | `apps/api/src/commerce/workspace.service.ts` |
| API | `GET /api/v1/workspace` (includes `intelligence`) · `GET /api/v1/workspace/intelligence` |
| UI | Persona home insights · sidebar health · AI focus objective |

---

## Signals loaded

- Pending approvals, tasks, blockers, active / stalled cases  
- Connector issues + live-connected count  
- Products (live vs fixture)  
- Open orders (`pending` / `paid`)  
- High opportunity scores  
- Commerce signal BUY/BLOCKED counts  
- Operator run counts (recent / failed)  
- Simulation mode  

---

## Insight kinds

`blocker` · `approval` · `fulfillment` · `connector` · `opportunity` · `stalled_case` · `data_quality` · `learning` · `healthy` · `simulation`

Each insight carries:

- urgency score (persona-weighted)  
- confidence  
- evidence strings  
- href  
- `suggestedObjective` for AI  

---

## Health labels

| Label | Meaning |
|-------|---------|
| `critical` | High attention score — clear blockers/approvals first |
| `attention` | Material queue — work the ranked insights |
| `opportunity` | Stable enough; pursue high scores |
| `stable` | No critical exceptions |

---

## Honesty

- No fabricated revenue or live market claims  
- Fixture-only catalogs and simulation mode produce explicit insights  
- Confidence reflects source quality (counts = high; scores = moderate)

---

## User experience

1. Open persona workspace → ranked priorities + insights  
2. Sidebar shows health + next action + “Run focus objective”  
3. AI panel pre-fills focus objective from intelligence  
4. One-click “Ask AI” on each insight runs the Execution Navigator  
