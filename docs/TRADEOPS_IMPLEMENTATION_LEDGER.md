# Implementation Ledger (2026-07-16)

**Positioning (from plan.md):** multi-tenant Commerce Intelligence SaaS — individuals first, architecture ready for agency/enterprise.

| Capability | Status | Notes |
|------------|--------|-------|
| Midnight Exchange theme (`theme.md`) | Operational foundations | Tokens + shell: command bar, grouped nav, docked AI panel, component layers per §22 |
| Accent system `#25C7E8` | Operational | Interaction/AI only; semantic P&amp;L colors separate; AI pulse/progress states |
| Direct Founder Access (`TRADEOPS_ACCESS_MODE=founder_direct`) | Operational | Root → cockpit; no login/onboarding; idempotent founder bootstrap; auth architecture retained |
| Access mode central resolver | Operational | `packages/config/src/access-mode.ts` |
| Public website | Operational | Marketing + legal + SEO + segment solutions (skipped at `/` when founder_direct) |
| Public platform pages | Operational | `/platform`, `/platform/plans` |
| Free tools | Operational | Same commerce-engine |
| Auth register/login | Operational | Rate limited; no email verify |
| AUTH_BYPASS | Administrative | Off in production |
| Org multi-tenancy | Operational | organizationId scoping |
| Customer segment + plan tier | Operational foundations | Org fields + entitlements package |
| Segment onboarding | Operational foundations | `/onboarding` API + form |
| Persona workspace (adaptive nav) | Operational foundations | `navForPersona` + membership persona |
| Founder cockpit | Operational | `/terminal/cockpit` |
| Control tower | Operational foundations | `/terminal/control-tower` + API |
| Entitlements / quotas | Operational foundations | Hard limits on AI + workflows; usage meters |
| ATP inventory | Operational foundations | `calculateAtp` + product panel |
| Customer intelligence | Operational foundations | LTV/churn factors from orders |
| Channel profitability | Operational foundations | Multi-channel contribution compare |
| Agentic commerce readiness | Operational foundations | Product/tenant score (not live UCP) |
| Terminal scanner/pipeline | Operational | Fixture + real DB |
| Approvals | Operational | Listing/PO |
| AI operator | Approval-controlled | Shadow default; metered on success; READ_ONLY research no approval |
| Live Example Framework | Operational foundations | Catalog + readiness + `/terminal/live-examples`; Canadian scan runnable |
| Objective history | Operational | `/terminal/objectives` + detail via OperatorRun |
| AI side panel (terminal) | Operational | Docked AI context + timeline + product recs |
| Product watchlist | Operational | Org-scoped table + API + UI + product Watch button |
| Product Media & Artifact Engine | Operational foundations | ProductArtifact model, local storage abstraction, SSRF-safe ingest, bootstrap (image/docs/video/3D), channel readiness (Google/Shopify/eBay/Amazon), duplicates, AI proposals, listing media plan, Product Media Workspace |
| Connector media capabilities | Operational foundations | Capability matrix on connector-core; fixture + Google Merchant declare media caps; live channel publish credential-gated; eBay legacy upload path banned |
| Commerce Process consolidation | Operational foundations | CommerceCase spine, stage transitions, next-action engine, `/terminal/process` board + journey, Listings/Fulfillment stage views, product CaseHandoff, Tasks + blockers + SOPs, AI case context, process-first nav, Terminal process summary, legacy pipeline/control-tower redirects |
| Workflow templates | Partial | Dry-run / approval skips; metered |
| Google weekend | Shadow operational | Live post blocked |
| Shopify/Amazon/eBay live | Credential-blocked | Registry only |
| Agency client hierarchy | Operational foundations | Create/list client orgs under parent |
| Enterprise SSO / legal entities | Planned | Not built |
| B2B negotiated catalogs | Planned | Not built |
| Billing ledger / payments | Coming soon | Entitlements without charges |
| Email verify | Not built | Launch blocker |
| GA4 | Operational foundations | Env-gated gtag component; off by default; no CMP |
| Deploy docs | Written | Compose + Cloud Run notes |
| Doc ↔ code matrix | Written | [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) |
