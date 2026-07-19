# Predictive Commerce Engine

**Status:** Operational foundations (`prediction-engine-v1`) — 2026-07-17  

> Baseline MA demand + unit economics + transparent outcome bias fit are REAL.  
> Neural/deep demand models remain **STUB / out of scope** for this monorepo.

## Philosophy

Estimate opportunity; do not pretend certainty. Separate:

- Observed facts  
- Derived metrics  
- Model predictions  
- Business rules  
- Missing data  
- Uncertainty  

## Models

| Version | Method |
|---------|--------|
| `baseline-ma-v2` | SMA × day-of-week × half-window trend (demand units) |
| `prediction-engine-v1` | baseline demand × unit economics × signal rules |
| `prediction-engine-v1+bias` | after ≥3 outcomes: unitBias + profitBiasPerUnit fit |

## Train / run / evaluate

| API | Action |
|-----|--------|
| `GET /ai/prediction/status` | Active ModelVersion + outcome counts |
| `POST /ai/prediction/train` | Fit weights from PredictionOutcome + SimulationRun actuals |
| `POST /ai/prediction/run` | Batch or single product; writes DemandForecast |
| `POST /ai/prediction/evaluate` | MAE / bias / signal hit rate |
| `POST /ai/prediction/export-csv` | Repo-root `predictions.csv` (gitignored) |

Full rebuild: `POST /ai/intelligence/rebuild` or `node scripts/rebuild-intelligence.mjs`.

## Features used

- Price / cost stack (integer minor units)  
- Opportunity score, policy outcome, listing state  
- **Artifact readiness** (ready/published media ratio)  
- Order-line daily units when present; else simulation runs  

## Outputs

Every forecast includes: expected units, band, contribution profit, signal, confidence, factors, missingSignals, modelVersion, explanation, fixture label.

## Honesty

- No sales history → **0 units**, low confidence, `missingSignals` includes `sales_history`  
- Fixtures labeled — never presented as live marketplace demand  
- Bias fit is transparent (unitBias / profitBiasPerUnit), not a black-box neural net  

## UI

`/terminal/ai` → **Prediction Engine** panel.
