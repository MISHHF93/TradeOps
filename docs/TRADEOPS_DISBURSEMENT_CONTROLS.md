# Disbursement Controls

## Purpose-restricted budget lines

- inventory  
- advertising  
- fulfillment  
- duties  
- operating_reserve  
- platform_fees  
- merchant_expense  

## Required for every disbursement

1. Campaign  
2. Budget line within remaining capacity  
3. Purpose + evidence JSON  
4. Recipient type (prefer supplier / advertising / logistics over unrestricted merchant cash)  
5. Idempotency key  
6. Approval policy (`approval_required` default)  
7. Provider payment reference before live `paid`  
8. Audit event  
9. Ledger journal when paid (sandbox or live)  

## Overrun

Server rejects when sum(open+paid disbursements on line) + new amount > line budget.
