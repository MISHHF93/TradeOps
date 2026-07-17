# Commerce Runtime

## Principle

TradeOps is an **AI Commerce Operating System**. The unit of work is not a page — it is an **executing process**.

Every surface must answer: **What process is currently executing?**

## Heart of the platform

`CommerceRuntimeService` + pure engine `@tradeops/commerce-engine` (`commerce-runtime.ts`).

| Responsibility | Implementation |
|----------------|----------------|
| Process orchestration | Runtime snapshot + Process board |
| State machines | `OBJECT_FSMS` (case, listing, order, approval, …) |
| Transformations | `COMMERCE_TRANSFORMATIONS` + `planRuntimeExecution` / `execute` |
| AI orchestration | Runtime preamble + operator tools |
| Connector capabilities | `capabilityBoard` → business capabilities |
| Friction | `commerce-friction` inside state vector |
| Events | `EventFabricService` + `CommerceEvent` |
| Persona | Workspace resolver (same cases, different view) |

## APIs

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/commerce/runtime` | Org: what is executing |
| GET | `/api/v1/commerce/runtime/cases/:id` | Case runtime snapshot |
| POST | `/api/v1/commerce/runtime/execute` | Apply transformation (only write path) |
| GET | `/api/v1/commerce/runtime/events` | Event history |
| GET | `/api/v1/commerce/runtime/capabilities` | Capability providers |

Legacy `POST .../cases/:id/transform` **delegates to Runtime.execute**.

## Event types (immutable business history)

`CommerceCaseCreated`, `TransformationApplied`, `SupplierMatched`, `ApprovalRequested`, `ListingPublished`, `FrictionReduced`, …

## UI

- Process board shows **RuntimeBanner** (`answer` + active process + next transform).
- Case state panel applies steps via `/commerce/runtime/execute`.

## Honesty

- Fixture connectors are labeled; they never count as live marketplaces.
- Live publish still requires credentials + approval.
- Runtime does not invent RF math; friction is business-domain heuristics.
