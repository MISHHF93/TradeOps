# Event Flow

**Normative execution model:** `EVENT_DRIVEN_EXECUTION.md`

## Transport

`EventFabricService` → `CommerceEvent` table (tenant-scoped).

Domain metadata nested under `payloadJson._domain`:

- schemaVersion, entityId, entityType  
- correlationId, causationId, traceId  
- dataMode, source, occurredAt  
- workflowRunId, aiRunId, stepId, caseId (when applicable)

## Rule

Every **meaningful action** is a **workflow step transition** that **emits a domain event**.  
SSE / UI progress is a **projection** of those events — not the audit log.

## Standard events (core)

ProductDiscovered, ProductEvaluated, CommerceCaseAdvanced, ApprovalRequested, ApprovalDecided, ListingPrepared, ListingPublished, OrderReceived, PaymentVerified, SupplierOrderPrepared, ShipmentCreated, ShipmentUpdated, ReconciliationCompleted, PredictionEvaluated, ConnectorHealthChanged, AIObjectiveStarted, AIObjectiveCompleted, ToolExecutionFailed.

## Workflow + AI completeness (target)

WorkflowRunStarted/Completed/Failed/AwaitingApproval/Resumed, WorkflowStepStarted/Completed/Failed/DeadLettered, AiObjectiveClassified, EvidenceRetrieved, ToolExecutionCompleted, AiValidationCompleted, AiBriefingSynthesized, AiArtifactMaterialized, CapabilityInvoked.

## Idempotency

Unique `(organizationId, providerKey, externalEventId)` on CommerceEvent.  
Step attempts: stable externalEventId per `(workflowRunId, stepId, attempt)`.

Webhooks: `WebhookReceipt` + processing status / DLQ path.

## Consumers

- Ops connector health UI  
- Case / run audit and replay (read-only)  
- Workflow resume (ApprovalDecided)  
- AI prior knowledge from **events + artifacts**, not planJson alone  
- Identity AuditService for auth/RBAC only  
