# TradeOps Multimodal AI (Product Artifacts)

**Status:** Planned / partial hooks  

## Intent

AI may evaluate product artifacts and propose attributes for the Digital Twin. All inferences are **proposals**, not ground truth.

## Image proposals (when wired)

- Visible product type, color, packaging, text OCR, quality score, listing suitability, near-duplicate hints

## Video proposals

- Demonstrated use case, duration suitability, policy concerns

## Document proposals

- Document type, specs, warnings, warranty terms, language, effective/expiry dates

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

## Current product behavior

- Completeness + channel readiness are rule-based (not LLM).
- AI operator can reference product context; dedicated multimodal artifact evaluation jobs are incomplete.
- Never auto-publish AI-generated listing assets without rights lineage and approval.
