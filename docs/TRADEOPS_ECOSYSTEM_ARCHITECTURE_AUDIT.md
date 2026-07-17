# TradeOps Ecosystem Architecture Audit

**Date:** 2026-07-17  
**Mode:** Professor — ecosystem-first AI Commerce Operating System  
**North star:** [TRADEOPS_SIX_PILLARS.md](./TRADEOPS_SIX_PILLARS.md) · [TRADEOPS_PRODUCT_POSITIONING.md](./TRADEOPS_PRODUCT_POSITIONING.md)

## Executive summary

TradeOps already has a **credible process spine** (`CommerceCase` + process nav + fixture vertical slice) and **clean money domain separation** (SaaS Stripe vs channel payment intelligence vs capital sandboxes). It is **not yet ecosystem-first in live connectors**: Shopify/Amazon/eBay exist as registry stubs; only fixture-supplier, fixture-marketplace, and credential-gated Google Merchant ship as packages.

**Direction:** double down on lifecycle + business capabilities + durable webhooks + normalization; keep capital sandboxed; never compete with channel platforms.

---

## Inventory

### Process-aligned (keep / deepen)

| Area | Status |
|------|--------|
| CommerceCase + `/terminal/process` | Operational foundations |
| Stage views (Discover → Fulfill) | Operational |
| Tasks / blockers | Operational |
| Approvals | Operational |
| AI Operator + typed tools | Operational (deterministic tools) |
| SaaS Stripe billing | Operational foundations |
| Channel finance normalize | Operational foundations |
| Fixture commerce loop | Operational |

### Feature / dual-model drift (consolidate)

| Issue | Action |
|-------|--------|
| Opportunity vs CommerceCase dual scores | Prefer case + product scoring service as SoT |
| `persona-nav.ts` legacy labels | Freeze; process nav only |
| `GET terminal/pipeline` API | Alias of process summary or retire |
| Three capability catalogs (manifest / live-feed / DB) | Unified business-capability board (**done this pass**) |
| Duplicate UI component trees | Gradual cleanup |

### Sandbox / deferred (do not market as core)

| Area | Status |
|------|--------|
| `/capital/*`, `/network/*` | Planned/sandbox; capital gates |
| Pooled investment | Production hard-disabled |

### Missing vs vision (roadmap)

| Capability | Gap |
|------------|-----|
| Live Shopify GraphQL connector package | Registry only |
| Durable channel webhooks (Shopify HMAC → queue) | Models exist; Stripe only solid |
| Dedicated normalization package | Partial (fixtures + ExternalPayload) |
| Graph DB / multi-hop KG | **Projection API** over Prisma (**this pass**) |
| Partner Success Center | **Metrics API + UI** (**this pass**) |
| Continuous proactive push intelligence | Mostly request-driven |
| SSO / deep enterprise governance | Partial RBAC + audit |

---

## Canonical lifecycle (single spine)

```text
Discover → Evaluate → Qualify → Prepare → Approve → Publish
→ Sell → Source → Fulfill → Reconcile → Learn → (closed)
```

**One Commerce Case per product** — shared across modules. Navigation is process-based (Operate · Lifecycle · Intelligence · Billing · AI · Platform).

---

## Financial architecture (unchanged principle)

1. **SaaS** — Stripe subscriptions only  
2. **Channel payment intelligence** — shopper money stays with merchant processors  
3. **No** pooled funds, custody wallets, or investment platform claims  

---

## Ecosystem value (Partner Success)

| Participant | Value TradeOps creates |
|-------------|------------------------|
| Merchant | Automation, intelligence, one process |
| Shopify / marketplaces | Better catalogs, operational quality, GMV readiness |
| Suppliers | More qualified demand |
| Stripe | SaaS subscription volume |
| Google Merchant / Meta | Higher-quality feeds & readiness |
| Logistics | Optimized fulfillment demand (when connected) |
| TradeOps | Sustainable SaaS + premium AI/workflow revenue |

---

## Implementation pass (this change)

1. Business capability model + provider selection (`connector-core`)  
2. Ecosystem API: capabilities, partners, knowledge graph, operational intelligence  
3. Process-based nav + Partner & graph UI  
4. Process-aware empty states  
5. AI tool uses business capabilities board  
6. Architecture documentation suite  

---

## Top recommendations (priority)

1. Keep CommerceCase as sole process SoT  
2. Ship first live connector (Shopify GraphQL) with capability ads  
3. Durable webhook pipeline per channel  
4. Normalize ExternalPayload → canonical models productized  
5. Unify scoring into case-aware service  
6. Freeze capital/network as non-primary  
7. Shared empty-state + next-action everywhere  
8. Expand AI to select tools by business capability + stage  
9. Enterprise SSO later  
10. Full KG query language only after multi-connector volume  
