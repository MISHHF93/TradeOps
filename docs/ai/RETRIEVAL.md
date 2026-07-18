# Internal Retrieval

```text
Query → Cohere Embed → tenant documents → Cohere Rerank → top evidence → synthesis
```

## Engine

`getRetrievalEngine()` — Cohere when `COHERE_API_KEY` + `COHERE_RETRIEVAL_ENABLED=true`, else local lexical fallback.

## Models

```dotenv
COHERE_EMBED_MODEL=embed-v4.0
COHERE_RERANK_MODEL=rerank-v3.5
```

## Tenant scope

- Documents are supplied per-request from tenant-scoped services (`knowledgeDocuments` / operational context)
- Tenant ID always comes from server auth, never the browser
- Do not rely on prompts for isolation

## Multilingual notes

- Preserve OEM / SKU / GTIN / part numbers exactly (never translate identifiers)
- Semantic similarity alone must not assert vehicle/product compatibility

## Code

- `packages/ai-runtime/src/retrieval-engine.ts`
- `packages/ai-runtime/src/cohere-client.ts`
- `packages/ai-runtime/src/provider/cohere-provider.ts` (embed/rerank)
