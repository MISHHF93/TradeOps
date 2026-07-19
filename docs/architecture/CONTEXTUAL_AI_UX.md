# Contextual AI UX — Business Object Workspaces

**Role:** Lead Enterprise Architect — user experience normalization  
**Status:** Target architecture (consistency; not feature expansion)  
**Goal:** AI is **not** a standalone product destination. AI is a **contextual capability** inside business-object workspaces. Navigation, composers, panels, and workflows are **deduplicated**.  
**Aligns with:** `DOMAIN_OBJECT_OWNERSHIP.md`, `COMMERCE_CASE_AI_ORCHESTRATION.md`, `AI_OUTPUT_OWNERSHIP.md`, `FRONTEND_BACKEND_WIRING.md`, `object-workspace.tsx`, `AiContextPanel`, `buildPersonaNav`  
**Code anchors today:**  
`apps/web` terminal shell + `AiContextPanel`, `/terminal/ai` redirect, `/terminal/objectives`, residual `ai-operator-console` / `ai-side-panel`, persona Focus still lists Objectives, Discover scanner vs case spine

---

## 1. Principle

| Wrong model | Right model |
|-------------|-------------|
| “Go to AI” as a primary nav place | “Operate this **Case / Product / Order / …**” with AI in context |
| Full-page operator console | Single **context rail** + object workspace **AI facet** |
| Global free-form objective as product home | Objective **bound** to current object (caseId, productId, orderId, …) |
| Duplicate run UIs | One composer, one progress surface, one result deep-link pattern |
| Feature pages that reimplement AI | Pages are **views of BOs**; AI proposes transforms on those BOs |

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Command bar (search → navigate to BOs)                               │
├──────────┬──────────────────────────────────────────┬────────────────┤
│ Persona  │  Object workspace (Case | Product | …)    │  AI Context    │
│ Focus    │  facets: overview, suppliers, listings,  │  Rail          │
│ nav      │  orders, AI history facet, next action   │  (composer +   │
│ = BOs    │                                          │   progress +   │
│          │                                          │   summary)     │
└──────────┴──────────────────────────────────────────┴────────────────┘
```

**Rule:** If a user can complete an AI task without knowing *which business object* they are on, the UX is wrong for commerce work (except org-level ops/admin diagnose).

---

## 2. Inventory of current AI entry points

| ID | Entry | Role today | Duplicate? | Target |
|----|-------|------------|------------|--------|
| **U1** | `AiContextPanel` (right rail, all terminal pages) | Canonical composer + progress + summary | Primary | **Keep** — sole launch surface |
| **U2** | `/terminal/ai` | Redirect → Objectives | Legacy | **Keep redirect** only; never nav |
| **U3** | `/terminal/objectives` | Run history list | Semi-standalone AI destination | **Demote** — Case/ops history facet or `/terminal/activity` under process; not Focus “AI home” |
| **U4** | `/terminal/objectives/[id]` | Full run result | Needed | **Keep** as **detail of AI Run artifact** linked from Case/Product, not a product line |
| **U5** | `ai-operator-console.tsx` | Full-page console component | Dup of rail | **Delete or quarantine** — unused by primary path |
| **U6** | `ai-side-panel.tsx` | Alternate panel | Dup of rail | **Delete or quarantine** |
| **U7** | Root `components/ai-operator-console.tsx` / `ai-side-panel.tsx` | Likely re-exports/legacy | Dup | **Remove** once unused |
| **U8** | Persona Focus: **Objectives** | Nav item “AI-adjacent” | Competes with Cases as home | Relabel **Run history** under More/Activity; remove from default Focus |
| **U9** | Workspace `aiContextPreamble` / chips | Contextual seeds | Good | Bind chips to **current object** when on case/product |
| **U10** | Live examples `/terminal/live-examples` | Demo scripts | OK for ops/learn | Not primary AI nav; hand off into Case workspace |
| **U11** | Discover `/terminal` scanner | Product list + implicit AI | Parallel spine | Discover = product/case intake; AI rail runs **multi_case** with results → **Cases** |
| **U12** | Case workspace `aiContext` / suggested objective | Object-native | Good | **Primary** contextual pattern for all BOs |
| **U13** | Product page | Twin of case | Partial | Always resolve case; open rail with product/case bind |
| **U14** | Opportunities list | Scores list | Overlaps recs | View of **Opportunity BOs** / Cases — not AI app |
| **U15** | Command bar search | Navigate | Good | Hits open BO workspaces; never “AI page” |
| **U16** | Automations / workflow UI | Separate | OK | Workflows on Cases; AI not a second automation shell |
| **U17** | Tools `/tools/profit|score|policy` | Public calculators | Outside terminal | Keep marketing; terminal uses BO tools via rail |
| **U18** | Page-local “Run AI” buttons (if any) | Second composers | Dup | Only `openWithObjective` → **same rail** |

---

## 3. Duplicates to remove

| Duplicate | Instances | Normalization |
|-----------|-----------|---------------|
| **AI navigation destinations** | `/terminal/ai`, Focus “Objectives” as AI home, console pages | One capability (rail); history is secondary resource |
| **Objective inputs** | Rail composer + console composer + query-param pages that re-prompt | **Only rail composer** (prefilled by context) |
| **AI panels** | AiContextPanel, ai-side-panel, console | **Only AiContextPanel** |
| **Result surfaces** | Inline wall of text in multiple UIs + objectives detail | Rail = summary; detail = run page **or** Case AI facet |
| **Workflows** | Live examples scripts vs operator cycle vs automations page | One engine (backend); UI enters from **object next action** |
| **Process vs pipeline vs opportunities** | Multiple list metaphors for same spine | **Cases** primary; opportunities = facet/filter |
| **Discover vs Case** | Scanner product-first vs process case-first | Discover creates/opens **Cases**; AI never stranded on product-only identity |

---

## 4. Information architecture (target)

### 4.1 Primary navigation = business objects (persona Focus)

Focus strips should emphasize **objects and procedure**, not “AI”:

| Focus concept | Route pattern | AI role |
|---------------|---------------|---------|
| Home | `/terminal/workspace/[persona]` | Persona briefing chips → rail |
| Cases | `/terminal/process` | Primary spine |
| Discover / Research | `/terminal` or research view | Intake → cases |
| Listings | `/terminal/listings` | Listing BO workspace |
| Orders | `/terminal/orders` | Order BO |
| Approvals | `/terminal/approvals` | Human gate |
| Analytics | signals/portfolio/cashflow (persona) | Insight BO views |
| Operations | connectors, tasks (developer/operator) | Ops diagnose via rail |
| Activity / Run history | demoted More item | Audit of AI Runs & workflows |

**Remove from Focus as “AI product”:** dedicated AI, Operator, Objectives-as-home.

### 4.2 Every page = contextual object workspace

Pattern already started in `ObjectWorkspace`:

```text
Header: object title · stage · dataMode honesty · next action
Facets/panels: overview | suppliers | pricing | media | listings | orders | …
AI facet: recent runs for this object · suggested objectives · open rail
Related graph: KG projection links
```

| Surface | Object | Context bind for AI |
|---------|--------|---------------------|
| `/terminal/process/[caseId]` | **Commerce Case** | `commerceCaseId` required |
| `/terminal/products/[productId]` | **Product** (+ case) | Resolve case; bind both |
| Suppliers (panel or future `/terminal/suppliers/[id]`) | **Supplier** | supplierId + related case/product |
| `/terminal/listings` + detail | **Listing** | listingId → case/product |
| `/terminal/orders` + detail | **Order** | orderId → case |
| Fulfillment | **Shipment** | shipment/order → case |
| Finance payments | **Payment** | paymentId → case when known |
| Customers | **Customer** | customerId |
| Signals / portfolio | **Analytics** views | Optional multi_case or org |
| Discover / research | **Research** intake | multi_case / discover objective |
| Connectors / diagnostics | **Operations** | `org_non_commerce` bind |

Pages that are **filters** (stage boards, opportunity lists) open **object workspaces** on row click — they are not AI apps.

### 4.3 Single AI chrome

| Element | Responsibility |
|---------|----------------|
| **AI Context Rail** | Only composer, progress (SSE), honesty, top recommendation, link to full result |
| **Context binder** | From route: `caseId` / `productId` / `orderId` / … via layout or page effect → `setCommerceCaseId` + context payload |
| **Suggested actions** | From Case `nextAction` + workspace chips + transform catalog — **one click prefills rail** |
| **Full result** | Case **AI facet** (preferred) or `/terminal/objectives/[id]` as run detail URL |
| **Command bar** | Search BOs; optional “Ask AI about current page” opens rail with context |

No second floating panel. No full-page operator.

---

## 5. Contextual AI behavior by domain

### 5.1 Commerce Cases (primary)

- Land on case → rail knows `commerceCaseId`.  
- Default objective = case `suggestedObjective` / next transform label.  
- Results attach to case; history on case AI facet.  
- CTA “Run evaluation” does **not** navigate to Objectives — opens/runs rail.

### 5.2 Products

- Product page is **twin** of case (domain rule).  
- Resolve/create case; AI bind case.  
- Never orphan product-only AI as lasting UX identity.

### 5.3 Suppliers

- Supplier panel on case/product workspace.  
- AI: “Compare suppliers for this case” with case bind.  
- Standalone supplier directory (if any) still opens rail with supplierId context.

### 5.4 Listings

- Listing row → listing workspace facet on case.  
- AI: prepare/publish **proposals** via rail; approvals stay on Approvals object page.

### 5.5 Orders

- Order workspace: payment, shipment, case link.  
- AI: explain payment, source inventory — bound to order→case.

### 5.6 Analytics

- Signals/portfolio pages: org or multi_case analytics questions.  
- Results deep-link **Cases** / opportunities — not a permanent “AI report island.”

### 5.7 Research

- Discover + research intents: portfolio rank.  
- Post-run: navigate emphasis to **Cases** created/updated (case-first), not only product cards in rail.

### 5.8 Operations

- Connectors, diagnostics, wiring: rail `org_non_commerce`.  
- No fake commerce case required.  
- Still no standalone “AI ops product” page — use Operations home + rail.

---

## 6. Navigation cleanup matrix

| Nav item today | Keep? | Change |
|----------------|-------|--------|
| Cases / Process | **Yes** | Primary spine |
| Discover | **Yes** | Research/intake, not AI home |
| Opportunities | **Yes** as BO list | Not AI substitute |
| Objectives | Demote | More → “Activity / AI runs” or nest under Case |
| `/terminal/ai` | Redirect only | No label in nav |
| Live examples | More / Learn | Not Focus |
| Automations | More / Ops | Workflows on cases |
| Pipeline (if legacy) | Redirect to process | — |
| Watchlist | Optional facet | Tie to cases/products |

Command palette: remove “AI Operator” as destination; add “Open AI rail” action + object jumps.

---

## 7. Interaction patterns (normalize)

### 7.1 Launch

```text
User on Case workspace
  → clicks Next action “Run evaluation”
  → openWithObjective(suggested) + setCommerceCaseId
  → rail expands / runs
  → progress in rail
  → summary in rail
  → “View on case” / full run detail
```

### 7.2 No duplicate workflows

| User goal | One path |
|-----------|----------|
| Evaluate product | Case next action → rail |
| Draft listing | Case prepare → rail/domain |
| Approve publish | Approvals page (human) — AI only briefs |
| Portfolio discover | Discover page → rail multi_case → Cases board |
| Explain payout | Finance payment workspace → rail |
| Demo | Live examples → lands on resulting Case |

### 7.3 Copy and IA language

| Avoid | Prefer |
|-------|--------|
| “Open AI” | “Ask about this case” / next action label |
| “AI workspace” | Object workspace + assistant |
| “Objectives” as home | “Run history” / case activity |
| “Chat” | Objective / transform on object |

---

## 8. Component ownership (frontend)

| Component | Keep | Notes |
|-----------|------|-------|
| `AiContextPanel` | **Yes** | Sole chrome |
| `AiOperatorProvider` | **Yes** | Context bind + draft |
| `ai-operator-client` | **Yes** | Single API client |
| `ObjectWorkspace` | **Yes** | Extend AI facet; all BO pages converge |
| `ai-operator-console` | **No** | Remove from tree |
| `ai-side-panel` | **No** | Remove from tree |
| Objectives list/detail | **Thin** | Audit/history routes |
| Process board / case page | **Yes** | Primary |

### 8.1 Context binding contract (client)

```ts
// When route changes:
bindAiContext({
  objectType: 'commerce_case' | 'product' | 'order' | ...,
  objectId: string,
  commerceCaseId?: string,
  suggestedObjective?: string,
  bindingMode: 'case' | 'multi_case' | 'org_non_commerce',
})
```

Rail sends `commerceCaseId` / future context fields on every run. Empty global objective only on Discover/Home with explicit multi_case.

---

## 9. Page template (every terminal page)

1. **Object identity** — type, title, ids, fixture honesty  
2. **State** — stage/status or list filters  
3. **Next action** — domain `computeNextAction` / transform (opens rail or domain form)  
4. **Facets** — BO panels only  
5. **AI facet** — last runs for this object + “Continue in rail”  
6. **No embedded second composer**

List pages: table of BOs → click → workspace template.

---

## 10. Alignment with backend architectures

| Backend principle | UX reflection |
|-------------------|---------------|
| Case-first orchestration | Case page is home for AI work |
| AI Run subordinate | Run detail is history, not app |
| Search Manager | Command bar + rail evidence, one search |
| Fabric capabilities | Actions named “Publish listing” not “Shopify” |
| Artifacts on case | Case AI facet shows artifacts |
| Event-driven | Progress from real states; activity timeline on case |

---

## 11. Normalization sequence

1. **Nav:** Remove AI/Objectives from default Focus; add Activity under More; ensure Cases + Discover lead.  
2. **Delete/quarantine** `ai-side-panel`, `ai-operator-console` (and root duplicates) if unused.  
3. **Route context binder** in terminal layout/pages for case/product/order.  
4. **Case/Product CTAs** only call `openWithObjective` — never `router.push('/terminal/ai')` or full console.  
5. **Objectives page** retitle “AI run history”; filter by caseId when present.  
6. **ObjectWorkspace AI facet** shows case-scoped runs (API filter).  
7. **Discover results** emphasize open Case links.  
8. **Command palette** “Open assistant” + BO navigation only.  
9. **Copy audit** strip “AI workspace / Open AI” product language.  
10. **Smoke:** no Focus item required to use AI; AI works on case page alone.

---

## 12. Acceptance criteria

| Criterion | Pass |
|-----------|------|
| No primary nav item required named AI/Operator | ✓ |
| Single objective composer in terminal | ✓ |
| Single AI panel component | ✓ |
| Case page can run AI without leaving page | ✓ |
| Product page binds case | ✓ |
| Run history secondary | ✓ |
| Orders/listings/ops use same rail + context | ✓ |
| No duplicate live-example vs operator UX for same goal | ✓ |
| Every main page readable as BO workspace | ✓ |

---

## 13. Closing judgment

TradeOps already moved toward a **right rail** and redirected `/terminal/ai`, but **Objectives in Focus**, residual consoles, and **product-scan-first** flows still make AI feel like a destination.

Normalization:

- **Pages = business object workspaces**  
- **AI = contextual rail + object AI facet**  
- **History = audit**, not home  
- **One composer, one panel, one handoff pattern**

That matches the Commerce OS: operators work **cases and objects**; intelligence comes to them in place.
