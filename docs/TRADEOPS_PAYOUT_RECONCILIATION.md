# TradeOps Payout Reconciliation

## Goal

```text
Marketplace / processor payout
→ ingest payout
→ (optional) settlement lines
→ match captures, refunds, fees
→ compare expected vs actual net
→ flag variance
→ support realized profit
```

## Current implementation

`CommercePaymentService.createPayoutAndReconcile` (fixture/demo path):

1. Load org commerce payments in terminal statuses  
2. Gross = sum captured  
3. Fees = sum feeAmount  
4. Refunds = sum refunded  
5. Expected net = gross − fees − refunds  
6. Upsert `CommercePayout`  
7. Create `PaymentReconciliation` with `summaryJson`:

```json
{
  "grossSalesMinor": 0,
  "refundsMinor": 0,
  "processorFeesMinor": 0,
  "marketplaceFeesMinor": 0,
  "netPayoutMinor": 0,
  "unmatchedAmountMinor": 0
}
```

8. Status `matched` if variance 0 else `variance`  
9. Audit `commerce.payout.reconciled`

## UI display

`/terminal/finance/reconciliation` shows:

- Gross sales  
- Refunds  
- Processor fees  
- Marketplace fees  
- Expected / actual net  
- Variance  
- Unmatched amount  

## Realized profit

Contribution and realized profit must subtract:

- Processor / marketplace fees  
- Refunds  
- Supplier COGS (from purchase orders)  
- Shipping adjustments when known  

Cash flow page remains separate from SaaS invoices.

## Future: SettlementLine

Per-line settlement matching (order id, fee type, reserve, tax) can land as first-class rows. Until then, summary aggregates + unmatched amount flag variance.
