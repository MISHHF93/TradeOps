# Next-Action Engine

**Status:** Operational  
**Code:** `computeNextAction` in `commerce-lifecycle.ts`

Every open commerce case has **one** primary next action:

| Stage | Typical next action |
|-------|---------------------|
| discover | Run evaluation |
| evaluate | Qualify opportunity |
| qualify | Prepare launch |
| prepare | Submit for approval |
| approve | Review approval queue |
| publish | Monitor listing / await sales |
| sell | Prepare supplier order |
| source | Track fulfillment |
| fulfill | Reconcile transaction |
| reconcile | Review prediction outcome |
| learn | Close case |
| blocked | Resolve blocker message |

Surfaced on: Process board, Journey, Terminal urgent table, Tasks, AI case context.
