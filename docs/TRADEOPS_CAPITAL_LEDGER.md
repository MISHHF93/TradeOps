# Capital Ledger

## Principles

1. **Double-entry** — every journal balances (debits = credits).  
2. **Append-oriented** — application does not rewrite historical lines.  
3. **Balances are derived** from `CapitalLedgerEntry` — do not trust a lone mutable balance column.  
4. **Idempotency** — `(organizationId, idempotencyKey)` unique.  

## Example funding journal

```text
Dr cash_safeguarded
Cr capital_liability
```

## Example disbursement journal

```text
Dr expense_<budget_line>
Cr cash_safeguarded
```

## Helpers

`apps/api/src/capital/capital-ledger.ts` — pure journal builders + `assertJournalBalanced` + `deriveBalances`.
