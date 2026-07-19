# Cohere Runtime Configuration

> **Ownership:** TradeOps source code owns all production AI behavior.  
> Cohere is the model provider only. See [PRODUCTION_OWNERSHIP.md](./PRODUCTION_OWNERSHIP.md).

## Required (server only)

```dotenv
COHERE_API_KEY=
AI_PROVIDER=cohere
```

Never use `NEXT_PUBLIC_COHERE_API_KEY` or any browser-exposed variable.

## Recommended

```dotenv
COHERE_CHAT_MODEL=command-a-03-2025
COHERE_EMBED_MODEL=embed-v4.0
COHERE_RERANK_MODEL=rerank-v3.5
COHERE_TEMPERATURE=0.2
COHERE_MAX_TOKENS=4000
COHERE_RETRIEVAL_ENABLED=true
AI_MAX_TOOL_ROUNDS=8
AI_MAX_EXECUTION_SECONDS=120
AI_REQUIRE_APPROVAL_FOR_WRITES=true
AI_STRUCTURED_OUTPUT_ENABLED=true
AI_TOOL_CALLING_ENABLED=true

# Public internet search (TradeOps-owned — not Cohere)
WEB_SEARCH_ENABLED=false
# When enabling: set OPENAI_API_KEY or TAVILY_API_KEY and WEB_SEARCH_ENABLED=true
```

## Optional alternate generation providers

```dotenv
# AI_PROVIDER=openai
OPENAI_API_KEY=
# AI_PROVIDER=xai
XAI_API_KEY=
```

## Activate locally

1. Place `COHERE_API_KEY` in root `.env` (gitignored).
2. Set `AI_PROVIDER=cohere`.
3. Ensure database: `pnpm run db:pglite`.
4. `pnpm --filter @tradeops/ai-runtime build && pnpm --filter @tradeops/api build`
5. `pnpm start`
6. Open http://127.0.0.1:3000/terminal/ai or `POST /api/v1/ai/chat`

## Health (no secrets)

```http
GET /api/v1/ai/production-config
GET /api/v1/ai/runtime
GET /api/v1/ai/health
GET /api/v1/ai/gateway
GET /api/v1/ai/agents
```

Shows configured/missing, active provider, model names, prompt/schema/tool registries — never credential values.
