# TradeOps AI Stack (Adapter Architecture)

**TradeOps owns orchestration.** The model is a pluggable reasoning engine.

```text
User → TradeOps AI Gateway → AI Adapter → OpenAI (primary)
                                         → xAI / Gemini (optional)
                │
        ┌───────┴────────┐
        ▼                ▼
  Search Manager   Capability Gateway
  (web adapters)   (commerce / payments / …)
        │                │
        └───────┬────────┘
                ▼
     TradeOpsAIResponse { text, json, evidence, actions }
```

## Why OpenAI as the primary runtime

TradeOps needs deterministic production infrastructure:

| Need | OpenAI |
|------|--------|
| Strict JSON Schema structured outputs | Excellent |
| Function / tool calling | Mature |
| Built-in web search (Responses API) | Yes |
| Streaming + SDKs | Excellent |
| Multi-step agent patterns | Mature |

xAI remains an **optional adapter** (`AI_PROVIDER=xai`). Gemini is a stub adapter.

## AI Adapter (provider independence)

Application code **must not** call OpenAI/xAI/Gemini SDKs directly.

```typescript
import { getAiAdapter } from '@tradeops/ai-runtime';

const adapter = getAiAdapter();
const result = await adapter.generate({ system, user, jsonSchema });
```

Interface surface:

```text
generate · search · classify · extract · plan · toolCall · stream
```

Swap runtime with env:

```dotenv
AI_PROVIDER=openai          # primary
# AI_PROVIDER=xai           # optional
# AI_PROVIDER=auto          # first configured key
```

## Three kinds of live information

| Class | Source | Never replace with |
|-------|--------|--------------------|
| Public web | Search Manager → OpenAI web / Tavily | Connectors |
| Social / market | xAI X Search adapter (optional) | Inventory/finance |
| Operational | Shopify, Stripe, carriers, GA4, ERP | Internet search |

## Search Manager

```text
Objective → Intent → Policy → Provider Router
  → OpenAI Web Search | Tavily | xAI web/X
  → Dedupe → Rank → Cite → AI synthesis
```

Adding Tavily later (or removing it) is **one adapter**, not an app rewrite.

## Response envelope

One schema regardless of which model produced it:

```typescript
TradeOpsAIResponse {
  output: { text: string; json: T };
  evidence: [];
  actions: [];
  confidence: number;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
}
```

- `output.text` → chat UI  
- `output.json` → cards, charts, workflows, automation  

Server re-validates structured fields before return. Prefer **JSON Schema** over bare `json_object`.

## Capability Gateway

Grok/OpenAI only see normalized tools:

```text
commerce.*  payments.*  logistics.*  analytics.*
procurement.*  research.*
```

Vendor REST stays in adapters. Writes require approval.

## Environment

```dotenv
# ============================================================
# AI ADAPTER — primary runtime
# ============================================================
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_WEB_SEARCH_ENABLED=true

# Optional alternate runtimes
XAI_API_KEY=
XAI_MODEL=grok-3
XAI_BASE_URL=https://api.x.ai/v1
# GEMINI_API_KEY=

AI_RESPONSE_MODE=json_schema
AI_STRUCTURED_OUTPUT_ENABLED=true
AI_TOOL_CALLING_ENABLED=true
AI_STREAMING_ENABLED=true

# ============================================================
# SEARCH MANAGER
# ============================================================
SEARCH_PROVIDER_PRIMARY=openai
SEARCH_PROVIDER_RETRIEVAL=openai
# Optional dedicated retrieval adapter:
TAVILY_API_KEY=
TAVILY_SEARCH_ENABLED=true
TAVILY_EXTRACT_ENABLED=true
TAVILY_CRAWL_ENABLED=true

SEARCH_REQUIRE_CITATIONS=true
SEARCH_MAX_QUERIES_PER_REQUEST=6
SEARCH_MAX_RESULTS_PER_QUERY=10

# ============================================================
# EXECUTION + RESPONSE CONTRACT
# ============================================================
AI_MAX_TOOL_CALLS=15
AI_REQUIRE_APPROVAL_FOR_WRITES=true
AI_REQUIRE_APPROVAL_FOR_PAYMENTS=true
AI_REQUIRE_APPROVAL_FOR_REFUNDS=true
AI_REQUIRE_APPROVAL_FOR_PUBLISHING=true
AI_OUTPUT_SCHEMA_VERSION=1.0
AI_INCLUDE_TEXT_OUTPUT=true
AI_INCLUDE_JSON_OUTPUT=true
AI_INCLUDE_EVIDENCE=true
AI_INCLUDE_ACTIONS=true
```

Platform-level: OpenAI (and optional Tavily/xAI).  
Tenant-level: Shopify/Stripe/etc. encrypted connector credentials.

## Code map

| Piece | Path |
|-------|------|
| Platform config | `packages/config/src/ai-platform-config.ts` |
| AI Adapter | `packages/ai-runtime/src/ai-adapter.ts` |
| OpenAI client | `packages/ai-runtime/src/openai-client.ts` |
| xAI client | `packages/ai-runtime/src/llm-client.ts` |
| Search Manager | `packages/ai-runtime/src/search-manager.ts` |
| Capabilities | `packages/ai-runtime/src/capability-catalog.ts` + `capability-executor.ts` |
| Envelope | `packages/ai-runtime/src/response-envelope.ts` |
| Gateway | `packages/ai-runtime/src/ai-gateway.ts` |
| HTTP | `GET /ai/gateway`, `POST /ai/gateway/run` |
| UI | `/terminal/ai` |

## Architectural rules

1. **TradeOps owns orchestration** — not the model vendor.  
2. **AI Adapter** is the only path to model I/O.  
3. **OpenAI is the recommended primary runtime.**  
4. **Search Manager** centralizes public web retrieval.  
5. **Capability Gateway** normalizes vendor APIs.  
6. **Every response** is text + validated JSON + evidence + actions.  
7. **Operational claims** never come from internet search.  
8. **Writes** require permissions and approval.  
9. **Tenant-scoped** requests only.  
10. **One user-visible AI** — internal skills, not a swarm of agents.

## Progressive depth

| Item | Status |
|------|--------|
| AI Adapter + OpenAI generate + json_schema | **Live** |
| OpenAI Responses web_search adapter | **Live** (graceful fail → Tavily) |
| Gateway multi-step + envelope | **Live** |
| Capability executor | **Live** |
| Full multi-hop tool-calling loop | Progressive |
| Gemini full adapter | Stub |
| AJV validation | Progressive (lightweight validator) |
