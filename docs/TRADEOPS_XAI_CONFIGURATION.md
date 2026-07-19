# TradeOps xAI Configuration

**Status:** Operational — xAI-first free-form AI + RAG grounding  
**Provider:** SpaceXAI / xAI Grok (`api.x.ai`)  
**Key env:** `XAI_API_KEY` (server only)

## Principle

> **Tools + RAG own truth. xAI owns language.**  
> Grok narrates and reasons over retrieved org knowledge and tool outputs.  
> It never replaces approvals or invents live marketplace success.

## Setup

1. Create a key at [console.x.ai](https://console.x.ai).  
2. Put it in server `.env` (never `NEXT_PUBLIC_*`):

```env
XAI_API_KEY=xai-...
XAI_BASE_URL=https://api.x.ai/v1
XAI_CHAT_MODEL=grok-4.5
TRADEOPS_AI_MODE=auto
TRADEOPS_AI_DEFAULT_GENERATE=1
```

3. Restart API (`pnpm start`).  
4. Open `/terminal/ai` → **xAI status** → **Probe xAI**.  
5. **Train / reindex** RAG → **Query knowledge** (Grok answers when hits exist).

## Modes (`TRADEOPS_AI_MODE`)

| Mode | Behavior |
|------|----------|
| `auto` | Key present → `xai_rag`; else `tools_only` |
| `tools_only` | No free-form LLM |
| `xai_rag` | RAG retrieve → Grok complete |
| `xai_rag_tools` | Operator tools + package → Grok synthesis |
| `xai_disabled` | Force offline even if key is set |

## APIs

| Path | Purpose |
|------|---------|
| `GET /ai/status` | Public xAI config + RAG train state (no secrets) |
| `POST /ai/xai/probe` | Live connectivity check |
| `POST /ai/rag/query` | Retrieve + optional Grok (default generate when mode allows) |
| `POST /ai/rag/train` | Rebuild index; tries xAI embeddings when allowed |
| `POST /ai/operator/run` / `navigator/resolve` | Package + optional xAI synthesis |

## Package map

| Piece | Location |
|-------|----------|
| Config helpers | `packages/config/src/xai-config.ts` |
| Client | `packages/ai-runtime/src/llm-client.ts` |
| RAG service | `apps/api/src/ai/rag.service.ts` |
| Operator synthesis | `AiOperatorService.resolveObjective` |

## Classifiers (rules + optional Grok)

| Classifier | API / tool | Notes |
|------------|------------|--------|
| Artifact purpose / type | analyze artifact + `classifyArtifactPurpose` | Proposal only |
| Artifact content heuristics | `POST …/artifacts/:id/analyze` | Hybrid when xAI on |
| Product category | `POST …/products/:id/classify` | Does not auto-write DB |
| Objective intent | tool `classifyObjectiveIntent` | Routes research vs publish |

Policy **blocked** outcomes stay rule fail-closed — Grok never unblocks weapons/etc.

## Honesty

- No key / disabled → tools + local RAG only.  
- No RAG hits → **no free-form answer** (refuses hallucination).  
- Fixture chunks labeled.  
- Not GPU fine-tuning of Grok weights.  
- All classifications: `proposal: true`, `humanReviewRequired: true`.

## Docs

- [TRADEOPS_RAG_ENGINE.md](./TRADEOPS_RAG_ENGINE.md)  
- [TRADEOPS_AI_OPERATING_MODEL.md](./TRADEOPS_AI_OPERATING_MODEL.md)  
