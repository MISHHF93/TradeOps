# TradeOps RAG Engine

**Status:** Operational (artifacts + CSV + hybrid dense) — 2026-07-17  
**Also called:** “rack / rug engine” in conversation — **RAG** = Retrieval-Augmented Generation.

## What “train the LLM” means here

| Path | What it is | Status |
|------|------------|--------|
| **RAG train** | Re-index products, **artifacts**, cases, AI runs, connectors, SOPs | **Shipped** |
| **Artifact CSV** | Export to repo-root `artifacts-corpus.csv` | **Shipped** |
| **Hybrid dense** | Local hashing dense + TF-IDF; optional xAI embeddings when key set | **Shipped** |
| **Grounded LLM** | Free-form answer via **xAI Grok** over retrieved context | **Primary when key set** (`auto` → `xai_rag`) |
| **GPU fine-tuning** | Update foundation model weights | **Out of scope** |

## Corpus sources

- Products, opportunities, commerce cases, operator runs  
- **ProductArtifact** text metadata (title, alt, description, type, purpose, rights)  
- Connectors, SOPs  

Binary media files are **not** embedded — only text metadata (storage keys as references).

## CSV capture

| File | Purpose |
|------|---------|
| `artifacts-corpus.sample.csv` | Committed sample schema + fixture row |
| `artifacts-corpus.csv` | Runtime export at **repo root** (gitignored) |

```http
POST /api/v1/ai/rag/export-csv
POST /api/v1/ai/rag/train   # also refreshes CSV
```

CLI: `node scripts/export-artifact-corpus.mjs` (API must be running).

## Architecture

```text
Canonical store (+ ProductArtifact)
        ↓  export-csv / train
  artifacts-corpus.csv (repo root)
        ↓
  Chunk → TF-IDF + local dense (+ optional xAI dense)
        ↓
  Org index (.tradeops-storage/rag/{orgId}.json)
        ↓
  query · navigator ground · AI tools
```

## APIs

| Method | Path |
|--------|------|
| GET | `/ai/rag/status` |
| POST | `/ai/rag/train` |
| POST | `/ai/rag/export-csv` |
| POST | `/ai/rag/query` |
| POST | `/ai/intelligence/rebuild` |

## Honesty

- Empty hits → empty results, not invented knowledge  
- Fixture artifacts labeled `TEST FIXTURE` / `dataClass=fixture`  
- Dense hybrid is not a foundation-model embedding unless xAI returns vectors  
- No GPU fine-tuning claims  

See also [TRADEOPS_PREDICTIVE_ENGINE.md](./TRADEOPS_PREDICTIVE_ENGINE.md).
