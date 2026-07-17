# TradeOps Frontend ↔ Backend Contract Map

| Frontend capability | Backend service | API / action | Database | Workflow | Status |
| --- | --- | --- | --- | --- | --- |
| Run objective (panel / AI) | AiOperatorService | `POST /api/v1/ai/operator/run` | OperatorRun, OperatorRecommendation | Operator cycle | Operational |
| Live examples catalog | AiOperatorService | `GET /api/v1/ai/live-examples` | ConnectorInstallation, Product | Readiness eval | Operational |
| Run live example | AiOperatorService | `POST /api/v1/ai/live-examples/:id/run` | OperatorRun… | Operator cycle | Operational |
| Objective history | AiOperatorService | `GET /api/v1/ai/runs` | OperatorRun | — | Operational |
| Objective detail | AiOperatorService | `GET /api/v1/ai/runs/:id` | OperatorRun + recommendations | — | Operational |
| Opportunities table | AiOperatorService | `GET /api/v1/ai/runs/:id` | same | Ranked view | Operational |
| Commerce Process board | CommerceCaseService | `GET /api/v1/commerce/process` | CommerceCase | Lifecycle sync | Operational foundations |
| Product Journey | CommerceCaseService | `GET /api/v1/commerce/cases/:id` | CommerceCase + Product | Stage history | Operational foundations |
| Advance stage | CommerceCaseService | `POST /api/v1/commerce/cases/:id/advance` | CommerceCase | Validated transition | Operational foundations |
| Terminal process summary | CommerceCaseService | `GET /api/v1/commerce/process/terminal-summary` | CommerceCase | Control center | Operational foundations |
| Case by product (handoff) | CommerceCaseService | `GET /api/v1/commerce/cases/by-product/:productId` | CommerceCase | Product twin handoff | Operational foundations |
| Tasks / blockers / SOPs | CommerceCaseService | `GET /api/v1/commerce/tasks` | Derived from CommerceCase | Work queue | Operational foundations |
| Listings stage view | Process byStage | prepare/approve/publish cases | CommerceCase | Stage filter UI | Operational foundations |
| Fulfillment stage view | Process + Orders | sell/source/fulfill + orders | CommerceCase, CustomerOrder | Stage filter UI | Operational foundations |
| Scanner (Discover) | CommerceService | `GET /api/v1/terminal/scanner` | Product, Opportunity | Scoring | Operational |
| Product digital twin | CommerceService | `GET /api/v1/products/:id` | Product, Opportunity | — | Operational |
| Product Media Workspace | ArtifactService | `GET/POST /api/v1/products/:id/artifacts…` | ProductArtifact + object storage | Bootstrap / ingest / set-primary / analyze | Operational foundations |
| Artifact content stream | ArtifactService | `GET …/artifacts/:artifactId/content` | ProductArtifact.storageKey | Controlled proxy / stream | Operational |
| Artifact AI proposal | ArtifactService | `POST …/artifacts/:id/analyze` | metadataJson.lastAnalysis | Rule multimodal v1 | Operational (proposal-only) |
| Listing media plan | ArtifactService | `GET …/artifacts/listing-media-plan` | ProductArtifact refs | Channel selection | Operational |
| Listing draft + media | CommerceService | `POST …/listing-draft` | Listing + mediaPlan | Draft only | Operational |
| Watchlist | CommerceService | `POST/DELETE /api/v1/watchlist/:productId` | ProductWatchlistItem | — | Operational |
| Listing draft | CommerceService | `POST /api/v1/products/:id/listing-draft` | Listing (draft) | Draft only | Operational |
| Approvals queue | CommerceService | `GET /api/v1/approvals` | Approval | Consequential | Operational |
| Approve / reject | CommerceService | `POST /api/v1/approvals/:id/decide` | Approval, Listing, PO | Execute on approve | Operational |
| Connectors | CommerceService | `GET /api/v1/connectors` | ConnectorInstallation | Health | Operational |
| Rescore product | CommerceService | `POST /api/v1/products/:id/rescore` | Opportunity | Scoring | Operational |
| Import fixtures | CommerceService | `POST /api/v1/commerce/import/fixture-supplier` | Product… | Dev only | Fixture-labeled |
| Google weekend | GoogleWeekendService | automation endpoints | feeds | Credential-gated live | Partial |
| Margin protection schedule | — | — | — | — | Not implemented |
| SaaS billing status / checkout / portal | BillingService | `GET/POST /api/v1/billing/*` | BillingAccount, BillingSubscription, BillingInvoice | Stripe Checkout/Portal or dev fixture | Operational foundations |
| Stripe billing webhook | BillingService | `POST /api/v1/webhooks/stripe` | BillingWebhookEvent | Signature + idempotency | Operational foundations |
| Channel payments list | CommercePaymentService | `GET /api/v1/finance/payments` | CommercePayment | Normalize lifecycle | Operational foundations |
| Payouts / reconciliation / disputes | CommercePaymentService | `GET/POST /api/v1/finance/*` | CommercePayout, PaymentReconciliation, CommerceDispute | Fixture reconcile | Operational foundations |
| Source payment gate | CommercePaymentService | assert on order ingest + PO approve | CommercePayment | Blocks unpaid sourcing | Operational foundations |
| Business capabilities board | EcosystemService | `GET /api/v1/ecosystem/capabilities` | ConnectorInstallation + registries | AI selects by capability | Operational foundations |
| Capability provider selection | EcosystemService | `POST /api/v1/ecosystem/capabilities/select` | — | Ranked connectors | Operational foundations |
| Partner Success Center | EcosystemService | `GET /api/v1/ecosystem/partners` | org metrics | Honest partner value | Operational foundations |
| Knowledge graph projection | EcosystemService | `GET /api/v1/ecosystem/knowledge-graph` | Product/Case/Order/Payment… | Graph over canonical models | Operational foundations |
| Operational intelligence | EcosystemService | `GET /api/v1/ecosystem/intelligence` | CommerceCase aggregates | what/why/next/who/AI/value | Operational foundations |
| Partner & graph UI | Ecosystem page | `/terminal/ecosystem` | above APIs | Process-aware empty states | Operational foundations |

Controls without a row above must not be shown as live.
