# TradeOps Commerce Operating System — Reconciliation Report

**Date:** 2026-07-18  
**Mode:** Implementation reconciliation (not feature sprawl)  
**Source of truth:** Repository after this change set  
**Prior review:** [PRODUCT_LIFECYCLE_REVIEW.md](./PRODUCT_LIFECYCLE_REVIEW.md)

---

## 1. Objective achieved

TradeOps was reconciled toward one cohesive **Commerce Operating System** where:

| Principle | Implementation |
|-----------|----------------|
| One Platform | Unchanged monorepo spine; clearer fabric boundaries |
| One Workspace | Persona Focus/More retained; Cases elevated in research nav |
| One Commerce Case | Case **object workspace** is the hub API + UI |
| One AI Runtime | Prompt / schema / artifact registries + provider abstraction |
| One Connector Fabric | Full fabric descriptors; fixtures share live contracts |
| One Data Fabric | Canonical business object catalog + ownership |
| One Workflow Engine | Durable run model over templates |
| One Search Layer | Unified `/api/v1/search` with provenance |
| One Event Fabric | Case stage advances emit durable events |
| One Knowledge Graph | Case-centric projection from related objects |
| One Source of Truth | Commerce Case + object workspace panels, not page silos |

Philosophy enforced in code: **pages are views; objects are the system of record.**

---

## 2. What was inspected

- `PRODUCT_LIFECYCLE_REVIEW.md` findings validated against code  
- Prisma schema (identity → commerce → capital)  
- `packages/commerce-engine`, `ai-runtime`, `connector-core`, `workflow-engine`, connectors  
- Nest commerce / AI / automation modules  
- Terminal shell, sidebar, case/product pages, command bar  
- Fixtures vs live adapter contracts  

**Review corrections applied:**

| Review claim | Reconciliation |
|--------------|----------------|
| Right rail is only AI | Confirmed; not expanded into fake Activity rails |
| Knowledge graph partial | Now case-centric projection with typed edges |
| Search layer missing | Implemented internal orchestration + command bar |
| Workflow not durable | Durable run snapshot model + persistence |
| AI prompts ad-hoc | Central prompt registry for case framing |
| Fixtures “hacks” | Fixtures now declare full fabric metadata (auth, rate limits, sync, operations) |

Capital / network remain **disconnected sandbox** (correct product boundary; not merged into primary chrome).

---

## 3. Architectural improvements

### 3.1 Canonical business objects

**Package:** `@tradeops/commerce-engine`

| Module | Role |
|--------|------|
| `business-objects.ts` | Object types, ownership, permissions, workspace sections |
| `object-workspace.ts` | Builds case OS surface (panels, next action, AI context) |
| `knowledge-graph.ts` | Typed nodes/edges projection |
| `search-orchestration.ts` | Plan + rank + provenance for internal evidence |

Commerce Case sections include: overview, lifecycle, next_action, research, suppliers, pricing, media, opportunities, listings, inventory, orders, shipments, payments, AI, approvals, signals, documents, analytics, workflows, connectors, relationships, history.

### 3.2 Case object workspace (API + UI)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/commerce/cases/:caseId/workspace` | Full OS payload for one case |

**UI:** `/terminal/process/[caseId]` is now the **object workspace** (section tabs + panels), not a thin journey page.

**Product twin:** `/terminal/products/[id]` remains a **facet** (media, economics) with primary handoff to **Open case workspace**.

### 3.3 Unified Search Layer

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/search?q=` | Internal products, cases, orders, connectors, AI runs |

Every hit includes `provenance` (source kind, connector, fixture flag, confidence, timestamp).

**Command bar** prefers search hits (score ≥ 0.35) before navigate heuristics / AI.

### 3.4 Connector Fabric

| Module | Role |
|--------|------|
| `connector-core` `types.ts` | Auth, rate limits, sync, operations on `ConnectorManifest` |
| `connector-core` `fabric.ts` | Uniform descriptors for fixtures + live |
| `GET /api/v1/ops/connectors/fabric` | Fabric catalog API |

Fixtures (**supplier**, **marketplace**) and **Google Merchant** now register:

- auth requirements  
- rate limit policy  
- webhook/polling support  
- operation contracts (idempotency, approval, produced entity)  
- health check mode  

**Invariant:** Platform code must not special-case vendor SDKs; AI only uses business capabilities / tools.

### 3.5 AI Runtime ownership

| Module | Role |
|--------|------|
| `prompt-registry.ts` | Versioned prompts (`operator.system`, `operator.case_context`, …) |
| `schema-registry.ts` | Structured output schemas |
| `artifact-registry.ts` | Artifact kinds + approval defaults |
| `provider-abstraction.ts` | Provider-independent generation; **Cohere sole active provider**; blocked (not demo) when unconfigured |

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/ai/runtime` | Catalog of tools, prompts, schemas, artifacts, providers |

Case-bound operator runs frame objectives through **`renderPrompt('operator.case_context')`**.

### 3.6 Workflow durability

| Module | Role |
|--------|------|
| `workflow-engine/durable-run.ts` | Create + execute durable step snapshots |

`WorkflowService.runTemplate` now:

1. Creates durable skeleton  
2. Executes template runner into step records  
3. Persists durable snapshot on `OperatorRun.planJson`  
4. Emits workflow events with step status  

Still dry-run / approval-gated for consequential steps (honest).

### 3.7 Event fabric

`CommerceCaseService.advance` emits:

```
commerce_case.stage_advanced
```

with caseId, productId, from/to, next action — durable for audit, monitoring, AI learning.

### 3.8 Navigation / UX

- Researcher Focus: **Cases** elevated before Discovery  
- Case workspace section navigation (`?section=`)  
- Case handoff: primary CTA **Open case workspace**  
- Product page labels twin as facet of the case  

---

## 4. Normalized subsystems

| Before | After |
|--------|-------|
| Product page + case journey + stage filters as peers | Case workspace hub; product twin facet; stage pages = filters |
| Ad-hoc command bar routes | Search orchestration → navigate → heuristics |
| Connector manifests (minimal) | Fabric descriptors (auth/sync/ops/rate) |
| AI prompts embedded in services | Prompt registry + render |
| Workflow “run and forget” | Durable step records + events |
| Knowledge graph “ecosystem only” | Case-centric graph on every case workspace |
| AI provider env sprawl | Single provider abstraction (Cohere-first) |

---

## 5. Duplication handled

| Item | Action |
|------|--------|
| Dual AI component paths | Already re-export shims (`components/ai-*` → `components/ai/*`) — retained |
| Pipeline / cockpit / control-tower | Already redirects — retained |
| Free tools vs terminal scoring | Intentional public vs OS — retained |
| Capital vs channel finance | Kept separate domains (honesty) — not merged into terminal Focus |
| Review “missing right rails” | Not fabricated; history/artifacts live on case workspace panels |

No reckless mass-deletion of capital schemas (would break API). Capital remains **orphaned by design** from primary commerce OS chrome.

---

## 6. Strengthened fixtures

Fixtures are **development infrastructure**, not temporary hacks:

- Same `ConnectorManifest` + fabric descriptor as live  
- Same capability / operation contracts  
- Explicit rate-limit and sync parity notes  
- `isFixture` honesty labels preserved everywhere  

Swapping to production APIs remains a **configuration/credentials** change, not a redesign.

---

## 7. Production readiness improvements

| Area | Change |
|------|--------|
| Observability | Stage-advance events; durable workflow events |
| Safety | AI still tool-gated; consequential steps approval-aware |
| Typing | New pure modules unit-tested |
| API surface | Search, fabric, case workspace, AI runtime catalog |
| Build | `@tradeops/commerce-engine` 57 tests pass; API + web typecheck clean |

---

## 8. Remaining blockers (external / next phases)

### Require external credentials or policy

1. Live Shopify / Amazon / eBay full sync  
2. Google Merchant live post (shadow prepare exists)  
3. OAuth credential vault UI  
4. Live Stripe SaaS charges as default  
5. Multi-tenant email verify / password reset productization  

### Require further engineering (high value next)

1. Dedicated `WorkflowRun` table (vs OperatorRun JSON)  
2. Live connector search merge into Search Layer when authorized  
3. ~~Real Cohere adapter~~ **DONE** (see `@tradeops/ai-runtime` `cohere-adapter.ts` + boot)  
4. Streaming LLM responses  
5. Notification center (in-app) — still intentionally not a right-rail fiction  
6. Event replay UI / ops console  
7. Stronger RBAC per object type enforcement middleware  
8. Consolidate remaining dual component files if any non-reexport  
9. Cloud deploy / staging automation  
10. Full e2e Playwright journey: discover → case workspace → AI → approve  

---

## 9. Next highest-value implementation phases

### Phase A — One live channel vertical
OAuth install → sync → case auto-create → listing draft → approval → publish webhook → order → case advance on live data.

### Phase B — Search + connectors fusion
Merge authorized live catalog search into `/api/v1/search` with mixed provenance honesty.

### Phase C — Durable workflow host
Promote `DurableWorkflowRun` to first-class DB + resume/cancel APIs + worker execution.

### Phase D — Cohere generative layer
**DONE foundations:** Cohere Chat/Embed/Rerank adapter + sole-provider policy. Remaining: streaming, deeper synthesis wiring into every navigator path.

### Phase E — SaaS shell
Auth recovery, invites, live billing, tenant isolation CI matrix.

### Phase F — IA freeze
No new top-level pages without an owning object section; finance as tabs under case/org money.

---

## 10. Files added / primary touchpoints

### New

- `packages/commerce-engine/src/business-objects.ts`  
- `packages/commerce-engine/src/knowledge-graph.ts`  
- `packages/commerce-engine/src/search-orchestration.ts` (+ test)  
- `packages/commerce-engine/src/object-workspace.ts` (+ test)  
- `packages/connector-core/src/fabric.ts`  
- `packages/ai-runtime/src/prompt-registry.ts`  
- `packages/ai-runtime/src/schema-registry.ts`  
- `packages/ai-runtime/src/artifact-registry.ts`  
- `packages/ai-runtime/src/provider-abstraction.ts`  
- `packages/workflow-engine/src/durable-run.ts`  
- `apps/api/src/commerce/search.service.ts`  
- `apps/web/src/components/commerce/object-workspace.tsx`  
- `COS_RECONCILIATION_REPORT.md` (this file)  

### Substantially updated

- Case journey page → object workspace UI  
- `CommerceCaseService` (workspace + events)  
- `CommerceController` (search, fabric, workspace)  
- `WorkflowService` (durable)  
- `AiOperatorService` / `AiController` (prompt framing, runtime catalog)  
- Fixture + Google Merchant manifests  
- Command bar search  
- Persona nav (researcher Cases first)  
- Product twin framing  

---

## 11. Verification

```
pnpm --filter @tradeops/commerce-engine test   # 57 pass
pnpm --filter @tradeops/api run build          # clean
pnpm --filter @tradeops/web run typecheck      # clean
```

---

## 12. Closing statement

This reconciliation does **not** claim enterprise production readiness. It claims something more important for the next phase:

**TradeOps now has a single architectural spine** — Commerce Case object workspace, one search layer, one connector fabric contract, one AI runtime registry, durable workflows, and evented stage transitions — so future work attaches to the OS instead of adding more disconnected pages.

Fixtures remain first-class. Live connectors remain honesty-gated. Capital remains out of the primary commerce OS.

**End of reconciliation report.**
