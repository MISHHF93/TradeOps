# System Wiring Matrix

**Source of truth:** `@tradeops/contracts` → `CORE_WIRING_MATRIX`  
**API:** `GET /api/v1/ops/wiring-matrix`  
**Diagnostics:** `GET /api/v1/ops/diagnostics`

| UI action | Route | Controller | Service | Domain operation | Tool/connector | Model | Event | Response schema | Final UI state | Status |
|-----------|-------|------------|---------|------------------|----------------|-------|-------|-----------------|----------------|--------|
| Import fixtures | `POST /api/v1/commerce/import/fixture-supplier` | CommerceController | CommerceService | discover + case create | fixture-supplier | Product, CommerceCase | ProductDiscovered | JSON + dataMode honesty | Scanner / process | wired |
| Open case workspace | `GET /api/v1/commerce/cases/:caseId/workspace` | CommerceController | CommerceCaseService.getCaseWorkspace | object graph | none | CommerceCase+ | none | ObjectWorkspaceView | Case tabs | wired |
| Advance stage | `POST /api/v1/commerce/cases/:caseId/advance` | CommerceController | CommerceCaseService.advance | lifecycle transition | none | CommerceCase | CommerceCaseAdvanced | CaseDto | Stage + history | wired |
| Run AI objective | `POST /api/v1/ai/operator/run` | AiController | AiOperatorService.runObjective | Phase A tools + Phase B synthesis | typed tools / Cohere | OperatorRun | AIObjectiveStarted/Completed | envelope + operator body | AI panel | wired |
| Command search | `GET /api/v1/search?q=` | CommerceController | SearchService.search | internal retrieval | internal | Product, Case, … | none | SearchResponse | Navigate hit | wired |
| Public web research | tool researchSearchPublicWeb | AI tool invoke | invokeResearchCapability | research.search_public_web | tavily-search | none | none | WebSearchResult | AI evidence | wired |
| Connector probe | `POST /api/v1/ops/connectors/:key/probe` | CommerceController | ConnectorOpsService.probe | health | provider | ConnectorHealthEvent | ConnectorHealthChanged | ProbeResult | Ops table | wired |
| Live sync | `POST /api/v1/ops/connectors/live-sync` | CommerceController | ConnectorOpsService.syncLive | import live | shopify-graphql-admin | Product | ProductDiscovered | LiveSyncResult | Products or blocker | partial |
| Approval decide | `POST /api/v1/approvals/:id/decide` | CommerceController | CommerceService | gate | listing/PO | Approval | ApprovalDecided | ApprovalDto | Queue | wired |
| Workflow run | `POST /api/v1/automation/workflows/run` | AutomationController | WorkflowService.runTemplate | durable template | workflow-engine | OperatorRun | workflow.template_run | DurableRun | Objectives | partial |
| Stack diagnostics | `GET /api/v1/ops/diagnostics` | DiagnosticsController | DiagnosticsService.probeStack | config honesty | all active | none | none | DiagnosticsReport | Ops/diag | wired |
| Lifecycle path | `GET /api/v1/commerce/lifecycle/path` | CommerceController | LifecyclePathService | fixture vs Shopify | shopify/fixtures | counts | none | CanonicalEnvelope | Honesty board | wired |
| Demo loop | DemoLoopButton / `pnpm demo:loop` | multi | fixture lifecycle | full spine | fixture-* | commerce models | multiple | mixed | Process filled | wired |
| Persona home | `GET /api/v1/workspace` | CommerceController | WorkspaceService.resolve | intelligence nav | none | Membership | none | ResolvedWorkspace | Sidebar + home | wired |
| SaaS billing status | `GET /api/v1/billing/subscription` | BillingController | BillingService | entitlements | stripe-api | Billing* | none | SubscriptionDto | Billing page | partial |

## Status legend

- **wired** — executable path in code  
- **partial** — works with limits (credentials, dry-run, foundations)  
- **blocked** — cannot execute until external config  
- **decorative_removed** — must not ship as active control  

## Guarantee

No row with status `wired` or `partial` may be a dead button. Failures must surface errors or `blocked` meta with missing keys — never fake live success.
