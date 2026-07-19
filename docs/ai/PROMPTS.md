# Prompts

Prompts are versioned source modules — not Playground config.

## Registry

```typescript
import { getPrompt, requirePrompt, listPromptsPublic } from '@tradeops/ai-runtime';

const p = requirePrompt('tradeops-system'); // latest
// or requirePrompt('tradeops-system', '1.0.0')
```

## Active prompts

| ID | Version | File |
|----|---------|------|
| `tradeops-system` | 1.0.0 | `packages/ai-runtime/src/prompts/system/tradeops-system-v1.ts` |

## Rules encoded in system prompt

- Classify information needs (no search / web / operational / mixed)
- Never invent inventory, prices, orders, payments, shipments
- Never claim write execution without verified tool results
- Writes require approval
- No chain-of-thought exposure
- Structured output when schema requested

## Adding a prompt

1. Create `packages/ai-runtime/src/prompts/.../name-vX.ts` with `id`, `version`, `text`
2. Register in `prompts/registry.ts`
3. Point agent loop / callers at the new ID
