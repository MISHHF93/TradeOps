# Task Engine

**Status:** Operational foundations (derived tasks)  
**Code:** `deriveTasksFromCases` / `deriveBlockersFromCases`

## Model

Tasks are **derived** from `CommerceCase` next-action and blocker fields so they cannot drift from the process spine.

| Field | Source |
|-------|--------|
| stage | case.currentStage |
| action | nextActionCode / nextActionLabel |
| priority | stage + score heuristics |
| href | nextHref / journey |
| completionCriteria | per action code |

## API / UI

| Surface | Path |
|---------|------|
| API | `GET /api/v1/commerce/tasks` |
| UI | `/terminal/tasks` |

## Blockers

First-class list in the same response: severity, resolution, AI assist flag, case link.
