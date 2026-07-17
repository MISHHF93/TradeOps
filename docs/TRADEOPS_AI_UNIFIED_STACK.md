# TradeOps AI Stack (Retrieval-First + Adapter)

**TradeOps owns orchestration.** Models are pluggable workers — not the platform.

```text
                    TradeOps AI
                         │
                AI Adapter Layer  (generation)
        ┌────────────────┴────────────────┐
        ▼                                 ▼
 OpenAI (primary)              Optional: xAI / Gemini
 generate · structured JSON    · tools · web search
        │
        │          Retrieval Engine (enterprise)
        │                 ▼
        │            Cohere
        │     embed · rerank · classify · RAG
        │
        └────────────────┬────────────────┘
                         ▼
                  Search Manager
         internal (Cohere) + internet (OpenAI web / Tavily)
                         ▼
              Capability Gateway
         commerce · payments · logistics · industrial
                         ▼
           Human text + validated JSON envelope
```

## Why not “one provider does everything”

| Workload | Best fit |
|----------|----------|
| Catalog / RFQ / manual semantic search | **Cohere** (retrieval) |
| Multilingual enterprise embeddings | **Cohere** |
| Classification over commerce intents | **Cohere** |
| Strict JSON + mature agent tool loops | **OpenAI** (generation) |
| Multimodal / creative generation | **OpenAI** |
| Authenticated inventory / payments | **Connectors** (never models) |

Cohere is **not** the entire AI runtime. It is the **retrieval and enterprise search engine**. Generation stays on the AI Adapter (OpenAI primary).

## Responsibilities

| Component | Role |
|-----------|------|
| **AI Adapter** | `generate` / optional `search` — OpenAI primary, swap via `AI_PROVIDER` |
| **Retrieval Engine** | `embed` / `retrieve` / `classify` — Cohere when `COHERE_API_KEY` set |
| **Search Manager** | Policy + route: internal corpus → internet → rank → evidence |
| **Capability Gateway** | Shopify, Stripe, EasyPost, analytics, ERP (authenticated) |
| **Response Layer** | Always `output.text` + `output.json` + evidence + actions |

## Provider interface (conceptual)

```typescript
// Generation runtime
interface AIProvider {
  generate();
  classify();   // may delegate
  search();     // internet, when available
  toolCall();
  stream();
}

// Enterprise retrieval (Cohere-first)
interface RetrievalEngine {
  embed();
  retrieve();
  classify();
  // rerank is internal to Cohere path
}
```

Implementations:

```text
OpenAIProvider | XaiProvider | GeminiProvider   → generation
CohereRetrievalEngine | LocalLexicalEngine    → retrieval
```

## Search Manager pipeline

```text
User Objective
  → Intent Classifier
  → Search Policy
  → Internal Search (Cohere over catalog / manuals / RFQs)
  → Knowledge Graph / connectors (operational)
  → Internet Search (OpenAI web / optional Tavily)
  → Evidence Ranking
  → AI generate (grounded on evidence)
```

The model receives **evidence**, not the job of inventing every source.

## Response envelope

```typescript
type TradeOpsAIResponse<T> = {
  output: { text: string; json: T };
  confidence: number;
  evidence: Evidence[];
  actions: Action[];
  status: 'completed' | 'partial' | 'blocked' | 'failed';
};
```

Frontend always uses this shape — provider swaps do not change UI contracts.

## Environment

```dotenv
# Generation (AI Adapter)
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
OPENAI_WEB_SEARCH_ENABLED=true

# Enterprise retrieval (Cohere) — not sole runtime
COHERE_API_KEY=
COHERE_RETRIEVAL_ENABLED=true
COHERE_EMBED_MODEL=embed-v4.0
COHERE_RERANK_MODEL=rerank-v3.5
COHERE_CHAT_MODEL=command-a-03-2025
SEARCH_PROVIDER_INTERNAL=cohere

# Optional internet retrieval adapter
TAVILY_API_KEY=

# Optional alternate generation
XAI_API_KEY=

AI_RESPONSE_MODE=json_schema
AI_REQUIRE_APPROVAL_FOR_WRITES=true
```

## Code map

| Piece | Path |
|-------|------|
| Platform config | `packages/config/src/ai-platform-config.ts` |
| AI Adapter | `packages/ai-runtime/src/ai-adapter.ts` |
| OpenAI client | `packages/ai-runtime/src/openai-client.ts` |
| Cohere client | `packages/ai-runtime/src/cohere-client.ts` |
| Retrieval Engine | `packages/ai-runtime/src/retrieval-engine.ts` |
| Search Manager | `packages/ai-runtime/src/search-manager.ts` |
| Gateway | `packages/ai-runtime/src/ai-gateway.ts` |
| Envelope | `packages/ai-runtime/src/response-envelope.ts` |

## Architectural rules

1. **TradeOps owns orchestration.**  
2. **Cohere = retrieval** (embed, rerank, classify, RAG) — not the only brain.  
3. **OpenAI = recommended generation** runtime via Adapter.  
4. **Search Manager** centralizes internal + internet evidence.  
5. **Capability Gateway** is the only path to vendor operational APIs.  
6. **Every response** is text + validated JSON + evidence + actions.  
7. **Operational truth** never comes from internet search.  
8. **Writes** require approval.  
9. **Tenant-scoped** requests.  
10. **One user-visible AI.**  

## Progressive

| Item | Status |
|------|--------|
| Cohere embed / rerank / classify client | **Live** |
| Retrieval Engine + lexical fallback | **Live** |
| Search Manager internal + public paths | **Live** |
| Gateway `knowledgeDocuments` input | **Live** |
| Dense index persistence for full RAG train | Progressive (pair with existing TF-IDF RAG) |
| Full multi-hop tool calling | Progressive |
