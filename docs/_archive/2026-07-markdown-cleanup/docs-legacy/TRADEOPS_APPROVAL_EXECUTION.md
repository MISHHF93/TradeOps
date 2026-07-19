# Approval → Execution

## When approvals are created

| Action | Approval |
| --- | --- |
| Research / score / recommend | **None** |
| Listing draft | **None** (status `draft`) |
| Publish listing | `publish_listing` pending |
| Supplier PO submit | `supplier_purchase_order` pending |

## Loop

```text
Propose → Approval row → Approve/Reject → on approve execute connector path → listing active / PO paid → audit
```

## UI

`ApprovalActionCell`: pending → Approve|Reject|Review; approved → View result; rejected → reason.

## Idempotency

One pending/approved `publish_listing` per listing (findFirst before create).
