# TradeOps Product Lifecycle Review

**Mode:** Professor / Architectural Review (read-only baseline)  
**Date:** 2026-07-18  
**Source of truth:** Repository code, Prisma schema, apps, packages, and implementation docs that describe shipped behavior  
**Scope rule:** Observations are grounded in what exists in the repository. Speculative “future product” claims are labeled only when the code explicitly marks something as planned, stub, shadow, or credential-blocked.

> **Update (same day):** Architectural reconciliation implemented — see [COS_RECONCILIATION_REPORT.md](./COS_RECONCILIATION_REPORT.md).  
> Case object workspace, unified search, connector fabric descriptors, AI prompt/schema registries, durable workflows, and stage-advance events are now in the codebase. Scorecard below remains the pre-reconciliation baseline for comparison.

---

## 0. Executive summary

TradeOps is implemented as a **monorepo Commerce Operating System** with:

| Layer | Implementation |
|-------|----------------|
| Web | Next.js 15 (`apps/web`) — public marketing + `/terminal/*` persona shell |
| API | NestJS (`apps/api`) — identity, commerce, AI, SaaS, capital, automation |
| Worker | BullMQ optional (`apps/worker`) — heartbeat + Google weekend job when Redis is up |
| Domain packages | commerce-engine, ai-runtime, connector-core, workflow-engine, database (Prisma), auth, config |
| Default access | `TRADEOPS_ACCESS_MODE=founder_direct` — no login; lands at `/terminal/workspace` |

**What works end-to-end today (fixture / local product):**

1. Founder enters workspace → persona home (intelligence surface)  
2. Discover products (scanner / fixture import) → product twin → score / signal  
3. Commerce Cases advance through a defined lifecycle board  
4. AI Operator runs typed objectives (research default, approval-gated consequential)  
5. Approvals, listings drafts, orders, finance views, connector ops (fixture-first)  
6. Public free tools, capability honesty board, marketing site (when not founder_direct)

**What is not a complete multi-tenant SaaS yet:**

- Live marketplace/supplier connectors require external credentials (honestly blocked)  
- Free-form LLM chat is optional / not the core path  
- Email verification, password reset, and true public multi-tenant onboarding are stubs or redirects  
- Capital / network surfaces are sandbox / deferred architecture  
- Right chrome is a single **AI Context Panel**, not separate Activity / Notifications / Artifacts panels  
- Many stages after “evaluate / qualify / draft” are fixture-backed or UI-filtered stage views

**Product maturity (overall):** strong **local founder MVP / alpha commerce OS** with unusually honest capability labeling; **not enterprise-ready multi-tenant production SaaS**.

---

## 1. Method and inventory basis

### 1.1 Apps and packages inspected

```
apps/web          — routes, terminal shell, AI panel, public site
apps/api          — Nest modules: commerce, ai, identity, billing, capital, automation, saas, public
apps/worker       — Redis/BullMQ platform jobs
packages/
  commerce-engine — lifecycle, workspace personas, scoring, intelligence
  ai-runtime      — tools, operator cycle, navigator, live examples
  connector-core  — registry, capabilities, normalization hooks
  connectors/*    — fixture-supplier, fixture-marketplace, google-merchant, live-http
  workflow-engine — 6 templates
  database        — Prisma models (identity → commerce → capital)
  domain/auth/config/logging/contracts/harmonization/saas-entitlements
```

### 1.2 Maturity labels used in this review

| Label | Meaning |
|-------|---------|
| **Complete** | UI + API + data path; usable for intended local/fixture purpose |
| **Functional** | Core path works; depth or live integrations incomplete |
| **Partial** | Foundations exist; critical subpaths missing or shadow-only |
| **Prototype** | Thin UI or schema scaffolding; limited behavior |
| **Disconnected** | Exists but outside primary nav / lifecycle spine |
| **Unused** | Redirect, stub, or dead-end for current default mode |
| **Unknown** | Insufficient code signal beyond presence |

Subsystem maturity uses: Concept · Prototype · MVP · Alpha · Beta · Production Ready · Enterprise Ready.

---

## 2. Complete user journey (as implemented)

### 2.1 Default mode: Direct Founder Access

```
Start app (pnpm start)
    ↓
PGlite / Postgres + API :4000 + Web :3000
    ↓
GET /  →  redirect /terminal/workspace
    ↓
Workspace Resolver (GET /api/v1/workspace)
    · resolves operating persona (default researcher if unset)
    · builds Focus + More sidebar
    · intelligence brief, priorities, recommended next action
    ↓
Persona home  /terminal/workspace/{persona}
    ↓
[Researcher path — default founder]
Product Discovery  /terminal
    → Import fixtures / scanner table
    → Product twin  /terminal/products/:id
    → Opportunities  /terminal/opportunities
    → Commerce Process  /terminal/process
    → Case journey  /terminal/process/:caseId
    → Advance stage (validated transitions)
    ↓
AI Operator (right panel or /terminal/ai)
    → POST /api/v1/ai/operator/run  (forceShadow common in panel)
    → OperatorRun + recommendations
    → Optional navigate to resultsPath / watchlist / listing draft
    ↓
Approvals  /terminal/approvals  (if consequential)
    ↓
Listings / Orders / Fulfillment stage views
    ↓
Finance (payments, payouts, reconciliation — fixture-capable)
    ↓
Objectives history  /terminal/objectives
    ↓
Repeat via persona home “next action” or AI focus objective
```

**No login, register, or onboarding** in this mode. Auth UI routes redirect into the workspace.

### 2.2 Authenticated / multi_tenant mode (architecture present)

```
Visitor → Landing /
    → Marketing pages (product, pricing, platform, solutions, tools)
    → Register / Login (session cookie)
    → Onboarding (segment foundations)
    → Terminal workspace (same commerce spine)
```

Session auth, org membership, RBAC permissions, and SaaS tenant endpoints exist. Email verify and forgot-password **do not implement full flows** (redirect stubs).

### 2.3 Journey stages mapped to code

| Journey stage | Customer experience in repo | Status |
|---------------|----------------------------|--------|
| Visitor | Public landing only when not founder_direct | Functional |
| Landing | Hero + pillars + health badge | Functional |
| Workspace | Persona resolver + intelligence home | Functional |
| Search / Discover | `/terminal` scanner + fixture import | Functional (fixture) |
| AI | Side panel + full AI page + objectives | Functional (typed tools; LLM optional) |
| Discovery | Same as scanner + AI research objectives | Functional |
| Evaluation | Opportunity score, policy, profit, product twin | Functional |
| Comparison | Limited (opportunity table rank; no multi-product compare UI) | Partial |
| Decision | Approvals queue + stage advance to approve | Functional foundations |
| Workflow | Template runs + Google weekend + demo loop | Partial |
| Approval | Approval model + decide endpoints + UI | Functional |
| Execution | Fixture publish/order paths; live blocked without creds | Partial |
| Monitoring | Process board, connectors, control-tower redirect, ops sync | Partial–Functional |
| Analytics | Portfolio, signals, cashflow, customers, prediction outcomes | Partial–Functional |
| Optimization | Learn stage, evaluatePredictionOutcome, forecast baseline | Partial |
| Repeat | Persona next action + AI focus objective | Functional |

---

## 3. Page inventory

### 3.1 Classification rubric

Applied per page: purpose · intended user · functionality · missing · inputs · outputs · dependencies · AI · connectors · workflow stage · maturity class.

---

### 3.2 Public / marketing surface

| Route | Purpose | User | Maturity | Notes |
|-------|---------|------|----------|-------|
| `/` | Entry | Visitor / founder | **Complete** (mode-aware) | founder_direct → workspace; else marketing |
| `/product` | Six pillars narrative | Visitor | **Functional** | Content page |
| `/platform` | Platform story | Visitor | **Functional** | |
| `/platform/plans` | Plan catalog | Admin / buyer | **Functional** | Tied to billing foundations |
| `/pricing` | Pricing narrative | Visitor | **Functional** | |
| `/solutions/[slug]` | Segment solutions | Visitor | **Functional** | Dynamic slugs |
| `/how-it-works` | Explainer | Visitor | **Functional** | |
| `/integrations` | Integration story | Visitor | **Partial** | Marketing; live hub is terminal connectors |
| `/about`, `/contact`, `/docs` | Site chrome | Visitor | **Prototype–Functional** | Light pages |
| `/security`, `/privacy`, `/terms`, `/acceptable-use` | Trust/legal | Visitor | **Prototype** | Static content |
| `/tools`, `/tools/profit`, `/score`, `/policy` | Free calculators | Visitor | **Complete** | Public API tools |
| `/status` | Capability honesty board | Dev / buyer | **Functional** | Aligns with product honesty posture |
| `/scanner` | Legacy discover entry | Researcher | **Unused** | Redirect → `/terminal` |
| `/login`, `/register` | Auth | Multi-tenant user | **Functional** when mode allows; **Unused** in founder_direct | |
| `/signup` | Alias | Same | **Unused** | Redirect → register |
| `/forgot-password`, `/verify-email` | Account recovery | Multi-tenant | **Unused / Prototype** | Redirect stubs; no full email flow |
| `/onboarding` | Segment setup | Admin | **Partial** | Foundations; redirected under founder_direct |

---

### 3.3 Terminal (Commerce OS)

| Route | Purpose | Persona primary | Workflow stage | Maturity |
|-------|---------|-----------------|----------------|----------|
| `/terminal/workspace` | Persona switcher / resolver entry | All / admin | Entry | **Functional** |
| `/terminal/workspace/[persona]` | Persona home (priorities, KPIs, procedures) | That persona | Focus | **Functional** |
| `/terminal` | Product discovery scanner | Researcher | discover | **Functional** |
| `/terminal/products/[productId]` | Product digital twin + media + handoff | Researcher/Operator | evaluate–prepare | **Functional** |
| `/terminal/opportunities` | Scored opportunity book | Researcher/Analyst | evaluate | **Functional** |
| `/terminal/watchlist` | Saved candidates | Researcher | discover | **Functional** |
| `/terminal/process` | Commerce Case board by stage | Operator (+all) | all stages | **Functional** |
| `/terminal/process/[caseId]` | Case journey, history, AI link | Operator | stage-specific | **Functional** |
| `/terminal/tasks` | Tasks/blockers derived from cases | Operator | process | **Functional** |
| `/terminal/listings` | Prepare/publish stage filter | Operator | prepare–publish | **Functional** foundations |
| `/terminal/orders` | Customer orders | Operator | sell–source | **Functional** foundations |
| `/terminal/fulfillment` | Shipments stage view | Operator | fulfill | **Functional** foundations |
| `/terminal/approvals` | Human gates | Executive/Operator | approve | **Functional** |
| `/terminal/signals` | Commerce signals feed | Analyst | learn/eval | **Functional** |
| `/terminal/portfolio` | Portfolio outcomes | Exec/Analyst | analytics | **Functional** |
| `/terminal/cashflow` | Cash exposure | Executive | analytics | **Functional** |
| `/terminal/customers` | Customer intelligence | Analyst | analytics | **Partial–Functional** |
| `/terminal/control-tower` | Legacy | Exec | — | **Unused** | Redirect → executive workspace |
| `/terminal/cockpit` | Legacy command center | Exec | — | **Unused** | Redirect → executive workspace |
| `/terminal/pipeline` | Legacy pipeline | Operator | — | **Unused** | Redirect → process |
| `/terminal/ai` | Full AI Operator console | All | cross-cutting | **Functional** |
| `/terminal/objectives` | Operator run history | All | monitoring | **Functional** |
| `/terminal/objectives/[id]` | Execution package detail | All | monitoring | **Functional** |
| `/terminal/live-examples` | Honest demo catalog | Developer | diagnostics | **Functional** foundations |
| `/terminal/connectors` | Connector ops center | Developer | ops | **Functional** |
| `/terminal/ecosystem` | Capabilities, partners, knowledge graph | Developer | ops | **Functional** foundations |
| `/terminal/automations` | Workflow templates + weekend Google | Developer | automation | **Partial–Functional** |
| `/terminal/agency` | Agency multi-client | Administrator | admin | **Partial** |
| `/terminal/finance/payments` | Channel payments | Operator | reconcile | **Functional** foundations |
| `/terminal/finance/payouts` | Payouts | Operator | reconcile | **Functional** foundations |
| `/terminal/finance/reconciliation` | Recon board | Operator/Exec | reconcile | **Functional** foundations |
| `/terminal/finance/disputes` | Disputes | Operator | reconcile | **Partial–Functional** |

**Shell chrome (not separate pages):**

| Surface | Implementation | Classification |
|---------|----------------|----------------|
| Left sidebar | Dynamic from `ResolvedWorkspace.nav` (Focus + More) | **Complete** for persona model |
| Right panel | `AiContextPanel` only | **Functional** AI tool panel |
| Top command bar | Env, access mode, org, connectors summary | **Functional** |

There are **no** dedicated right-sidebar pages for Activity, Notifications, Artifacts, Execution, or History. History lives at `/terminal/objectives`; artifacts live on product twin; execution timeline is **inside** AI responses / objective detail.

---

### 3.4 App / system / capital / network

| Route | Purpose | Maturity | Lifecycle role |
|-------|---------|----------|----------------|
| `/app` | System surface | **Partial** | Admin / release |
| `/app/billing` | SaaS subscription | **Functional** foundations | Retention / monetization |
| `/app/release-readiness` | Deploy readiness | **Functional** | Ops |
| `/capital/*` | Capital sandbox | **Prototype–Partial** | **Disconnected** from primary commerce OS |
| `/network/*` | Capital network views | **Prototype–Partial** | **Disconnected**; honesty: not investment portal |

Code and UI explicitly mark capital as **deferred / not primary product**.

---

### 3.5 Page-level detail (primary terminal set)

#### `/terminal/workspace` + `/terminal/workspace/[persona]`

| Field | Current state |
|-------|---------------|
| Purpose | Resolve persona; show intelligence surface |
| User | All operating personas |
| Functionality | Priorities, KPIs, alerts, procedures, next action, switch persona |
| Missing | Deep real-time collaboration; multi-user presence |
| Inputs | Membership.workspacePersona, org metrics, cases, connectors |
| Outputs | Nav groups, focus objective, AI preamble |
| Dependencies | `WorkspaceService` + commerce-engine `resolveWorkspace` |
| AI | Persona-scoped default objectives and tool allowlists |
| Connectors | Connector issue counts influence badges |
| Workflow stage | Pre-process focus |
| Maturity | **Functional** |

#### `/terminal` (Discover)

| Field | Current state |
|-------|---------------|
| Purpose | Import/scan products into Discover |
| User | Researcher |
| Functionality | Scanner table, fixture import toolbar, process links |
| Missing | Live multi-supplier search UI beyond fixtures/creds |
| Inputs | Products + opportunities |
| Outputs | Rows for evaluation |
| Stage | discover |
| Maturity | **Functional** (fixture-primary) |

#### `/terminal/process` + case journey

| Field | Current state |
|-------|---------------|
| Purpose | Single process spine for Commerce Cases |
| Functionality | By-stage board, sync, next actions, friction/state overlays |
| Missing | Full automated stage progression for all live channels |
| Stage | entire lifecycle |
| Maturity | **Functional** foundations |

#### `/terminal/ai` + AiContextPanel

| Field | Current state |
|-------|---------------|
| Purpose | Objective → plan → tools → recommendations |
| Functionality | Typed operator run, timeline UI states, next actions |
| Missing | True streaming LLM; rich multi-turn memory beyond OperatorRun knowledge delta |
| AI tools | 15 registered builtins (see §8) |
| Maturity | **Functional** (objective engine), **Partial** (generative LLM) |

#### Finance, orders, listings, fulfillment

Stage-filtered UIs over shared case/order records — **not** independent micro-products. Maturity: **Functional foundations** on fixture data.

---

## 4. Product lifecycle map

### 4.1 Canonical commerce lifecycle (code)

From `packages/commerce-engine/src/commerce-lifecycle.ts`:

```
discover → evaluate → qualify → prepare → approve → publish
    → sell → source → fulfill → reconcile → learn → closed
```

Validated transitions and requirement checks exist (e.g. publish needs approval + connector capability; source needs paid order).

### 4.2 Extended product lifecycle (customer lens) vs implementation

| Stage | Exists? | Completeness | Duplication | Notes |
|-------|---------|--------------|-------------|-------|
| Need / intent | Partial | Persona default objectives + AI classify | — | No dedicated “business goal” CRM object |
| Research | Yes | Researcher persona + AI research | Overlaps Discover | |
| Discovery | Yes | Scanner, import, watchlist | `/scanner` redirect | |
| Product search | Partial | Fixture search + org product search tool | Live search credential-gated | |
| Supplier search | Partial | Fixture supplier connector | No multi-supplier compare UI | |
| Evaluation | Yes | Score, profit, policy, product twin | Free tools duplicate calculators | Intentional public vs terminal |
| Comparison | Partial | Ranking tables | No A/B side-by-side | |
| Risk review | Yes | Policy assessments, blockers, control tower merge | | |
| Decision | Yes | Approvals + stage approve | | |
| Purchase / PO | Partial | Supplier PO models + approval path | Live submit blocked | |
| Payment | Partial | CommercePayment + SaaS billing (separate domains) | Two “payment” concepts | Correctly separated |
| Shipping | Partial | Fulfillment models + stage view | Live logistics connectors gated | |
| Receiving | Minimal | Not a first-class stage | Mapped into fulfill/reconcile | |
| Inventory | Partial | Connector inventory capabilities; ATP foundations | No full WMS | |
| Operations | Yes | Operator persona + process + tasks | | |
| Analytics | Partial–Yes | Portfolio, signals, customers, outcomes | Capital portfolio separate | |
| Optimization | Partial | Learn stage + forecast baseline MA | Neural forecast stub | |
| Retention | Partial | SaaS packs/quotas; no full customer success suite | | |
| Automation | Partial | 6 templates + weekend Google + ops scheduler | | |

### 4.3 Lifecycle gaps (honest)

1. **Live publish / live order ingest** — blocked on credentials; fixtures complete the loop.  
2. **Comparison / negotiation** — thin.  
3. **Receiving / returns** — schema fragments; not full UX.  
4. **Closed-loop learning** — foundations (PredictionOutcome, evaluate tool); not production ML ops.  
5. **Capital lifecycle** — parallel sandbox, not commerce spine.

### 4.4 Duplicated lifecycle surfaces (intentional consolidation still incomplete)

| Duplicate pair | Resolution in code |
|----------------|-------------------|
| Pipeline vs Process | Pipeline redirects to Process |
| Cockpit / Control tower vs Executive home | Redirects to executive workspace |
| Scanner vs `/terminal` | Scanner redirects |
| Free tools vs terminal scoring | Parallel by design (public vs authenticated twin) |
| Capital portfolio vs terminal portfolio | Different domains; risk of term confusion |

---

## 5. Left sidebar review

### 5.1 How it is built

- **Not** static feature lists.  
- Server: `WorkspaceService.resolve` → commerce-engine `buildPersonaNav`.  
- Groups: **Focus** (primary ≤6 items) + **More** (collapsed by default).  
- Badges: open tasks, pending approvals, blockers, connector issues.  
- Principle string: *One User · One Workspace · One Objective · One AI*.

### 5.2 Primary nav by persona (as coded)

| Persona | Focus items |
|---------|-------------|
| Executive | Executive Brief, Objectives, Decisions, Revenue, AI Advisor |
| Operator | Operator home, Tasks, Orders, Cases, Shipments, AI Operator |
| Researcher | Research home, Product Discovery, Opportunities, Cases, AI Research |
| Analyst | Analyst home, Signals, Portfolio, Customers, AI Analyst |
| Developer | Developer home, Connectors, Runtime, Automations, AI Tools |
| Administrator | Admin home, Personas, Billing, System, AI Admin |

### 5.3 Assessment per nav concern

| Question | Finding |
|----------|---------|
| Why does it exist? | Persona procedure orientation, not feature dump |
| Correct order? | Largely yes for each persona’s mission |
| Merge candidates? | Finance subpages stay under More for operator (good); opportunities appear in researcher Focus and analyst More |
| Become workflow? | Procedures already inject as More deep-links (`?procedure=`) |
| Become tab? | Finance could be tabs on one “Channel finance” surface (not done) |
| Become AI capability? | Diagnostics / ranking already better as AI tools |
| Admin only? | Billing, personas, agency correctly admin-weighted |
| Disappear? | Legacy routes already redirected; capital/network correctly **outside** terminal sidebar |

### 5.4 Recommendations (design only — not implemented)

1. Keep Focus lean; resist re-expanding feature nav.  
2. Surface **one** “Money” entry for operators (payments/payouts/recon as tabs).  
3. Keep capital/network **out** of default commerce chrome.  
4. Ensure “More → procedure” links complete full steps (some steps share same href).

---

## 6. Right sidebar review

### 6.1 Actual implementation

| Expected concept | Reality in codebase |
|------------------|---------------------|
| AI Operator | **Yes** — `AiContextPanel` docked right; toggle open/closed |
| Activity | **No** dedicated panel; timeline inside AI result |
| Notifications | **No** notification center component |
| Artifacts | **No** right rail; product artifact APIs + product page Media Workspace |
| Execution | **No** separate rail; objective detail page + AI timeline |
| History | **No** right rail; `/terminal/objectives` + sessionStorage last AI run |

### 6.2 Classification of right chrome

| Surface | Type | Persistence |
|---------|------|-------------|
| AI Context Panel | **Tool + context** (persona preamble, quick objectives, run, results) | Session restore of last run (`sessionStorage`) |
| Full AI page | **Workflow** for heavy objectives | Server OperatorRun records |
| Objectives pages | **History / execution audit** | Persistent DB |

### 6.3 Verdict

Right sidebar is correctly an **AI Operator tool panel**, not a multi-tab ops console. Docs/product language that lists Activity / Notifications / Artifacts as peer rails **overstates UI**. Those concerns exist as **data models and pages**, not as right-rail modules.

---

## 7. User personas

### 7.1 Operating personas (primary product surface)

Defined in `packages/commerce-engine/src/workspace.ts`:

| Persona | Goals | Primary pages | AI posture | Connectors | Permissions (system) |
|---------|-------|---------------|------------|------------|----------------------|
| **Executive** | KPIs, risk, approvals, cash | workspace/executive, objectives, approvals, portfolio | Advisor / board-level | Summary health | Role-based via membership |
| **Operator** | Listing → publish → order → fulfill | tasks, orders, process, fulfillment | Action-oriented operator | Publish/fulfill readiness | products/orders write where role allows |
| **Researcher** | Discover, evaluate, recommend | discover, opportunities, process | Research-only defaults | Supplier/search | products read |
| **Analyst** | Signals, portfolio, customers, learn | signals, portfolio, customers | Analysis tools | Data freshness | analytics read |
| **Developer** | Connectors, workflows, diagnostics | connectors, ecosystem, automations | Diagnostics / shadow | Full ops hub | connectors |
| **Administrator** | Org, access, billing | workspace switcher, billing, app, agency | Admin tools | Install posture | org:write |

### 7.2 Legacy stored personas (mapped)

| Stored value | Maps to |
|--------------|---------|
| founder | researcher |
| procurement | operator |
| finance | executive |
| agency | administrator |
| auditor | executive |

### 7.3 Implementation quality

| Area | Status |
|------|--------|
| Persona definitions + procedures | **Implemented** |
| Dynamic nav + AI preamble | **Implemented** |
| Persona home intelligence surface | **Implemented** |
| Hard isolation of permissions **by persona** (vs system role) | **Partial** — persona steers UX; RBAC is role/permission based |
| Multi-persona multi-user concurrent SaaS | **Partial** (schema + membership; founder_direct hides complexity) |
| Agency segment | **Partial** foundations |

### 7.4 Missing per persona (code-backed)

- Executive: live KPI accuracy depends on fixture/live mix honesty (labeled).  
- Operator: live publish/PO execution without credentials remains blocked.  
- Researcher: multi-source live discovery incomplete.  
- Analyst: neural/advanced forecasting stub.  
- Developer: visual workflow builder not present.  
- Administrator: email verify, seat admin UX depth, Stripe live charges optional/fixture.

---

## 8. Data flow review

### 8.1 Happy path (fixture commerce)

```
Import fixtures / supplier adapter
    ↓
Canonical Product (+ offers, media artifacts)
    ↓
Opportunity score / policy / forecast (commerce-engine)
    ↓
CommerceSignal + ProfitabilitySnapshot
    ↓
CommerceCase (discover…)
    ↓
AI Operator (searchConnectedProducts, score, draftListing, …)
    ↓
OperatorRun + OperatorRecommendation (+ optional Execution Package)
    ↓
Approval (if consequential)
    ↓
Listing draft / fixture marketplace actions
    ↓
CustomerOrder → PO → Fulfillment (fixture path)
    ↓
CommercePayment / Payout / Reconciliation
    ↓
PredictionOutcome / learn stage
    ↓
Event fabric (CommerceEvent) + AuditEvent
```

### 8.2 Break points

| Break | Evidence |
|-------|----------|
| Live connector → product | Credentials missing → honest `credentials_required` / blocked |
| Normalization depth | Present in connector-core; live depth varies by adapter |
| Knowledge graph | Projection API on ecosystem; not a full graph DB product |
| AI memory | Prior knowledge from recent OperatorRuns only |
| Streaming responses | UI simulates progress steps; single HTTP response from operator/run |
| Workflow durability | Templates run in-process; persist as OperatorRun; no full durable DAG worker for all templates |
| Redis worker | Optional; API in-process scheduler covers some jobs |
| Capital ledger | Separate domain; not fed by default commerce demo loop |

### 8.3 Public tools path (no tenant)

```
Browser free tools → PublicToolsController → commerce-engine pure functions
```

Does not write Commerce Cases unless user is in terminal and imports data.

---

## 9. AI review

### 9.1 Architecture present

| Component | Status |
|-----------|--------|
| Typed tool registry | **Exists** (`tool-registry`, `builtin-tools`) |
| Operator cycle | **Exists** (`runOperatorCycle`) — classify → plan → tools → critic/auditor |
| Critic / auditor passes | **Exists** |
| Loop modes | fixture, development, shadow, controlled_live, automated_live |
| Execution Navigator / package | **Exists** (10-section package builder) |
| Live examples framework | **Exists** |
| Persistence | OperatorRun, OperatorRecommendation, ShadowDecision |
| Persona tool allowlists | **Exists** (`aiToolsForPersona`) |
| Host dependency injection | API injects commerce/billing/ecosystem deps into tools |

### 9.2 Registered tools (15)

1. `listConnectorCapabilities`  
2. `searchConnectedProducts`  
3. `calculateContributionProfit`  
4. `assessPolicyRisk`  
5. `scoreOpportunity`  
6. `draftListing`  
7. `evaluatePredictionOutcome`  
8. `getBillingStatus`  
9. `createBillingCheckout`  
10. `openBillingPortal`  
11. `inspectOrderPayment`  
12. `inspectPayout`  
13. `reconcilePayout`  
14. `explainPaymentVariance`  
15. `prepareRefundAction`  

### 9.3 AI components: present vs missing

| Capability | Present? |
|------------|----------|
| Prompt / objective classification | Yes (rule-based NLP-ish regex filters) |
| Execution planning | Yes (operator cycle) |
| Tool calling | Yes (typed registry) |
| Schemas | JSON Schema-ish inputSchema per tool |
| Artifacts | Product artifacts separate; AI analyze is rule multimodal proposal |
| Responses | Structured API JSON + UI rendering |
| Streaming | **Missing** as real token stream |
| Long-term memory | **Partial** (run history knowledge delta) |
| Retrieval (RAG over docs) | **Missing** as product feature |
| Search | Product search tool only |
| Classification | Objective type classification yes |
| Planning | Yes |
| Validation / critic | Yes |
| Free-form LLM | **Optional** — not required for core path; env keys for OpenAI/Anthropic/xAI listed in live-http probes |
| Multi-agent orchestration | **No** beyond critic/auditor |

### 9.4 AI maturity

**Alpha** as an **Objective Resolution Engine** with strong safety posture.  
**Prototype** as a conversational multimodal LLM product.

---

## 10. Connectors review

### 10.1 Implemented packages

| Connector | Implementation | Auth | Capabilities | Workflow integration | Lifecycle coverage |
|-----------|----------------|------|--------------|----------------------|--------------------|
| **fixture-supplier** | Full local adapter + catalog | none | search, inventory, shipping quote, images | Import fixtures, demo loop | discover–evaluate |
| **fixture-marketplace** | Local marketplace adapter | none | listing, orders, fees | Publish/order fixture path | publish–sell |
| **google-merchant** | Manifest + weekend prepare; live post credential-gated | OAuth env | listing/media-related declared | `google:weekend`, automation service | prepare–publish (shadow default) |
| **live-http** | Credential probes + selective live fetch helpers | env keys per provider | many provider keys registered | Ops live-sync / readiness | **Partial** — ready only when env set |

### 10.2 Registry breadth vs depth

`live-feed-registry` and ops center list many providers (Shopify, Amazon, eBay, AliExpress, Woo, BigCommerce, Stripe, logistics, ads, analytics, tax, LLM providers, etc.).

**Honest status:** most are **registry entries + credential probes**, not full bi-directional commerce connectors. Frontend and docs label fixture vs live.

### 10.3 Connector lifecycle stages missing (typical)

| Stage | Typical gap |
|-------|-------------|
| OAuth UI / token vault | Env-based; no full credential vault UI |
| Webhook verify + process | Models + endpoints foundations; depth varies |
| Continuous sync | Ops scheduler exists; not full multi-provider ETL |
| Conflict resolution | Limited |
| Production multi-store | Schema org-scoped installs; UX partial |

### 10.4 Connector maturity

| Class | Maturity |
|-------|----------|
| Fixture pair | **MVP / Alpha** for local product |
| Google Merchant shadow weekend | **Alpha** |
| Live HTTP selective | **Prototype–Partial** |
| Full marketplace production connectors | **Concept–Prototype** (blocked on credentials + implementation depth) |

---

## 11. Workflows review

### 11.1 Workflow templates (`workflow-engine`)

| Key | Trigger | Approval | executionStatus |
|-----|---------|----------|-----------------|
| product_opportunity_discovery | scheduled_interval | no | operational_partial |
| margin_protection | supplier_cost_change | yes | shadow_only |
| inventory_protection | supplier_stock_change | yes | coming_soon |
| supplier_routing | marketplace_order | yes | operational_partial |
| delivery_exception | tracking_delay | yes | coming_soon |
| forecast_evaluation | forecast_horizon | no | operational_partial |

Runs: `WorkflowService.runTemplate` → dryRun default true → persist OperatorRun → events + audit + usage meter.

### 11.2 Other workflows / procedures

| Kind | Examples | Maturity |
|------|----------|----------|
| Persona procedures | research_*, ops_*, exec_*, analyst_*, dev_*, admin_* | Documented steps + nav; not a separate workflow engine |
| Commerce case transitions | STAGE_TRANSITIONS + requirements | **Functional** validation |
| Demo commerce loop | `pnpm run demo:loop` + UI button | **Functional** fixture E2E |
| Google weekend | shadow prepare; live blocked | **Partial** |
| AI operator cycle | objective packages | **Functional** foundations |
| Ops sync scheduler | webhook drain, connector probe, live HTTP interval | **Partial–Functional** |
| BullMQ worker | heartbeat + weekend job if Redis | **Partial** (optional) |

### 11.3 Workflow maturity summary

- **Start:** templates, AI objectives, case create, demo loop — exist.  
- **Middle:** shadow/partial step execution — common.  
- **End:** full live external mutation — often blocked or dry-run.  
- **Approvals:** first-class for consequential AI + finance.  
- **Automation maturity:** **Alpha** for template catalog; **Prototype** for durable event-driven automation at scale.

---

## 12. Product maturity by subsystem

| Subsystem | Maturity |
|-----------|----------|
| Monorepo / local start / PGlite bootstrap | **Beta** (local), not cloud deploy productized |
| Direct Founder Access product | **Alpha–Beta** |
| Session auth + RBAC foundations | **Alpha** |
| Multi-tenant SaaS launch | **Prototype–Alpha** |
| Persona workspace model | **Alpha** |
| Commerce lifecycle engine | **Alpha** |
| Discover / evaluate / score | **Alpha** |
| Approvals | **Alpha** |
| Listings / orders / fulfill UI | **MVP–Alpha** (fixture) |
| Finance channel domain | **MVP–Alpha** |
| SaaS billing | **MVP–Alpha** (fixture/dev Stripe path) |
| AI objective engine | **Alpha** |
| Free-form LLM product | **Concept–Prototype** |
| Connector fabric (fixtures) | **Alpha** |
| Connector fabric (live) | **Prototype** |
| Workflow engine | **MVP–Alpha** |
| Event fabric | **MVP–Alpha** |
| Knowledge graph projection | **MVP** |
| Capital / network | **Prototype** (sandbox, honesty banners) |
| Observability | **MVP** (logs, health; limited APM) |
| Security production hardening | **MVP** (foundations; not enterprise cert posture) |
| Public marketing site | **MVP–Alpha** |
| Worker / queues | **MVP** optional |

---

## 13. UX review

| Dimension | Observation |
|-----------|-------------|
| Navigation complexity | **Improved** by persona Focus/More; still many deep routes |
| Workflow complexity | Process spine helps; finance + capital add cognitive load if discovered |
| Too many pages | Yes historically; consolidations via redirects are good |
| Too many clicks | Research path is reasonable; multi-stage advance still manual |
| Dead ends | Auth recovery stubs; capital solicitation disabled by design |
| Disconnected experiences | Capital/network vs terminal; public tools vs cases |
| Missing context | Right rail AI carries context; no global notification inbox |
| Duplicate UI | Free tools vs terminal calculators; portfolio naming across capital |
| Hidden capabilities | Ecosystem graph, live examples, many AI tools |
| Confusing terminology | “Portfolio”, “Payments” (SaaS vs channel), “Capital”, “Process vs Pipeline” (mitigated by redirects) |

**UX maturity:** **Alpha** for founder commerce OS; **Prototype** for self-serve multi-tenant onboarding.

---

## 14. Platform architecture maturity

| Fabric | What exists | Maturity |
|--------|-------------|----------|
| **Data Fabric** | Prisma canonical models org-scoped; products, cases, payments, events | **Alpha** |
| **Connector Fabric** | Manifests, live feed registry, ops health, fixture adapters | **MVP–Alpha** |
| **AI Runtime** | Tool registry, operator cycle, navigator | **Alpha** |
| **Workflow Engine** | Code templates + runner + metering | **MVP–Alpha** |
| **Search Layer** | Product search in-org; no full enterprise search | **MVP** |
| **Retrieval Layer** | Prior OperatorRun knowledge only | **Prototype** |
| **Knowledge Graph** | Ecosystem projection over relational models | **MVP** |
| **Event System** | EventFabricService → CommerceEvent, webhooks | **MVP–Alpha** |
| **Observability** | Health endpoints, pino logging, optional GA4 | **MVP** |
| **Security** | Sessions, guards, permissions, artifact SSRF controls, rate limit service | **MVP–Alpha** |
| **Permissions** | Role → permissions (`@tradeops/domain`) | **Alpha** |
| **Multi-tenancy** | Organization + membership + org filters | **Alpha** foundations |
| **Operations Center** | Connectors page + ops endpoints + schedulers | **Alpha** |

---

## 15. Top 100 missing pieces

Ranked by Critical / High / Medium / Low. “Missing” means **not production-complete for multi-tenant SaaS**, even if foundations exist.

### Critical (1–20)

1. Live Shopify connector full product/order sync (credential-complete product path)  
2. Live Amazon SP-API path beyond registry  
3. Live eBay sell path beyond registry  
4. Merchant credential vault UI (OAuth install UX)  
5. Production multi-tenant auth (email verify, password reset, invite flows)  
6. Hard tenant isolation audit coverage continuous in CI for all new tables  
7. Real Stripe SaaS charge path as default (not only fixture)  
8. Production deploy runbook automation (cloud staging)  
9. Secrets management (not .env on disk for production)  
10. Live publish listing path with real marketplace confirmation  
11. Webhook signature verification for primary channels end-to-end  
12. Durable workflow engine for long-running multi-step jobs  
13. Idempotent live write operations with reconciliation  
14. Backup / restore story for production Postgres  
15. Rate limiting and abuse protection on public tools at scale  
16. Session hardening (rotation, device, CSRF full matrix)  
17. Audit export for enterprise customers  
18. Support for multiple sales channels per org with clear failover  
19. Honest SLA/uptime monitoring for API  
20. Data retention / deletion (GDPR-style) productization  

### High (21–45)

21. Side-by-side product comparison UI  
22. Multi-supplier quote comparison workflow  
23. Returns / RMA lifecycle UI  
24. Receiving / inventory adjustment workflows  
25. Notification center (in-app)  
26. Email / Slack notification delivery  
27. True LLM streaming responses  
28. Configurable RAG knowledge base for SOPs  
29. Human-in-loop approval UX polish (bulk, SLAs)  
30. Visual workflow builder  
31. Event-driven triggers for all 6 templates (not manual dry-run)  
32. Continuous connector health with auto-remediation playbooks  
33. ATP accuracy with live inventory  
34. Channel profitability with live fees  
35. Customer intelligence depth beyond foundations  
36. Agency multi-client switching UX  
37. Role × persona permission matrix documentation in product UI  
38. Onboarding checklist that creates first live connector  
39. Sandbox vs production environment switcher in UI  
40. Media enrichment beyond rule analysis (true multimodal)  
41. Forecast models beyond baseline MA  
42. Closed-loop learning dashboards  
43. Dispute handling beyond list UI  
44. Tax / landed cost connectors wired into evaluation  
45. Search across cases, orders, artifacts (global command palette depth)  

### Medium (46–75)

46. Unified “Money” finance tabs  
47. Artifact gallery as first-class right-context panel  
48. Activity feed timeline (non-AI)  
49. Saved AI prompt library per persona  
50. Objective templates marketplace  
51. Mobile-responsive terminal density  
52. Keyboard-first command palette coverage of all routes  
53. Bulk case advance  
54. CSV import/export for products  
55. BYOD data import  
56. Segment-specific default personas  
57. Partner success scoring depth  
58. Knowledge graph exploration UI polish  
59. Shadow vs live badge consistency on every card  
60. Simulation mode education in onboarding  
61. Worker required for production (not optional Redis)  
62. Queue dashboards  
63. Feature flags service  
64. Usage-based billing meters UI clarity  
65. Plan entitlement enforcement on every AI tool  
66. SOC2 control mapping artifacts  
67. SSO / SAML  
68. SCIM provisioning  
69. IP allowlists  
70. Custom roles  
71. Field-level permissions  
72. Localization / multi-currency UI completeness  
73. Timezone-aware weekend jobs per merchant  
74. A/B listing experiments  
75. Ad spend connectors operational path  

### Low (76–100)

76. Remove remaining deprecated nav modules  
77. Collapse capital into optional lab with single entry  
78. Rename confusing “portfolio” collisions  
79. Dark/light theme polish across all pages  
80. Empty-state illustrations consistency  
81. More live examples in catalog  
82. Public changelog page wired to release notes  
83. In-app docs browser  
84. Founder menu IA simplification  
85. Reduce duplicate component files (ai-operator-console dual paths)  
86. Deprecate unused env vars documentation  
87. Storybook / component gallery  
88. Playwright full journey suite beyond smoke  
89. Load testing harness  
90. Chaos tests for PGlite vs Postgres  
91. Accessibility audit AA  
92. SEO content depth for solutions  
93. Blog / education content system  
94. Partner referral program  
95. In-product NPS  
96. Template versioning UI  
97. Connector SDK externalization  
98. GraphQL gateway (if ever needed)  
99. Mobile native apps  
100. Offline mode  

---

## 16. Duplicates inventory

### 16.1 Pages / routes

| Duplicate | Resolution |
|-----------|------------|
| `/scanner` vs `/terminal` | Redirect |
| `/terminal/pipeline` vs `/terminal/process` | Redirect |
| `/terminal/cockpit` & `/control-tower` vs executive workspace | Redirect |
| `/signup` vs `/register` | Redirect |
| Free tools vs terminal scoring | Parallel (public vs OS) |
| Capital portfolio vs terminal portfolio | Different domains; naming clash |
| Network capital vs capital campaigns | Overlapping capital sandbox |

### 16.2 APIs / services

| Area | Note |
|------|------|
| Billing vs commerce payments | Intentionally separate domains |
| AI operator/run vs navigator/resolve | Related; both produce execution packages |
| Ecosystem intelligence vs workspace intelligence | Related signals; different aggregators |
| Commerce process vs commerce state vs commerce runtime | Three lenses on cases — powerful but cognitive load |

### 16.3 Components

| Duplicate | Evidence |
|-----------|----------|
| `ai-operator-console` / `ai-side-panel` at components root and `components/ai/` | Dual paths |
| `auth-forms`, `founder-menu`, `public-site-nav`, `watchlist-button`, `ga4`, `demo-loop-button` | Flat + nested copies pattern |
| Status badge primitives | Multiple status-badge modules |

### 16.4 Workflows / prompts / schemas

| Kind | Note |
|------|------|
| Persona procedures vs workflow templates | Parallel automation concepts |
| Objective quick prompts | Repeated in panel, AI page, persona defaults |
| Prisma capital models vs commerce models | Large parallel financial schema |

### 16.5 Connectors

Registry lists many providers; **implementation packages** only four under `packages/connectors/*`. Registry breadth is not the same as connector depth (honesty docs acknowledge this).

---

## 17. Orphaned / underused components

### 17.1 Routes

| Item | Status |
|------|--------|
| Auth recovery pages | Stub redirects |
| Capital & network trees | Outside primary nav; sandbox |
| Legacy redirects | Intentionally orphaned entry points |

### 17.2 UI concepts not present as rails

Activity, Notifications, Artifacts, Execution, History as **right sidebar modules** — not implemented as such (see §6).

### 17.3 Backend / infra

| Item | Status |
|------|--------|
| Worker without Redis | Exits cleanly; API schedulers remain |
| Many live-http provider probes | Unused until env configured |
| Embedded-postgres path | Often blocked on Windows App Control; PGlite preferred |
| Neural forecasting | Stub / baseline only |

### 17.4 Docs vs code

Large `docs/TRADEOPS_*.md` corpus describes vision; `TRADEOPS_EXECUTION_STATUS.md` is the honesty ledger. Many doc-only features are **not** code orphans—they are **unbuilt**.

### 17.5 Deprecated client modules

| Module | Note |
|--------|------|
| `nav-groups.ts` | Deprecated; workspace nav preferred |
| `persona-nav.ts` | Deprecated fallback |

---

## 18. Recommended product lifecycle (proposal only)

Ideal lifecycle **based on what the repo already models**, simplified for a real SaaS customer:

```
1. Acquire
   Marketing → free tools → signup → email verify → create org

2. Activate
   Onboarding segment → choose persona → connect first channel (OAuth)
   → import or sync catalog → first Commerce Cases in Discover

3. Research loop
   Discover → Evaluate → Qualify
   AI research objectives (read-only) → watchlist → handoff tasks

4. Launch loop
   Prepare (media + listing draft) → Approve → Publish (live connector)
   Monitor listing health

5. Order-to-cash loop
   Sell → Source (paid gate) → Fulfill → Reconcile
   Exceptions → Approvals for refunds/pauses

6. Learn loop
   Outcomes vs forecasts → signals → portfolio decisions
   Feed policy + scoring weights

7. Automate
   Enable templates only where connectors healthy
   Shadow → controlled_live with approval SLAs

8. Expand
   More channels, agency clients, higher plan entitlements
   Optional capital lab remains gated and non-default

9. Operate platform
   Connector ops, audit, billing, release readiness
```

**Design rules already encoded that should remain law:**

- One process spine (Commerce Cases)  
- Persona-scoped chrome  
- AI as objective engine with tool risk classes  
- Fixture never labeled live  
- Channel money ≠ SaaS billing ≠ capital sandbox  

---

## 19. Final scorecard

Scores are **against a real multi-tenant SaaS commerce OS**, not against “empty repo.” Local founder product scores higher on several axes.

| Dimension | Score /10 | Explanation |
|-----------|-----------|-------------|
| **Architecture** | **7.5** | Clean monorepo boundaries, lifecycle engine, connector isolation rule, honesty labels. Capital schema weight and multi-lens commerce APIs add complexity. |
| **AI** | **6.5** | Strong typed tool/operator/critic design; weak free-form LLM, streaming, RAG, long memory. Excellent for safety-first alpha. |
| **UX** | **6.0** | Persona Focus/More is right direction; still many surfaces, finance/capital terminology risk, thin onboarding for non-founders. |
| **Workflow** | **5.5** | Templates + case transitions + demo loop exist; durable live automation incomplete; several templates shadow/coming_soon. |
| **Navigation** | **7.0** | Best-in-repo subsystem after persona resolver; legacy redirects help; More still dense for power users. |
| **Connectors** | **5.0** | Excellent fixture pair + registry honesty; live production connectors mostly blocked/scaffold. |
| **Product Lifecycle** | **6.5** | Discover→learn stages modeled; mid/late stages fixture-heavy; comparison/returns/receiving thin. |
| **Multi-tenancy** | **5.5** | Org/membership/RBAC foundations real; founder_direct default; email/SSO/enterprise tenancy incomplete. |
| **Security** | **5.5** | Sessions, guards, permissions, artifact SSRF, rate-limit service foundations; not enterprise-hardened launch. |
| **Production Readiness** | **4.5** | Local product strong; cloud multi-tenant production (creds, monitoring, billing live, recovery) incomplete. |
| **Scalability** | **4.5** | Single-node Nest + optional Redis; PGlite for dev; no proven horizontal scaling story in-repo. |
| **Maintainability** | **6.5** | Packages and tests present; doc sprawl and dual components increase load; execution status docs help. |
| **Overall Platform** | **6.0** | Coherent **Alpha Commerce OS** for founder/local use with exceptional honesty engineering; not yet a production multi-tenant SaaS. |

### Score rationale summary

TradeOps already behaves like a **product architecture**, not a feature pile: personas, process spine, AI tools with risk classes, and connector honesty are rare at this stage. The gap to “real SaaS” is concentrated in **live connector depth**, **auth/onboarding completeness**, **durable automation**, and **operational production hardening**—not in the lack of a conceptual model.

---

## 20. Blueprint for next implementation phase

Prioritized sequencing derived only from gaps above:

### Phase A — SaaS shell completeness
Auth recovery, invites, onboarding → first connector, billing live path, tenant isolation tests.

### Phase B — One live channel vertical
Pick one (likely Shopify or Google Merchant): OAuth vault → sync → listing draft → approval → publish → order webhook → case advance.

### Phase C — Close the process spine on live data
Sell→source→fulfill→reconcile with real payment/payout objects; exception approvals.

### Phase D — AI productionization
Streaming, entitlement metering on every tool, approval SLAs, objective history as system of record.

### Phase E — Automation
Promote templates from dry-run/shadow to event-triggered controlled_live with worker durability.

### Phase F — Collapse IA
Finance tabs, remove capital from default mental model, kill remaining duplicate components, keep persona Focus ruthlessly lean.

---

## 21. Appendix — key code anchors

| Concern | Primary location |
|---------|------------------|
| Access mode | `apps/web/src/lib/access-mode.ts`, `@tradeops/config` |
| Persona + nav | `packages/commerce-engine/src/workspace.ts` |
| Lifecycle | `packages/commerce-engine/src/commerce-lifecycle.ts` |
| Workspace API | `apps/api/src/commerce/workspace.service.ts` |
| Terminal shell | `apps/web/src/components/layout/terminal-shell.tsx` |
| AI panel | `apps/web/src/components/ai/ai-context-panel.tsx` |
| AI tools | `packages/ai-runtime/src/builtin-tools.ts` |
| Operator cycle | `packages/ai-runtime/src/operator-cycle.ts` |
| AI host | `apps/api/src/ai/ai-operator.service.ts` |
| Workflow templates | `packages/workflow-engine/src/templates.ts` |
| Connectors | `packages/connectors/*`, `packages/connector-core/*` |
| Schema | `packages/database/prisma/schema.prisma` |
| Frontend↔API map | `docs/TRADEOPS_FRONTEND_BACKEND_MAP.md` |
| Execution honesty | `docs/TRADEOPS_EXECUTION_STATUS.md` |
| Start stack | `scripts/start.mjs` |

---

## 22. Review integrity statement

This document was produced under **read-only** constraints:

- No production application code was refactored for this review.  
- Only this review file was authored as the deliverable.  
- Claims of “DONE / PARTIAL / blocked” align with repository implementation and the project’s own execution-status ledger.  
- Where the product is fixture-complete but live-incomplete, it is scored as such—not as imaginary production readiness.

**End of Product Lifecycle Review.**
