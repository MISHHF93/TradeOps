# TradeOps Commerce Lifecycle

**Status:** Operational foundations  
**Date:** 2026-07-16  

## Canonical process

```text
Discover → Evaluate → Qualify → Prepare → Approve → Publish → Sell → Source → Fulfill → Reconcile → Learn → Closed
```

TradeOps is one operating procedure. Pages are **views into stages and shared resources**, not independent apps.

| Stage | Meaning | Primary UI |
|-------|---------|------------|
| Discover | Import / find candidates | `/terminal` (scanner) |
| Evaluate | Score, margin, risk | Opportunities + product twin |
| Qualify | Policy decision | Case journey handoff |
| Prepare | Listing draft, media, plan | Product twin + artifacts |
| Approve | Human decision | `/terminal/approvals` |
| Publish | External listing | Connector-gated |
| Sell | Customer orders | `/terminal/orders` |
| Source | Supplier PO | Orders / PO |
| Fulfill | Tracking / delivery | Orders |
| Reconcile | Realized P&L | Case journey |
| Learn | Prediction vs actual | Case journey |

## Spine entity

`CommerceCase` — one row per org product opportunity. See [TRADEOPS_COMMERCE_CASE_MODEL.md](./TRADEOPS_COMMERCE_CASE_MODEL.md).

## APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/commerce/process` | Stage board + cases |
| POST | `/api/v1/commerce/process/sync` | Re-infer from live records |
| GET | `/api/v1/commerce/process/terminal-summary` | Terminal control center |
| GET | `/api/v1/commerce/cases/:id` | Product journey |
| POST | `/api/v1/commerce/cases/:id/advance` | Validated stage transition |

## UI

- `/terminal/process` — Commerce Process board  
- `/terminal/process/[caseId]` — Product Journey  
- `/terminal/cockpit` — process control center (urgent work + stage counts)  

## Honesty

Legacy routes (pipeline, control-tower, signals) remain as aliases/views until fully retired; nav is process-first and shorter.
