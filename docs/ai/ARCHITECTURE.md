# TradeOps AI Architecture (Cohere Runtime)

**Final rule:** TradeOps owns the agent. Cohere is a replaceable reasoning, embedding, and reranking provider.

```text
UI → POST /api/v1/ai/chat
   → Trusted tenant context (server)
   → Request classifier + objective planner
   → Phase A: Cohere tool selection
   → TradeOps tool executor (capabilities / connectors / search)
   → Evidence normalization
   → Phase B: Cohere structured synthesis
   → Runtime validation
   → TradeOpsCanonicalResponse { output.text, output.artifact, evidence, actions }
```

## Ownership

| Concern | Owner |
|---------|--------|
| Auth, tenant isolation, approvals | TradeOps |
| Tool execution & connector APIs | TradeOps |
| Internet search | TradeOps Search Manager |
| Embed / rerank / chat generation | Cohere (via `AIProvider`) |
| Schemas, validation, persistence | TradeOps |

The frontend **never** calls Cohere and never receives `COHERE_API_KEY`.

## Modules

| Path | Role |
|------|------|
| `packages/ai-runtime/src/provider/` | `AIProvider` + Cohere/OpenAI implementations |
| `packages/ai-runtime/src/runtime/agent-loop.ts` | Two-stage agent |
| `packages/ai-runtime/src/prompts/` | Versioned prompts |
| `packages/ai-runtime/src/schemas/` | Canonical response + synthesis schema |
| `packages/ai-runtime/src/search-manager.ts` | Public + internal search |
| `packages/ai-runtime/src/retrieval-engine.ts` | Cohere enterprise retrieval |
| `packages/ai-runtime/src/capability-executor.ts` | Normalized tools |

## Canonical endpoint

```http
POST /api/v1/ai/chat
```

Body: `{ "message": string, "conversationId"?: string }`  
Server injects tenant/user. Returns `TradeOpsCanonicalResponse`.

Also: `POST /api/v1/ai/gateway/run` (routes to Cohere loop when `AI_PROVIDER=cohere`).

## Related docs

- [CONFIGURATION.md](./CONFIGURATION.md)
- [TOOLS.md](./TOOLS.md)
- [OPERATIONS.md](./OPERATIONS.md)
