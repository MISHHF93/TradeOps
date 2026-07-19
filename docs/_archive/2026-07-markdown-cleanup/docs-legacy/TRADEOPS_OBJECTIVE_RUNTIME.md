# Objective Runtime

## Canonical model

`OperatorRun` is the durable **ObjectiveExecution** equivalent:

| Field | Source |
| --- | --- |
| id | OperatorRun.id |
| objective | OperatorRun.objective |
| status | OperatorRun.status |
| decision / decisionNote | columns |
| planJson | timeline, sources, filters, finalAnswer, liveExampleId, objectiveType |
| toolTraceJson | tool calls |
| recommendations | OperatorRecommendation rows |

## Status mapping

| Runtime | OperatorRun status |
| --- | --- |
| collecting | collecting |
| completed | completed |
| approval wait | awaiting_approval |
| blocked | blocked |
| failed | failed |

## API

- `POST /api/v1/ai/operator/run` — ad-hoc objective  
- `POST /api/v1/ai/live-examples/:id/run` — catalog example  
- `GET /api/v1/ai/runs` / `GET /api/v1/ai/runs/:id` — history + restore  

## Frontend

- `/terminal/objectives` list  
- `/terminal/objectives/[id]` detail  
- `/terminal/opportunities?runId=` commerce ranking view  
- AI panel restores last result (sessionStorage v2 + server fields)  
