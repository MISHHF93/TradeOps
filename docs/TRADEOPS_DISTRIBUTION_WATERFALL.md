# Distribution Waterfall

**Version:** `waterfall_v1`  
**Code:** `apps/api/src/capital/distribution-waterfall.ts`

## Sequence

1. Net sales after refunds  
2. Taxes / statutory deductions  
3. Processor + marketplace fees  
4. Supplier + fulfillment + advertising costs  
5. Restore operating reserve  
6. Return capital principal (min of residual, capital funded)  
7. TradeOps fee (bps of residual profit)  
8. Capital profit share (bps — only if model/gate allows)  
9. Merchant residual  

## Rules

- Realized inputs only  
- Deterministic and auditable  
- **No guarantee of returns** (disclaimer on every result)  
- Stored distributions default status `calculated`  
- Execution requires `DISTRIBUTIONS_ENABLED` + approval + provider confirmation  

## API

- `POST /api/v1/capital/waterfall/dry-run`  
- `POST /api/v1/capital/campaigns/:id/distributions/calculate`  
