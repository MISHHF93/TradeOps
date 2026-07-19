# Domain Object Ownership

| Object | Primary owner | Lifecycle link | Persona primary |
|--------|---------------|----------------|-----------------|
| CommerceCase | organization | **spine** (primary orchestration object) | operator |
| Product | organization | case productId | researcher |
| Supplier / Offer | organization | case suppliers panel | operator |
| Listing | organization | case prepare/publish | operator |
| Approval | organization | case approve | executive |
| CustomerOrder | organization | case sell/source | operator |
| Fulfillment / Shipment | organization | case fulfill | operator |
| CommercePayment / Payout | organization | case reconcile | operator |
| OperatorRun / AI Run | organization | **child of Case** when commerce-applicable; org-only for SaaS/ops | all |
| AI Artifact | **Commerce Case** (process-relevant) + run producer ref | case artifact set | all |
| ConnectorInstallation | organization | ops | developer |
| BillingSubscription | organization | SaaS only | administrator |

**Rules:**

1. No orphan product without a Commerce Case after sync. Pages are views of these owners.  
2. Commerce Case is the primary orchestration object for commerce work — not AI Runs.  
3. AI Runs are execution/audit records: `case` | `multi_case` | `org_non_commerce` binding.  
4. Process-relevant AI artifacts attach to the Case; the run records production metadata.  

See `COMMERCE_CASE_AI_ORCHESTRATION.md` for workflow-by-workflow ownership.  
See `AI_OUTPUT_OWNERSHIP.md` for every AI output → BO vs artifact, and how KG / Data Fabric update without duplicate ownership.
