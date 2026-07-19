# TradeOps Multimodal AI (Product Artifacts)

**Status:** Operational foundations — rules + optional xAI Grok enrichment  

## Intent

AI may evaluate product artifacts and propose attributes for the Digital Twin. All inferences are **proposals**, not ground truth.

## Pipeline

```text
Artifact metadata (+ optional text sample)
        ↓
Rule classifiers (purpose, type, image/doc heuristics)
        ↓  when XAI_API_KEY + TRADEOPS_AI_MODE allow
xAI Grok enrichment (JSON proposals)
        ↓
metadataJson.lastAnalysis / lastPurposeClassification
```

## Image / video / document proposals

| Kind | Rules | xAI enrich |
|------|-------|------------|
| Image quality, suitability, type clues | Yes | Optional text narrative (not pixel vision yet) |
| Video duration / policy text flags | Yes | Optional |
| Document type (manual/warranty/spec) | Yes | Optional |
| Purpose (primary, gallery, warranty, …) | Yes | Optional |
| Product category | Yes | Optional |

## Required metadata on every extraction

```json
{
  "sourceArtifactId": "uuid",
  "model": "…",
  "confidence": 0.0,
  "proposal": true,
  "humanReviewRequired": true
}
```

## APIs

| Method | Path |
|--------|------|
| POST | `/api/v1/products/:productId/artifacts/:artifactId/analyze` |
| POST | `/api/v1/products/:productId/classify` |

## AI tools

- `classifyArtifactPurpose`
- `classifyProductCategory`
- `classifyObjectiveIntent`

## Honesty

- Never auto-publish AI-generated listing assets without rights + approval  
- Policy **blocks** remain rule fail-closed (xAI does not override blocks)  
- Without xAI: rules-only proposals still run  
- Vision LLM on raw image bytes is still **not** shipped (text/metadata only)

See [TRADEOPS_XAI_CONFIGURATION.md](./TRADEOPS_XAI_CONFIGURATION.md).
