# TradeOps Data Model

> Prisma schema under `packages/database/prisma` implements the local slice of this model. (canonical)

All money fields: **integer minor units** + `currency` (ISO 4217).  
Timestamps: UTC `timestamptz`.

## Identity (existing)

Organization, User, Membership, Session, AuditEvent

## Connectors

- `ConnectorInstallation` — org-scoped install, status, family, provider key  
- External IDs stored on entities as `sourcePlatform` + `externalId`

## Catalog & supply

- Product, ProductVariant  
- Supplier, SupplierOffer  
- SalesChannel, Listing  
- **ProductArtifact** — first-class media/docs/3D on the Product Digital Twin  

## Intelligence

- Opportunity (scores + components JSON)  
- CommerceSignal  
- DemandForecast  
- PolicyAssessment  

## Commerce process spine

- **CommerceCase** — one opportunity journey per org product  
  - `currentStage` / `stageStatus`  
  - next action + blocker fields  
  - listing draft / published listing refs  
  - stage history JSON  
- Tasks/blockers are **derived** from cases (see `process-tasks.ts`)  

## Execution

- CustomerOrder, CustomerOrderLine  
- SupplierPurchaseOrder  
- Fulfillment  
- Approval  
- SimulationRun  
- ProfitabilitySnapshot  
- PredictionOutcome  

## Provenance (every external-sourced row)

sourcePlatform, externalId, collectedAt, dataFreshnessAt, dataConfidence (0–1), schemaVersion  

See also: [TRADEOPS_PRODUCT_ARTIFACT_MODEL.md](./TRADEOPS_PRODUCT_ARTIFACT_MODEL.md), [TRADEOPS_COMMERCE_CASE_MODEL.md](./TRADEOPS_COMMERCE_CASE_MODEL.md)
