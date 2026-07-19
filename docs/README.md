# TradeOps documentation

**Canonical rule:** One Source of Truth for architecture — start with the AI Runtime blueprint, then ADRs and runbooks. Everything else historical lives under `_archive/`.

**Execution truth:** [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) — maps major doc claims to DONE / PARTIAL / DOC ONLY / BLOCKED.

---

## Start here

| Doc | Purpose |
|-----|---------|
| [../README.md](../README.md) | Project overview + quick start |
| [FIRST_RUN.md](./FIRST_RUN.md) | First-time boot |
| [TRADEOPS_LOCAL_SETUP.md](./TRADEOPS_LOCAL_SETUP.md) | Local setup (PGlite / Docker) |
| [operations/LOCAL_STACK.md](./operations/LOCAL_STACK.md) | Stack up / supervise / stop |
| [operations/HEALTH_AND_DIAGNOSTICS.md](./operations/HEALTH_AND_DIAGNOSTICS.md) | Health endpoints |
| [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md) | **Canonical product stance** — AI Commerce OS, not investment platform |
| [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md) | **Six pillars** — intelligence, ops, connectors, AI, billing, enterprise |
| [TRADEOPS_XAI_CONFIGURATION.md](./TRADEOPS_XAI_CONFIGURATION.md) | **xAI-first AI config** — Grok + modes + RAG grounding |
| [TRADEOPS_AI_UNIFIED_STACK.md](./TRADEOPS_AI_UNIFIED_STACK.md) | **One AI + Tavily + Capability Gateway** — text/JSON envelope |
| [TRADEOPS_RAG_ENGINE.md](./TRADEOPS_RAG_ENGINE.md) | **RAG engine** — artifacts, CSV, hybrid dense, xAI answers |
| [TRADEOPS_INDUSTRIAL_COMMERCE_OS.md](./TRADEOPS_INDUSTRIAL_COMMERCE_OS.md) | **Industrial AI Commerce OS** — B2B procurement, twin, verticals |
| [TRADEOPS_API_KEYS_CATALOG.md](./TRADEOPS_API_KEYS_CATALOG.md) | **Paste API key names** — `env-api-keys.paste.env` + how to fill |
| [env-api-keys.paste.env](./env-api-keys.paste.env) | **Copy-paste ready** `KEY=` placeholders for all vendors |
| [TRADEOPS_DIRECT_FOUNDER_ACCESS.md](./TRADEOPS_DIRECT_FOUNDER_ACCESS.md) | Founder-direct mode |
| [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md) | founder_direct / authenticated / multi_tenant |
| [TRADEOPS_SECURITY_MODEL.md](./TRADEOPS_SECURITY_MODEL.md) | Access + tenancy security |
| [TRADEOPS_INTERNET_SECURITY.md](./TRADEOPS_INTERNET_SECURITY.md) | **LAN/internet bind, secrets** — harden before public network |
| [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) | **Doc claims vs built code** |
| [TRADEOPS_IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) | What is REAL / FIXTURE / BLOCKED |

## Product

| Doc | Purpose |
|-----|---------|
| [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md) | What TradeOps is (and is not) |
| [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md) | Product pillars |
| [TRADEOPS_PRODUCT_SPEC.md](./TRADEOPS_PRODUCT_SPEC.md) | Product specification |
| [../projectspec.md](../projectspec.md) | Project specification (root) |
| [TRADEOPS_COMMERCE_STATE_ENGINE.md](./TRADEOPS_COMMERCE_STATE_ENGINE.md) | Commerce State Engine — friction, matching, transformations |
| [TRADEOPS_COMMERCE_RUNTIME.md](./TRADEOPS_COMMERCE_RUNTIME.md) | Commerce Runtime — single execution engine |
| [TRADEOPS_OPS_CENTER.md](./TRADEOPS_OPS_CENTER.md) | Ops Center — connector registry, health, event bus |
| [TRADEOPS_LIVE_DATA_INVENTORY.md](./TRADEOPS_LIVE_DATA_INVENTORY.md) | Live data — provenance, no fabricated KPIs |
| [TRADEOPS_PERSONA_WORKSPACES.md](./TRADEOPS_PERSONA_WORKSPACES.md) | Persona workspaces + dynamic sidebar |
| [TRADEOPS_PUBLIC_PRODUCT.md](./TRADEOPS_PUBLIC_PRODUCT.md) | Public messaging rules |
| [TRADEOPS_AI_OPERATOR.md](./TRADEOPS_AI_OPERATOR.md) | AI operator |
| [TRADEOPS_AI_EVALUATION.md](./TRADEOPS_AI_EVALUATION.md) | Self-evaluation artifacts |
| [TRADEOPS_PREDICTIVE_ENGINE.md](./TRADEOPS_PREDICTIVE_ENGINE.md) | Prediction engine — demand/profit/signal train·run·eval |
| [TRADEOPS_MULTI_TENANCY.md](./TRADEOPS_MULTI_TENANCY.md) | Production multi-tenancy |
| [TRADEOPS_TENANT_ISOLATION_INVENTORY.md](./TRADEOPS_TENANT_ISOLATION_INVENTORY.md) | Per-surface tenant isolation inventory |
| [TRADEOPS_MULTI_TENANCY_EXECUTION.md](./TRADEOPS_MULTI_TENANCY_EXECUTION.md) | Multi-tenancy execution checklist |
| [TRADEOPS_AUTOMATION_ENGINE.md](./TRADEOPS_AUTOMATION_ENGINE.md) | Workflows (partial) |
| [TRADEOPS_WORKFLOW_TEMPLATES.md](./TRADEOPS_WORKFLOW_TEMPLATES.md) | Template catalog |
| [TRADEOPS_ECOSYSTEM_ARCHITECTURE_AUDIT.md](./TRADEOPS_ECOSYSTEM_ARCHITECTURE_AUDIT.md) | Full COS audit + consolidate/keep/defer |
| [TRADEOPS_ECOSYSTEM_STRATEGY.md](./TRADEOPS_ECOSYSTEM_STRATEGY.md) | Ecosystem flywheel & partner value |
| [TRADEOPS_CONNECTOR_CAPABILITY_FRAMEWORK.md](./TRADEOPS_CONNECTOR_CAPABILITY_FRAMEWORK.md) | Business capabilities vs raw APIs |
| [TRADEOPS_COMMERCE_KNOWLEDGE_GRAPH.md](./TRADEOPS_COMMERCE_KNOWLEDGE_GRAPH.md) | KG projection over canonical models |
| [TRADEOPS_NORMALIZATION_ARCHITECTURE.md](./TRADEOPS_NORMALIZATION_ARCHITECTURE.md) | External → canonical mapping |
| [TRADEOPS_AI_OPERATING_MODEL.md](./TRADEOPS_AI_OPERATING_MODEL.md) | AI as operational manager |
| [TRADEOPS_IMPLEMENTATION_ROADMAP_ECOSYSTEM.md](./TRADEOPS_IMPLEMENTATION_ROADMAP_ECOSYSTEM.md) | Phased roadmap |
| [TRADEOPS_DEPLOYMENT.md](./TRADEOPS_DEPLOYMENT.md) | Local + Docker + production deploy notes |
| [TRADEOPS_RELEASE_RUNBOOK.md](./TRADEOPS_RELEASE_RUNBOOK.md) | Release process |
| [TRADEOPS_RELEASE_NOTES.md](./TRADEOPS_RELEASE_NOTES.md) | 0.1.0 notes |
| [TRADEOPS_COMMERCE_LIFECYCLE.md](./TRADEOPS_COMMERCE_LIFECYCLE.md) | Canonical commerce lifecycle |
| [TRADEOPS_PROCESS_ARCHITECTURE.md](./TRADEOPS_PROCESS_ARCHITECTURE.md) | Process spine architecture |
| [TRADEOPS_ROUTE_CONSOLIDATION.md](./TRADEOPS_ROUTE_CONSOLIDATION.md) | Route matrix keep/merge/remove |
| [TRADEOPS_COMMERCE_CASE_MODEL.md](./TRADEOPS_COMMERCE_CASE_MODEL.md) | CommerceCase model |
| [TRADEOPS_STAGE_TRANSITIONS.md](./TRADEOPS_STAGE_TRANSITIONS.md) | Valid stage transitions |
| [TRADEOPS_TASK_ENGINE.md](./TRADEOPS_TASK_ENGINE.md) | Tasks & blockers |
| [TRADEOPS_NEXT_ACTION_ENGINE.md](./TRADEOPS_NEXT_ACTION_ENGINE.md) | Next-action engine |
| [TRADEOPS_STANDARD_OPERATING_PROCEDURES.md](./TRADEOPS_STANDARD_OPERATING_PROCEDURES.md) | SOP templates |
| [TRADEOPS_PRODUCT_ARTIFACT_MODEL.md](./TRADEOPS_PRODUCT_ARTIFACT_MODEL.md) | Product media / artifact model |
| [TRADEOPS_MEDIA_PIPELINE.md](./TRADEOPS_MEDIA_PIPELINE.md) | Artifact ingest pipeline |
| [TRADEOPS_MEDIA_SECURITY.md](./TRADEOPS_MEDIA_SECURITY.md) | SSRF / untrusted file controls |
| [TRADEOPS_LIVE_EXAMPLES.md](./TRADEOPS_LIVE_EXAMPLES.md) | Live online examples catalog |
| [TRADEOPS_GOOGLE_SEARCH.md](./TRADEOPS_GOOGLE_SEARCH.md) | SEO / Search Console steps |
| [TRADEOPS_GA4.md](./TRADEOPS_GA4.md) | Analytics policy + env-gated gtag |
| [TRADEOPS_GOOGLE_MERCHANT.md](./TRADEOPS_GOOGLE_MERCHANT.md) | Merchant connector (shadow) |
| [TRADEOPS_SECURITY_REVIEW.md](./TRADEOPS_SECURITY_REVIEW.md) | Security gates |
| [TRADEOPS_PRODUCTION_AUDIT.md](./TRADEOPS_PRODUCTION_AUDIT.md) | Production audit issues |
| [TRADEOPS_TEST_REPORT.md](./TRADEOPS_TEST_REPORT.md) | Last verified checks |
| [TRADEOPS_MARKDOWN_SCAN.md](./TRADEOPS_MARKDOWN_SCAN.md) | Full inventory of markdown files |
| [TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md](./TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md) | Prompt vs code audit |
| [WINDOWS_APP_CONTROL.md](./WINDOWS_APP_CONTROL.md) | Restricted Windows host |

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
| [architecture/ARCHITECTURE_RECONCILIATION.md](./architecture/ARCHITECTURE_RECONCILIATION.md) | Architecture reconciliation |

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

### AI runtime docs

| Doc | Purpose |
|-----|---------|
| [ai/ARCHITECTURE.md](./ai/ARCHITECTURE.md) | AI package architecture |
| [ai/CONFIGURATION.md](./ai/CONFIGURATION.md) | AI configuration |
| [ai/OPERATIONS.md](./ai/OPERATIONS.md) | AI operations |
| [ai/TOOLS.md](./ai/TOOLS.md) | Tool surface |
| [ai/PROMPTS.md](./ai/PROMPTS.md) | Prompt registry |
| [ai/SCHEMAS.md](./ai/SCHEMAS.md) | Response schemas |
| [ai/RETRIEVAL.md](./ai/RETRIEVAL.md) | Retrieval / RAG |
| [ai/SEARCH.md](./ai/SEARCH.md) | Search manager |
| [ai/LIVE_PROJECTION.md](./ai/LIVE_PROJECTION.md) | Live projection |
| [ai/TENANT_ISOLATION.md](./ai/TENANT_ISOLATION.md) | Tenant isolation for AI |
| [ai/TESTING.md](./ai/TESTING.md) | AI testing |
| [ai/PRODUCTION_OWNERSHIP.md](./ai/PRODUCTION_OWNERSHIP.md) | Production ownership |
| [ai/FAKE_RESPONSE_REMOVAL_REPORT.md](./ai/FAKE_RESPONSE_REMOVAL_REPORT.md) | Fake-response removal report |

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
| [operations/LOCAL_STACK.md](./operations/LOCAL_STACK.md) | Local stack runbooks |
| [operations/HEALTH_AND_DIAGNOSTICS.md](./operations/HEALTH_AND_DIAGNOSTICS.md) | Health diagnostics |

## Archive

One-off reports, duplicate `TRADEOPS_*` stubs, session audits, and superseded notes:

**[docs/_archive/2026-07-markdown-cleanup/](./_archive/2026-07-markdown-cleanup/)**

Do not treat archive as current runtime truth.
