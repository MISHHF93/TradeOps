# TradeOps Commerce Pipeline

> **Primary UI:** `/terminal/process` (Commerce Process board)  
> Legacy `/terminal/pipeline` **redirects** to Process.  
> Fill fixture loop: `pnpm run demo:loop`

TradeOps is one **operating procedure**, not a stack of independent dashboards. The navigational spine is `CommerceCase`.

## Canonical lifecycle (operational)

```text
Discover → Evaluate → Qualify → Prepare → Approve → Publish
→ Sell → Source → Fulfill → Reconcile → Learn → Closed
```

| Stage | Meaning | Primary surface |
|-------|---------|-----------------|
| Discover | Import / find candidates | `/terminal` |
| Evaluate | Score, margin, risk | Opportunities + product twin |
| Qualify | Policy decision | Journey handoff |
| Prepare | Draft listing, media, plan | Product twin + Listings |
| Approve | Human decision | `/terminal/approvals` |
| Publish | External listing | Listings / connectors (credential-gated) |
| Sell | Customer orders | `/terminal/orders` |
| Source | Supplier PO | Orders |
| Fulfill | Tracking / delivery | `/terminal/fulfillment` |
| Reconcile | Realized P&L | Journey |
| Learn | Prediction vs actual | Journey |

## Implementation map

| Concern | Code / API |
|---------|------------|
| Case spine | `CommerceCase` · `GET /commerce/process` · `GET /commerce/cases/:id` |
| Stage engine | `@tradeops/commerce-engine` `commerce-lifecycle.ts` |
| Next action / tasks | `computeNextAction` · `GET /commerce/tasks` |
| Market data | Fixture/live connectors · `POST /commerce/import/fixture-supplier` |
| Normalize | Canonical `Product`, `Supplier`, `SupplierOffer` |
| Forecast / score / policy | `@tradeops/commerce-engine` |
| Artifacts | `ProductArtifact` · `/products/:id/artifacts` |
| Approval | `GET/POST /approvals` |
| Listing draft | `POST /products/:id/listing-draft` (+ media plan) |
| Orders / PO / fulfill | orders APIs |
| Evaluation outcomes | `POST /terminal/evaluate` · `PredictionOutcome` |

## Legacy pipeline stages

Older aggregate counts (market_data → actual_profit) still exist in `PIPELINE_STAGES` for outcome evaluation. Prefer **CommerceCase stages** for operator UX.

## Model improvement policy

1. Collect outcomes (simulation or fulfilled orders).  
2. Compute MAE (units, profit), bias, optional signal hit rate.  
3. Store metrics on `ModelVersion`.  
4. Promote models only with human decision after backtests beat baseline.
