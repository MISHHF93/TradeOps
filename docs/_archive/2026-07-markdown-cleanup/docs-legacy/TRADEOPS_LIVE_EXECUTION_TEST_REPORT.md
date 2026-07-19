# Live Execution Test Report

**Date:** 2026-07-16

## Unit — `@tradeops/ai-runtime`

```
✔ classifies research objective as READ_ONLY_ANALYSIS without approval
✔ parses Canada / $20 cost / 25% margin / three products objective
✔ classifies publish objective as requiring approval
✔ parses margin and review filters
✔ tools registered
✔ read-only evaluate returns ranked products without approval
✔ draft listing path weapon blocked
✔ empty product store message
✔ (live-examples module typechecks via package build)
```

## Live smoke (founder stack) — 2026-07-16

```
POST .../canadian-product-opportunity-scan/run
→ type=READ_ONLY_ANALYSIS approvalRequired=false recs=3

POST .../supplier-comparison-listing-draft/run
→ listingDraft.status=draft channel=fixture-marketplace

POST .../approved-listing-publication/run
→ approval.status=pending resultsPath=/terminal/approvals

POST .../customer-order-supplier-fulfillment/run
→ approvalRequired=true (PO path; seeds TEST FIXTURE orders if empty)

GET /terminal/live-examples → 200
```

## Production build

- `pnpm --filter @tradeops/ai-runtime test` — 9 pass  
- `pnpm --filter @tradeops/api build` — pass  
- `pnpm --filter @tradeops/web build` — pass  

## Not claimed

- Live Google/Shopify OAuth publish without credentials  
- Scheduled margin protection worker (`runnable: false`)  
- Multi-hour durable worker across process death (OperatorRun persists; execution is still request-scoped)  
- Fixture product store is **not** live marketplace data (labeled TEST FIXTURE)  
