# Commerce Campaign Lifecycle

## States

```text
draft → under_review → legal_review_required → approved
→ open → funding → funded → active → paused?
→ reconciling → completed | failed | cancelled
```

## Mapping to commerce process

```text
Discover → Evaluate → Qualify
→ Campaign Review → Funding
→ Prepare → Purchase → Publish → Sell → Fulfill
→ Reconcile → Distribute → Learn
```

Campaigns should reference real `Product`, `Supplier`, orders, payments, ads, inventory — not a parallel fictional economy.

## Commitment states

`initiated` → verification/documents/payment_pending → `funded` | `cancelled` → `returned` | `distributed`

**Rule:** do not show `funded` / `paid` / `distributed` without verified provider evidence (sandbox may simulate with labels only).

## Disbursement states

`proposed` → `approval_required` → `approved` → `processing` → `paid` | `failed` → `reconciled`
