# TradeOps documentation

**Canonical rule:** One Source of Truth for architecture — start with the AI Runtime blueprint, then ADRs and runbooks. Everything else historical lives under `_archive/`.

---

## Start here

| Doc | Purpose |
|-----|---------|
| [../README.md](../README.md) | Project overview + quick start |
| [FIRST_RUN.md](./FIRST_RUN.md) | First-time boot |
| [TRADEOPS_LOCAL_SETUP.md](./TRADEOPS_LOCAL_SETUP.md) | Local setup (PGlite / Docker) |
| [operations/LOCAL_STACK.md](./operations/LOCAL_STACK.md) | Stack up / supervise / stop |
| [operations/HEALTH_AND_DIAGNOSTICS.md](./operations/HEALTH_AND_DIAGNOSTICS.md) | Health endpoints |

## Product

| Doc | Purpose |
|-----|---------|
| [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md) | What TradeOps is (and is not) |
| [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md) | Product pillars |
| [TRADEOPS_PRODUCT_SPEC.md](./TRADEOPS_PRODUCT_SPEC.md) | Product specification |
| [../projectspec.md](../projectspec.md) | Project specification (root) |

## Architecture (canonical)

| Doc | Purpose |
|-----|---------|
| **[architecture/TRADEOPS_AI_RUNTIME_BLUEPRINT.md](./architecture/TRADEOPS_AI_RUNTIME_BLUEPRINT.md)** | **Definitive normalized AI + COS architecture** |
| [architecture/END_TO_END_RUNTIME.md](./architecture/END_TO_END_RUNTIME.md) | Request path + states |
| [architecture/AI_EXECUTION_FLOW.md](./architecture/AI_EXECUTION_FLOW.md) | AI execution ownership |
| [architecture/DOMAIN_OBJECT_OWNERSHIP.md](./architecture/DOMAIN_OBJECT_OWNERSHIP.md) | BO / Case ownership |
| [architecture/CONTEXTUAL_AI_UX.md](./architecture/CONTEXTUAL_AI_UX.md) | AI is contextual, not a destination |
| [architecture/AI_PRODUCTION_READINESS.md](./architecture/AI_PRODUCTION_READINESS.md) | Production gate |
| [architecture/STACK_AND_AUTOMATION_REVIEW.md](./architecture/STACK_AND_AUTOMATION_REVIEW.md) | Stack utilization + automation |
| [architecture/MILESTONES.md](./architecture/MILESTONES.md) | Milestone status |

### Architecture — planes (detail)

| Doc | Plane |
|-----|-------|
| [architecture/AI_RUNTIME_ARCHITECTURE.md](./architecture/AI_RUNTIME_ARCHITECTURE.md) | One AI Runtime |
| [architecture/COMMERCE_CASE_AI_ORCHESTRATION.md](./architecture/COMMERCE_CASE_AI_ORCHESTRATION.md) | One Commerce Case |
| [architecture/SEARCH_MANAGER_ARCHITECTURE.md](./architecture/SEARCH_MANAGER_ARCHITECTURE.md) | One Search Layer |
| [architecture/CONNECTOR_FABRIC_ARCHITECTURE.md](./architecture/CONNECTOR_FABRIC_ARCHITECTURE.md) | One Connector Fabric |
| [architecture/EVENT_DRIVEN_EXECUTION.md](./architecture/EVENT_DRIVEN_EXECUTION.md) | One Workflow + Event Fabric |
| [architecture/AI_OUTPUT_OWNERSHIP.md](./architecture/AI_OUTPUT_OWNERSHIP.md) | Artifacts vs BOs |
| [architecture/CONNECTOR_FLOW.md](./architecture/CONNECTOR_FLOW.md) | Connector invoke path |
| [architecture/EVENT_FLOW.md](./architecture/EVENT_FLOW.md) | Event fabric summary |
| [architecture/FRONTEND_BACKEND_WIRING.md](./architecture/FRONTEND_BACKEND_WIRING.md) | UI ↔ API matrix |

### ADRs

| ADR | Topic |
|-----|--------|
| [ADR-0001](./architecture/ADR-0001-stack-and-topology.md) | Stack & topology |
| [ADR-0002](./architecture/ADR-0002-connector-isolation.md) | Connector isolation |
| [ADR-0003](./architecture/ADR-0003-tooling-without-native-binaries.md) | Windows App Control tooling |
| [ADR-0004](./architecture/ADR-0004-session-auth.md) | Session auth |

## Operations & access

| Doc | Purpose |
|-----|---------|
| [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md) | founder_direct / authenticated / multi_tenant |
| [TRADEOPS_DIRECT_FOUNDER_ACCESS.md](./TRADEOPS_DIRECT_FOUNDER_ACCESS.md) | Founder-direct mode |
| [TRADEOPS_SECURITY_MODEL.md](./TRADEOPS_SECURITY_MODEL.md) | Security model |
| [TRADEOPS_DEPLOYMENT.md](./TRADEOPS_DEPLOYMENT.md) | Deploy notes |
| [WINDOWS_APP_CONTROL.md](./WINDOWS_APP_CONTROL.md) | Restricted Windows |
| [ACTIVE_CONNECTORS.md](./ACTIVE_CONNECTORS.md) | Active connector list |
| [FUTURE_CONNECTORS.md](./FUTURE_CONNECTORS.md) | Planned connectors |
| [API_STACK.md](./API_STACK.md) | API surface summary |

## Archive

One-off reports, duplicate `TRADEOPS_*` stubs, session audits, and superseded notes:

**[docs/_archive/2026-07-markdown-cleanup/](./_archive/2026-07-markdown-cleanup/)**

Do not treat archive as current runtime truth.
