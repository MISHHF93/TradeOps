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

## Intelligence

- Opportunity (scores + components JSON)  
- CommerceSignal  
- DemandForecast  
- PolicyAssessment  

## Execution

- CustomerOrder, CustomerOrderLine  
- SupplierPurchaseOrder  
- Fulfillment  
- Approval  
- SimulationRun  
- ProfitabilitySnapshot  

## Provenance (every external-sourced row)

sourcePlatform, externalId, collectedAt, dataFreshnessAt, dataConfidence (0–1), schemaVersion
