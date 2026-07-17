# TradeOps RAG Engine

**Status:** Operational foundations (2026-07-17)  
**Also called:** “rack engine” in conversation — **RAG** = Retrieval-Augmented Generation.

## What “train the LLM” means here

| Path | What it is | Status |
|------|------------|--------|
| **RAG train** | Re-index org products, cases, AI runs, connectors, SOPs into a sparse TF-IDF index | **Shipped** |
| **RAG query** | Retrieve top-k chunks for a question/objective | **Shipped** |
| **Grounded LLM** | Optional free-form answer via SpaceXAI/xAI using retrieved context | **Shipped** (needs `XAI_API_KEY`) |
| **GPU fine-tuning** | Update foundation model weights on GPUs | **Out of scope** for local monorepo |

Continuous retrieval training is the correct product path for a multi-tenant commerce OS: each org’s knowledge is private, updatable, and never confuses fixture data with live marketplace truth.

## Architecture

```text
Canonical store (products, cases, runs, connectors)
        ↓  POST /ai/rag/train
  Chunk → TF-IDF embed → org index (.tradeops-storage/rag/{orgId}.json)
        ↓  POST /ai/rag/query  or  navigator resolve
  Retrieve top-k → grounded context
        ↓  optional (XAI_API_KEY)
  SpaceXAI chat completion (grok-4.5)
```

### Packages / services

| Piece | Path |
|-------|------|
| Core index + retrieve | `packages/ai-runtime/src/rag-engine.ts` |
| xAI client | `packages/ai-runtime/src/llm-client.ts` |
| API train/query | `apps/api/src/ai/rag.service.ts` |
| HTTP | `GET /ai/rag/status`, `POST /ai/rag/train`, `POST /ai/rag/query` |
| Navigator grounding | `AiOperatorService.resolveObjective` auto-trains/retrieves |
| Tools | `trainRagIndex`, `queryRagKnowledge` |
| UI | `/terminal/ai` → **RAG Engine** panel |

## Honesty rules

- Empty index / empty hits → empty results, **not** fabricated knowledge.
- Fixture chunks are labeled `TEST FIXTURE`.
- TF-IDF is **not** a neural embedding model (`rag-tfidf-v1`).
- LLM answers are refused when `XAI_API_KEY` is missing (retrieval still works).
- Train never claims “the model learned live marketplace skill” without credentials.

## Local usage

```powershell
# 1) Start stack
pnpm start

# 2) Open http://localhost:3000/terminal/ai
#    → Train / reindex
#    → Query knowledge

# 3) Optional free-form grounding
# set XAI_API_KEY=... in .env (server only)
```

API:

```http
POST /api/v1/ai/rag/train
POST /api/v1/ai/rag/query
Content-Type: application/json

{ "query": "best margin products for Canada", "generate": false }
```

## Residual / next upgrades

1. Dense embeddings (OpenAI/xAI embedding API) when key present — keep TF-IDF fallback  
2. Prisma `KnowledgeChunk` table for multi-node deployments  
3. Incremental reindex on product import / operator run complete  
4. Feedback loop: promote operator knowledge deltas into weighted docs  
5. True fine-tuning only if a dedicated training environment is funded  

## Principle

> TradeOps owns **org knowledge + retrieval + governance**.  
> Foundation model providers own **general language weights**.  
> Merchants own **business decisions**.
