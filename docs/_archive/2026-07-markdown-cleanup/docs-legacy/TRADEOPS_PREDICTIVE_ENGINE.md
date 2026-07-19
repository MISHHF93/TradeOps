# Predictive Commerce Engine

> Baseline MA forecasts + evaluation are REAL; neural upgrade remains STUB.

## Philosophy

Estimate opportunity; do not pretend certainty. Separate:

- Observed facts  
- Derived metrics  
- Model predictions  
- Business rules  
- Missing data  
- Uncertainty  

## Baselines (v1)

| Target | Method |
|--------|--------|
| Demand 7/14/30d | Moving average of recent unit observations + seasonal day-of-week factor |
| Expected revenue / profit | Demand × price − costs (profit engine) |
| Confidence | Data completeness × freshness × sample size |
| Anomalies | Z-score style deviation on price/cost |

Model version string: `baseline-ma-v1`

## Outputs

Every forecast includes: value, confidence, interval (simple), factors, missingSignals, modelVersion, timestamp, plainLanguageExplanation.
