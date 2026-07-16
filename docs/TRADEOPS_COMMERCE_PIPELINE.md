# TradeOps Commerce Pipeline

> Local runtime: stages are live on `/terminal/pipeline`. Fill with `pnpm run demo:loop`.

Canonical loop (operational recommendations for physical products — **not** investment advice):

```
Market data
   ↓
Product normalization
   ↓
Demand and profitability forecast
   ↓
BUY / SELL / HOLD / EXIT signal  (+ SCALE / REDUCE / BLOCKED)
   ↓
Simulation
   ↓
Human approval
   ↓
Marketplace listing
   ↓
Customer order
   ↓
Supplier purchase order
   ↓
Fulfillment
   ↓
Actual profit
   ↓
Prediction evaluation and model improvement
```

## Implementation map

| Stage | Code / API |
|-------|------------|
| Market data | Fixture/live connectors · `POST /commerce/import/fixture-supplier` |
| Normalize | Canonical `Product`, `Supplier`, `SupplierOffer` |
| Forecast | `baseline-ma-v1` + unit economics in `@tradeops/commerce-engine` |
| Signal | `decideSignal` → `CommerceSignal` / Opportunity.currentSignal |
| Simulation | `POST /products/:id/simulate` → `SimulationRun` |
| Approval | `GET/POST /approvals` — required before publish / PO send |
| Listing | Listing draft → approve → fixture/live publish |
| Customer order | `POST /orders/ingest/fixture` or connector `readOrders` |
| Supplier PO | Draft PO + approval |
| Fulfillment | Status progression · `POST /orders/:id/complete-fulfillment` |
| Actual profit | `realizedContributionProfitMinor` + profitability snapshot |
| Evaluation | `POST /terminal/evaluate` · `PredictionOutcome` · `ModelVersion` metrics |

## UI

`/terminal/pipeline` — live stage board + outcome table + evaluate action.

## Model improvement policy

1. Collect outcomes (simulation or fulfilled orders).  
2. Compute MAE (units, profit), bias, optional signal hit rate.  
3. Store metrics on `ModelVersion`.  
4. Only promote a new model family when backtests beat baseline on held-out outcomes (not implemented as auto-switch — human decision).
