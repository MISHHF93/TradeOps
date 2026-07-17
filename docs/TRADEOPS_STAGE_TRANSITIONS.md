# Stage Transitions

Implemented in `packages/commerce-engine/src/commerce-lifecycle.ts`.

## Allowed edges

| From | To |
|------|-----|
| discover | evaluate, closed |
| evaluate | qualify, discover, closed |
| qualify | prepare, evaluate, closed |
| prepare | approve, qualify, closed |
| approve | publish, prepare, closed |
| publish | sell, approve, closed |
| sell | source, closed |
| source | fulfill, sell, closed |
| fulfill | reconcile, source, closed |
| reconcile | learn, fulfill, closed |
| learn | closed, discover |

## Example requirements

| Transition | Requires |
|------------|----------|
| discover → evaluate | product exists |
| evaluate → qualify | opportunity / cost inputs |
| qualify → prepare | not policy-blocked |
| prepare → approve | listing draft |
| approve → publish | no pending approval gap |
| publish → sell | active listing |
| sell → source | paid order |
| source → fulfill | supplier PO |
| fulfill → reconcile | fulfillment activity |
| reconcile → learn | outcomes or delivered |

API: `POST /api/v1/commerce/cases/:id/advance` with `{ "toStage": "evaluate" }`.
