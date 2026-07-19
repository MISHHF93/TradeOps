# Schemas

## Canonical response

`TradeOpsCanonicalResponse` — see `packages/ai-runtime/src/schemas/base-response.ts`.

Frontend:

- `output.text` — chat
- `output.artifact` — cards / tables / workflows
- `evidence` — sources
- `actions` — approval-aware proposals

## Registry

```typescript
import { getSchema, listSchemasPublic } from '@tradeops/ai-runtime';

getSchema('product_comparison', '1.0.0')
```

Registered IDs:

- `tradeops_synthesis` (provider synthesis payload)
- `answer`
- `classification`
- `research_report`
- `product_comparison`
- `supplier_comparison`
- `operational_brief`
- `execution_plan`

## Validation

Every Cohere synthesis result is validated with `validateSynthesisPayload`.  
On failure: one repair attempt, then structured `failed` response — never silent malformed JSON.
