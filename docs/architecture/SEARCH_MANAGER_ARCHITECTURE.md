# Search Manager Architecture

**Role:** Lead Enterprise Architect — retrieval ownership normalization  
**Status:** Target architecture (consistency; not feature expansion)  
**Goal:** Every retrieval request flows through a **single Search Manager**. The **AI Runtime never invokes search providers** (Tavily, Prisma product scans, connector catalog HTTP, etc.).  
**Aligns with:** `AI_RUNTIME_ARCHITECTURE.md` (`SearchPort`), `AI_OPERATOR_ARCHITECTURE_DIVERGENCE.md` (A5, A6, A7, A13), `COMMERCE_CASE_AI_ORCHESTRATION.md`, `search-orchestration.ts`, `SearchService`  
**Code anchors today:**  
`packages/commerce-engine/src/search-orchestration.ts`, `apps/api/src/commerce/search.service.ts`, `packages/ai-runtime/src/web-search-provider.ts`, `packages/ai-runtime/src/builtin-tools.ts`, `apps/api/src/ai/ai-operator.service.ts` (`deps.searchProducts`)

---

## 1. Principle

| Layer | May do | Must not do |
|-------|--------|-------------|
| **AI Runtime** | Request **search capabilities** via `SearchPort` / tools that call Search Manager only | Call Tavily, open web HTTP, Prisma `product.findMany` for search, connector catalog probes for retrieval |
| **Search Manager** | Plan sources, invoke adapters, merge hits, attach provenance, return `SearchResponse` | Own commerce stage, run generative AI, persist listings |
| **Search adapters** | Talk to one source family (internal DB, KG, Tavily, fabric supplier/marketplace, docs corpus) | Be called by AI Runtime or UI except through Manager |
| **Command bar / UI** | Call host Search API (Manager) | Parallel client-side provider keys |
| **Connector Fabric** | Execute **live I/O operations** when Manager requests supplier/marketplace discovery | Become a second free-form search API for AI |

```text
Caller (AI tool | command bar | automation)
        │
        ▼
   Search Manager  ◄── sole orchestration surface
        │
        ├── Internal Retrieval adapter
        ├── Documents adapter
        ├── Knowledge Graph adapter
        ├── Public Search adapter      (Tavily behind here)
        ├── Supplier Search adapter    (Fabric / connector ops)
        ├── Marketplace Discovery adapter
        └── Official Documentation adapter
                │
                ▼
         unified SearchHit[] + plan + honesty
```

---

## 2. Current state (violations)

### 2.1 Two stacks

| Path | Implementation | Sources |
|------|----------------|---------|
| **Command bar / `SearchService`** | `planSearch` + `executeInternalSearch` | Internal products, cases, orders, connectors, AI runs only |
| **AI Operator cycle** | `searchConnectedProducts` → Prisma via `deps.searchProducts`; `researchSearchPublicWeb` → **Tavily inside ai-runtime** | Product table + public web |

Knowledge Graph, documentation, supplier catalog, and marketplace discovery are **declared** as source kinds or capabilities in places but **not unified** on one Manager critical path for AI.

### 2.2 Inventory of direct calls to replace

| ID | Location | What it does today | Bypass of Manager | Replacement |
|----|----------|--------------------|-------------------|-------------|
| **S1** | `ai-runtime` `builtin-tools` → `researchSearchPublicWeb` | Dynamic import `web-search-provider` → Tavily HTTP | Yes — provider in runtime | Tool → `SearchPort.search({ capabilities: ['public_search'], … })` |
| **S2** | `builtin-tools` → `researchExtractUrl` | Tavily extract via runtime provider | Yes | Manager capability `public_extract` (or sub-op of public_search) |
| **S3** | `builtin-tools` → `researchSearchOfficialDocumentation` | Tavily with docs-biased query in runtime | Yes | Manager capability `official_documentation` |
| **S4** | `web-search-provider.ts` in **ai-runtime** | Owns Tavily client, bootstrap, global provider | Provider lives in wrong package | Move client to Search Manager adapters (API host or `commerce-engine`/search package); runtime has **zero** web HTTP |
| **S5** | `operator-cycle` Phase A | Invokes `researchSearchPublicWeb` tool for read-only objectives | Indirect provider path | Orchestrator requests Manager plan with `public_search` when policy allows — still via tool→port only |
| **S6** | `builtin-tools` → `searchConnectedProducts` | `ctx.deps.searchProducts` | Yes — ad-hoc product list | Manager capability `internal_retrieval` (products) + optional filters |
| **S7** | `AiOperatorService` `deps.searchProducts` | `prisma.product.findMany` orderBy updatedAt | Yes — not scored/provenance search | Implement only inside Manager **Internal** adapter |
| **S8** | `AiOperatorService` `loadOperatorProducts` | Full product preload into cycle input | Yes — retrieval outside Manager | Engine/tools request candidates via Manager; no host product array as search |
| **S9** | `SearchService.search` | Internal-only; never merges public/KG/supplier/marketplace | Incomplete Manager | Expand to full Manager host; same API for AI and UI |
| **S10** | `planSearch` / `executeInternalSearch` | Partial source kinds; KG/docs/public not executed | Incomplete | Manager `executePlan` fans out to all selected adapters |
| **S11** | KG `projectCaseKnowledgeGraph` | Used in workspace; **not** on AI retrieval path | Orthogonal | Manager **Knowledge Graph** adapter returns `SearchHit`s from projection |
| **S12** | Connector/ecosystem board in AI tools | Capability listing ≠ catalog search | Partial | Supplier/marketplace **discovery search** via Manager → Fabric ops; board remains install/health not free search |
| **S13** | Future/live connector product pull in tools | Risk of fabric/live-http called from AI deps | Would bypass | Only Manager Supplier/Marketplace adapters call Fabric |
| **S14** | Any UI that might call Tavily or raw product APIs | (command bar uses SearchService — OK pattern) | Guard against new bypasses | Single `/search` (and internal port) only |

**Rule of thumb:** If code reaches Tavily, Prisma scan-for-search, KG projection-for-evidence, or connector catalog query **without** going through Search Manager — it is a **defect** relative to this architecture.

---

## 3. Target: Search Manager responsibilities

### 3.1 Owns

1. **Query intake** — normalize query, tenant, case context, filters, limits  
2. **Capability / source planning** — which adapters run (deterministic planner; optional future ranker still Manager-owned)  
3. **Adapter orchestration** — parallel/serial fan-out with timeouts  
4. **Normalization** — every adapter emits `SearchHit` + `SearchProvenance`  
5. **Merge & rank** — unified scoring policy  
6. **Honesty** — `dataMode`, mixed evidence, blocked sources  
7. **Capability catalog** — what callers may request  
8. **Idempotent evidence packages** — optional `search_evidence` payload for AI artifacts  

### 3.2 Does not own

- Generative synthesis (AI Runtime Phase B)  
- Commerce Case stage transitions  
- Connector install/OAuth  
- Durable workflow scheduling  
- Writing products/listings (discovery may **propose** imports via domain services separately)

---

## 4. Capability model (what AI Runtime may request)

AI Runtime (and tools) request **capabilities**, never providers:

| Capability id | Source family | Description | Typical provider/adapter |
|---------------|---------------|-------------|--------------------------|
| `internal_retrieval` | Internal Retrieval | Canonical products, cases, orders, connectors, AI runs | Prisma / internal indexes |
| `documents` | Documents | Tenant or system document corpus (policies, SOPs, uploaded docs) | Doc store / future index |
| `knowledge_graph` | Knowledge Graph | Related nodes/edges for case/product neighborhood as hits | `projectCaseKnowledgeGraph` + BO loaders |
| `public_search` | Public Search | Open web research hits | Tavily (sole web provider policy) |
| `public_extract` | Public Search | Extract one public URL | Tavily extract |
| `supplier_search` | Supplier Search | Supplier catalog / offers via authorized connectors | Connector Fabric ops |
| `marketplace_discovery` | Marketplace Discovery | Channel catalog / competitive discovery via authorized connectors | Connector Fabric ops |
| `official_documentation` | Official Documentation | Official API/docs biased retrieval | Docs corpus and/or constrained public search |

### 4.1 Request / response contracts

```ts
// Conceptual — packages/commerce-engine (or search package) + host SearchService

type SearchCapability =
  | 'internal_retrieval'
  | 'documents'
  | 'knowledge_graph'
  | 'public_search'
  | 'public_extract'
  | 'supplier_search'
  | 'marketplace_discovery'
  | 'official_documentation';

type SearchManagerRequest = {
  organizationId: string;
  query: string;
  /** Explicit capabilities; if omitted, planner selects from query + context */
  capabilities?: SearchCapability[];
  /** Soft planner hints from AI objective classification */
  intents?: string[];
  context?: {
    caseId?: string;
    productId?: string;
    userId?: string | null;
    loopMode?: string;
  };
  filters?: Record<string, unknown>;
  limit?: number;
  /** Prefer internal-only (default true unless capability forces external) */
  preferInternal?: boolean;
  /** Correlation for provenance */
  requestId?: string;
  traceId?: string;
};

type SearchManagerResponse = {
  query: string;
  plan: {
    query: string;
    normalizedQuery: string;
    intents: string[];
    capabilities: SearchCapability[];
    sources: SearchSourceKind[]; // legacy-compatible kinds
    preferInternal: boolean;
  };
  hits: SearchHit[];
  total: number;
  executionMs: number;
  honesty: {
    note: string;
    mixedEvidence: boolean;
    dataMode?: 'live' | 'fixture' | 'simulation' | 'shadow' | 'blocked';
    blockedCapabilities?: Array<{ capability: SearchCapability; reason: string }>;
  };
  /** Per-capability diagnostics for AI evidence brief */
  capabilityResults?: Array<{
    capability: SearchCapability;
    hitCount: number;
    latencyMs: number;
    blocked?: boolean;
    failed?: boolean;
    note?: string;
  }>;
};
```

Extend existing `SearchSourceKind` to cover all families explicitly:

```ts
type SearchSourceKind =
  | 'internal_product'
  | 'internal_case'
  | 'internal_order'
  | 'internal_connector'
  | 'connector_catalog'      // supplier / marketplace catalog via fabric
  | 'knowledge_graph'
  | 'documentation'          // documents + official docs (subtyped in provenance)
  | 'official_documentation'
  | 'supplier_catalog'
  | 'marketplace_catalog'
  | 'ai_run'
  | 'public_web'
  | 'mixed';
```

---

## 5. Adapter design

| Adapter | Input | Output | Notes |
|---------|-------|--------|-------|
| **InternalRetrievalAdapter** | query, filters, org | hits for product/case/order/connector/ai_run | Today’s `executeInternalSearch` body moves here |
| **DocumentsAdapter** | query, org | document hits | May be empty until corpus exists; still registered |
| **KnowledgeGraphAdapter** | caseId/productId/query | graph-neighbor hits | Build projection then map nodes/edges → `SearchHit` |
| **PublicSearchAdapter** | query, maxResults | public_web hits | **Owns Tavily client** (moved out of ai-runtime) |
| **PublicExtractAdapter** | url | single extract hit | Same provider package as public search |
| **SupplierSearchAdapter** | query, org, capabilities | supplier_catalog hits | Calls **Fabric** discover/search ops; fixture/live honesty |
| **MarketplaceDiscoveryAdapter** | query, org, channel hints | marketplace_catalog hits | Fabric only; never silent failover |
| **OfficialDocumentationAdapter** | query | official_documentation hits | Prefer internal docs index; optional constrained public with provenance `official_documentation` |

**Provider policy (public):** Tavily remains the sole configured public-web provider until policy changes — but it is an **adapter implementation detail**, invisible to AI Runtime.

**Fabric policy (supplier/marketplace):** Same as CONNECTOR_FLOW — install status, live vs fixture, normalize, provenance. Manager does not invent catalog rows.

---

## 6. AI Runtime integration (only capability requests)

### 6.1 Port

From AI Runtime architecture:

```ts
// packages/ai-runtime ports
interface SearchPort {
  search(req: SearchManagerRequest): Promise<SearchManagerResponse>;
}
```

Host `AiHostAdapter` injects `SearchPort` → Nest `SearchService` (Manager host).

### 6.2 Tools (normalized)

| Tool (keep or rename) | Today | Target |
|----------------------|-------|--------|
| `searchConnectedProducts` | `deps.searchProducts` / Prisma | `searchPort.search({ capabilities: ['internal_retrieval'], filters, query from objective })` — map product hits |
| `researchSearchPublicWeb` | direct Tavily | `searchPort.search({ capabilities: ['public_search'], query })` |
| `researchExtractUrl` | direct Tavily | `searchPort.search({ capabilities: ['public_extract'], query: url })` or dedicated extract field |
| `researchSearchOfficialDocumentation` | direct Tavily | `searchPort.search({ capabilities: ['official_documentation'], query })` |
| **New thin tools (optional collapse)** | — | Single `searchEvidence` tool with capability list; or keep named tools as **facades** over Manager |

**Recommended:** Keep named tools for permission clarity, but **every execute body** is one line: call SearchPort with the matching capability. No provider imports in `builtin-tools`.

### 6.3 Forbidden in ai-runtime package

- `web-search-provider.ts` Tavily HTTP (delete or rehome to search host package)  
- `bootstrapWebSearchProvider` in AI module init (bootstrap under Search module)  
- Any `fetch('https://api.tavily.com...')`  
- Prisma or product arrays as retrieval  

### 6.4 Operator cycle / engine

Phase A “retrieve” steps:

```text
1. Build SearchManagerRequest from objective + case context + classification filters
2. searchPort.search(request)  // may include multiple capabilities in one plan
3. Map hits → evidence package + candidate product/case IDs
4. Downstream tools (profit, policy) use BO ids — not re-query Prisma for “search”
```

Optional: one Manager call with  
`capabilities: ['internal_retrieval','public_search','knowledge_graph']`  
instead of three tool round-trips — still Manager-owned plan.

---

## 7. Host SearchService → full Manager

Today `SearchService.search` only runs internal docs.

**Target host method:**

```text
SearchService.search(organizationId, request: SearchManagerRequest)
  → plan = planSearchCapabilities(request)
  → for each capability in plan: adapter.execute (Promise.allSettled)
  → mergeSearchResponses / rank
  → attach honesty + blockedCapabilities
  → return SearchManagerResponse
```

**HTTP:** `GET/POST /api/v1/search` remains the **only** user-facing search API (command bar).  
**Internal:** same service method used by AI `SearchPort`.

No second “AI search” endpoint that skips Manager.

---

## 8. Planning rules (deterministic)

`planSearch` evolves to `planSearchCapabilities`:

| Signal in query / context | Capabilities added |
|---------------------------|--------------------|
| Default commerce | `internal_retrieval` |
| caseId present | `knowledge_graph` + internal case/product |
| order/ship/fulfill terms | internal orders |
| connector/supplier terms | `internal_retrieval` + `supplier_search` (if authorized) |
| marketplace/channel discover | `marketplace_discovery` when explicit |
| web/internet/public | `public_search` |
| doc/how/policy/SOP | `documents` + `official_documentation` |
| graph/related | `knowledge_graph` |
| AI objective research (operator default) | internal + optional public if research intent; KG if case-bound |
| `preferInternal: true` | suppress public/supplier/marketplace unless capability **explicitly** requested by tool |

AI tools that **name** a capability always include it; planner cannot drop an explicit capability (may mark blocked if unconfigured).

---

## 9. Provenance & dataMode

Every hit carries:

- `sourceKind`, `sourceId`, `connectorKey?`, `isFixture?`, `collectedAt`, `confidence`, `note?`  
- Provider name only in adapter-internal metadata if needed — **callers see source family + dataMode**, not “call Tavily”

Manager honesty:

- If public adapter blocked (no key) → `blockedCapabilities: [{ public_search, reason }]` — **no demo hits**  
- Mixed internal fixture + live web → `mixedEvidence: true`, envelope warnings for AI Response Contracts  

Aligns with Data Fabric labeling (audit A11).

---

## 10. Evidence artifacts

Search Manager responses are the sole input to:

- AI Runtime **Evidence** package (`search_evidence` artifact)  
- Case-attached evidence when case-bound (case-first orchestration)  

```text
SearchManagerResponse
  → EvidencePackage.fromSearch(response)
  → artifact kind search_evidence
  → Case artifact set + AI Run producer ref
```

---

## 11. Package placement

| Component | Target location |
|-----------|-----------------|
| Types, plan, merge, rank pure functions | `@tradeops/commerce-engine` (`search-orchestration.ts` expanded) or future `@tradeops/search` |
| Search Manager host orchestration | `apps/api` `SearchService` (name may become `SearchManagerService`) |
| Tavily / public adapter | `apps/api` search adapters **or** small `packages/search-providers` — **not** ai-runtime |
| Fabric supplier/marketplace adapters | API search adapters calling connector-core / live-http |
| KG adapter | commerce-engine projection + API loader |
| AI Runtime | `SearchPort` interface only; tools call port |

---

## 12. Sequence (target)

### AI research objective

```text
AiExecutionEngine
  → tool searchEvidence / research* / searchConnectedProducts
  → SearchPort.search({
       organizationId,
       query: objective slice,
       capabilities: [...],
       context: { caseId },
       filters: classification.filters,
     })
  → Search Manager plans + adapters
  → SearchManagerResponse
  → Evidence + product candidates
  → profit/policy tools on BO ids
  → Phase B
```

### Command bar

```text
UI → GET /search?q=
  → SearchService (same Manager)
  → SearchResponse hits → navigate
```

---

## 13. Migration / normalization sequence

1. **Expand** `SearchService` to accept capability list + context; keep internal path working.  
2. **Move** Tavily client from `ai-runtime/web-search-provider` → search adapter; wire `public_search` / `public_extract` / `official_documentation`.  
3. **Implement** `SearchPort` in host; change builtin tools S1–S3, S6 to use port only.  
4. **Remove** `deps.searchProducts` Prisma path; internal products only via Manager.  
5. **Stop** `loadOperatorProducts` as search; candidates from Manager hits (case multi-bind still case-first).  
6. **Add** KG adapter to Manager when `caseId` or graph intent.  
7. **Add** supplier/marketplace adapters via Fabric (fixture-safe).  
8. **Documents** adapter stub with honest empty/blocked until corpus exists.  
9. **Delete** public provider bootstrap from AI module; register under Search module.  
10. **Quarantine** any remaining direct provider imports in ai-runtime (CI grep guard).

---

## 14. Guardrails (enforceable)

| Guard | Check |
|-------|-------|
| No Tavily in ai-runtime | Package boundary / lint |
| No `product.findMany` in AI module for search | Only Case/BO ports for load-by-id |
| All AI retrieval tools call SearchPort | Code review + tests |
| UI search only `/search` | Already mostly true |
| Explicit capability cannot be silently replaced by another provider | Manager policy |

---

## 15. Mapping to prior audits

| Audit ID | Normalization |
|----------|---------------|
| **A5** Search Manager bypassed | Closed by single Manager path |
| **A6** Fabric incomplete for AI I/O | Supplier/marketplace search only via Manager→Fabric |
| **A7** KG unused by operator | KG adapter on Manager; case context injects capability |
| **A11** Mixed dataMode | Manager honesty + per-hit provenance |
| **A12** Normalize pipeline | Hits always `SearchHit` before AI |
| **A13** Duplication | One retrieval owner |

---

## 16. Closing judgment

**Search Manager is the sole retrieval orchestrator** for TradeOps.

- **Internal Retrieval, Documents, Knowledge Graph, Public Search, Supplier Search, Marketplace Discovery, Official Documentation** are **adapters**, not peer APIs for AI.  
- **AI Runtime requests capabilities** through `SearchPort` / tools that are pure facades.  
- **Tavily and Prisma search scans leave the runtime.**  
- **Command bar and AI share one Manager** so provenance and honesty never fork.

This is architectural consistency: replace every direct call in the inventory (S1–S14), not invent a second search product.
