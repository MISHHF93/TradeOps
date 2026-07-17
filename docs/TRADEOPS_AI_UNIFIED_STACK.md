# TradeOps Unified AI Stack

**Architecture rule:** One AI provider, one web-intelligence retrieval provider, one capability gateway.

```text
xAI / Grok  →  reasoning + structured JSON + tool selection
Tavily      →  controlled web search / extract / crawl
Connectors  →  authenticated operational truth only
```

## Do not add

- Competing LLMs as first-class product providers (OpenAI/Anthropic may remain registry stubs only)
- Multiple public search APIs at once (SerpAPI, Brave, Bing, Google CSE) — **Tavily only** for retrieval
- Separate user-visible agents (Research Agent, Payment Agent, …)

## Layers

| Layer | Role |
|-------|------|
| **AI Gateway** | `POST /api/v1/ai/gateway/run` — single entry for frontend |
| **Grok** | Sole LLM (`packages/ai-runtime` + `llm-client`) |
| **Search Manager** | Intent → policy → Tavily / xAI web / X |
| **Capability Gateway** | Normalized tools: `commerce.*`, `payments.*`, `research.*`, … |
| **Response envelope** | `output.text` + `output.json` + evidence + actions |

## Information classes

1. **Public web** — Tavily + xAI Web Search  
2. **Social / market signals** — xAI X Search  
3. **Authenticated operational** — Shopify, Stripe, carriers, GA4, ERP — **never replaced by search**

## Response contract

```typescript
type TradeOpsAIResponse = {
  requestId: string;
  tenantId: string;
  conversationId: string;
  output: { text: string; json: unknown };
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  confidence: number;
  evidence: Array<{ sourceType; provider; url?; freshness }>;
  actions: Array<{ capability; requiresApproval; parameters }>;
  warnings: string[];
  generatedAt: string;
};
```

Prefer **JSON Schema** structured outputs over loose `json_object` only. Server re-validates before return.

## Code map

| Piece | Path |
|-------|------|
| Platform env | `packages/config/src/ai-platform-config.ts` |
| Envelope | `packages/ai-runtime/src/response-envelope.ts` |
| Search Manager | `packages/ai-runtime/src/search-manager.ts` |
| Tavily | `packages/ai-runtime/src/tavily-client.ts` |
| Capabilities | `packages/ai-runtime/src/capability-catalog.ts` |
| Gateway | `packages/ai-runtime/src/ai-gateway.ts` |
| HTTP | `GET /ai/gateway`, `POST /ai/gateway/run` |

## Environment (paste into `.env`)

```dotenv
AI_PROVIDER=xai
XAI_API_KEY=
XAI_MODEL=grok-3
XAI_BASE_URL=https://api.x.ai/v1

AI_RESPONSE_MODE=json_schema
AI_TEXT_OUTPUT_ENABLED=true
AI_STRUCTURED_OUTPUT_ENABLED=true
AI_TOOL_CALLING_ENABLED=true

XAI_WEB_SEARCH_ENABLED=true
XAI_X_SEARCH_ENABLED=true
XAI_SEARCH_MAX_CALLS=5

TAVILY_API_KEY=
TAVILY_SEARCH_ENABLED=true
TAVILY_EXTRACT_ENABLED=true
TAVILY_CRAWL_ENABLED=true
TAVILY_RESEARCH_ENABLED=true

SEARCH_PROVIDER_PRIMARY=xai
SEARCH_PROVIDER_RETRIEVAL=tavily
SEARCH_REQUIRE_CITATIONS=true
SEARCH_MAX_QUERIES_PER_REQUEST=6
SEARCH_MAX_RESULTS_PER_QUERY=10
SEARCH_DEFAULT_CACHE_TTL_SECONDS=3600

AI_MAX_TOOL_CALLS=15
AI_MAX_EXECUTION_SECONDS=120
AI_REQUIRE_APPROVAL_FOR_WRITES=true
AI_REQUIRE_APPROVAL_FOR_PAYMENTS=true
AI_REQUIRE_APPROVAL_FOR_REFUNDS=true
AI_REQUIRE_APPROVAL_FOR_PUBLISHING=true

AI_OUTPUT_SCHEMA_VERSION=1.0
AI_INCLUDE_TEXT_OUTPUT=true
AI_INCLUDE_JSON_OUTPUT=true
AI_INCLUDE_EVIDENCE=true
AI_INCLUDE_ACTIONS=true
AI_INCLUDE_CONFIDENCE=true
```

Platform-level: xAI + Tavily keys. Tenant-level: Shopify/Stripe/etc. via encrypted connector credentials (env today).

## Architectural rules (checklist)

1. xAI is the only AI model provider  
2. Tavily is the only additional public-web retrieval provider  
3. All vendor APIs sit behind normalized capabilities  
4. Every AI response contains text and validated JSON  
5. Live operational claims come from authenticated connectors  
6. Public-web claims retain source provenance  
7. Write actions pass permissions and approval  
8. Every request is tenant-scoped  
9. User sees one AI, not a swarm of agents  
10. Search runs only when the objective needs external information  

## Progressive depth

| Layer | Status |
|-------|--------|
| Gateway `POST /ai/gateway/run` + envelope | **Live** |
| Search Manager intent → policy → Tavily | **Live** |
| Source trust ranking + dedupe | **Live** |
| Capability catalog + executor (read ops from context; writes → approval) | **Live** |
| Tavily Search / Extract / Crawl / Research client | **Live** (Research falls back to search if plan/endpoint unavailable) |
| UI: `/terminal/ai` gateway console (text + JSON cards) | **Live** |
| Full multi-hop Grok native function-calling loop | Progressive (tools schemas exported via `capabilitiesAsXaiTools`) |
| xAI native Web/X tool invocation in agent loop | Progressive (policy records intent; Tavily retrieval primary) |
| AJV full schema validation | Progressive (lightweight server validator today) |
| Per-vendor adapters behind every capability | Progressive (operationalContext + existing connector ops) |

## Frontend contract

```typescript
const res = await fetch('/api/v1/ai/gateway/run', {
  method: 'POST',
  body: JSON.stringify({ objective: '…' }),
});
// Human: res.output.text
// Cards / automation: res.output.json
// Provenance: res.evidence
// Writes: res.actions (requiresApproval)
```

Related: [TRADEOPS_XAI_CONFIGURATION.md](./TRADEOPS_XAI_CONFIGURATION.md), [TRADEOPS_API_KEYS_CATALOG.md](./TRADEOPS_API_KEYS_CATALOG.md).
