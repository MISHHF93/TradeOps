# Commerce Case–First AI Orchestration

**Role:** Lead Enterprise Architect — ownership normalization  
**Status:** Target architecture (consistency; not feature expansion)  
**Goal:** Make **Commerce Case** the primary orchestration object for commerce AI; demote **AI Run** to a case-scoped (or explicitly org-scoped) **execution record**  
**Depends on:** `DOMAIN_OBJECT_OWNERSHIP.md`, `commerce-lifecycle.ts`, `commerce-state-engine.ts`, `AI_RUNTIME_ARCHITECTURE.md`, `AI_OPERATOR_ARCHITECTURE_DIVERGENCE.md` (A2), `EVENT_FLOW.md`  
**Code anchors today:** `CommerceCaseService`, `AiOperatorService.runObjective`, `OperatorRun` (optional `commerceCaseId`), workflow templates, live examples

---

## 1. Principle

| Object | Role |
|--------|------|
| **Commerce Case** | **Primary orchestration object** — unit of work for one product opportunity through the operating procedure (`discover` → … → `closed`) |
| **AI Run** | **Secondary execution record** — how the AI Runtime executed one objective against zero or more cases; never the spine of process state |
| **AI Artifact** | **Evidence / proposal attached to a Case** (and referenced by the Run that produced it) |
| **Workflow Run** | **Durable multi-step execution** correlated to Case (and optionally to AI Run that proposed the plan) |
| **Business Objects** | Product, Listing, Order, PO, Payment, Approval — **facts** the Case projects; Case stage is inferred/advanced from these facts via domain APIs |

### Orthogonality rule

```text
Commerce Case  ──owns──►  stage, stageStatus, nextAction, blockers, history
       │
       ├──binds──►  Product (required after sync)
       ├──binds──►  Listing / Order / PO / Approval (as facts appear)
       ├──collects─► AI Artifacts (recommendation, evidence, plans, drafts refs)
       ├──emits───► CommerceCaseAdvanced + domain events
       └──records─► AI Runs (execution history for this case)

AI Run  ──does not──►  own stage machine
AI Run  ──does──►  produce artifacts, tool traces, envelope, decision notes
AI Run  ──always──►  declare binding mode: case | multi_case | org_non_commerce
```

**“Whenever applicable”** means: if the objective concerns a product opportunity, listing, order, supplier PO, fulfillment, or reconciliation of that opportunity’s economics, **a Commerce Case is required** (create/sync first if missing). AI does not free-float on product lists as the durable process identity.

---

## 2. Binding modes for AI interactions

| Mode | When | Case requirement | AI Run independence |
|------|------|------------------|---------------------|
| **`case`** | Single product/opportunity objective (case page, product twin, stage action) | **Required** `commerceCaseId` | Run is child of case; not independent spine |
| **`multi_case`** | Portfolio discover/rank/top-N across org | Cases **materialized/synced** for every product touched; run is **batch parent** with per-case child links | Run exists for batch audit; **orchestration still per case** after fan-out |
| **`org_non_commerce`** | Billing, connector health, wiring diagnostics, pure SaaS admin | **No case** | Run may be org-scoped independent; **must not** write case stage |
| **`order_case`** | Order/payment/PO/fulfillment questions | Resolve **product → case** (or create missing case via sync); bind that case | Same as `case` |

Default for Operator / Researcher commerce profiles: **`case` or `multi_case`**, never unbound product-scan as the lasting identity.

---

## 3. Current vs target (summary)

| Aspect | Current | Target |
|--------|---------|--------|
| Spine | OperatorRun + product recommendations; case optional | **Commerce Case** spine; OperatorRun subordinate |
| Binding | `commerceCaseId` optional garnish | Required for case-applicable intents; multi_case forces sync + link |
| Stage updates | Org-wide `syncOrganization` after run (fact re-infer) | **Case-targeted** fact write → `syncCase(caseId)` / governed transition; AI proposes transforms, domain applies |
| Artifacts | Mostly on OperatorRun / planJson | **Case-owned** artifact set; run is producer ref |
| Events | `AIObjective*` + `ProductEvaluated`; weak case link | Always include `caseId` when bound; emit `CommerceCaseAdvanced` when stage/status changes |
| Workflows | Parallel templates; weak case correlation | Template steps address **caseId**; AI plan artifacts attach to case |

---

## 4. Lifecycle spine (unchanged stages)

From `COMMERCE_STAGES`:

```text
discover → evaluate → qualify → prepare → approve → publish
  → sell → source → fulfill → reconcile → learn → closed
```

AI does **not** invent stages. AI may:

1. **Read** case state + facts + graph  
2. **Propose** a `CommerceTransformation` (from `TRANSFORM_CATALOG`)  
3. **Execute read-only / draft tools** allowed for that transform  
4. **Write domain facts** only through domain services (opportunity, listing draft, approval request, …)  
5. Trigger **case re-sync / validated transition** so stage reflects facts  

Consequential transforms (`request_approval`, `decide_approval`, `publish`, financial PO submit) remain **human/domain gated** — AI never silently advances them.

---

## 5. Workflow catalog — ownership answers

For each existing workflow / AI entry path:

- **Business object owner**  
- **AI Run independent?**  
- **Update Case state?**  
- **Artifacts on Case**  
- **Events**  
- **Workflow / stage transitions**

---

### 5.1 Portfolio product discovery / ranking  
*(Sidebar / Objectives “find products…”, `product_opportunity_discovery` template, default operator cycle)*

| Question | Answer |
|----------|--------|
| **Business object owns interaction** | **Batch:** Organization + set of **Products**. **Durable orchestration unit per hit:** **Commerce Case** (1:1 with product after sync). |
| **AI Run independent?** | **No** as process spine. Run is **`multi_case` batch execution record**. Must not be the only place recommendations live. |
| **Update Case state?** | **Yes, per product ranked.** Ensure case exists; write Opportunity (+ policy assessment if produced); `syncCase` → typically `discover` completed → `evaluate` ready/completed depending on scores. Stage moves via **facts**, not AI free-text. |
| **Artifacts on Case** | Per qualifying product: `recommendation_card`, `profit_calculation`, `policy_assessment`, `search_evidence` slice. Batch run also holds roll-up `execution_package` with caseId list. |
| **Events** | `AIObjectiveStarted/Completed` (batch, payload includes `bindingMode: multi_case`, `caseIds[]`); per product `ProductEvaluated` **with `caseId`**; `CommerceCaseAdvanced` when stage/status changes; optional `ProductDiscovered` if new product import path used. |
| **Transitions** | For each product with opportunity score: facts → `inferStageFromFacts` / `validate_opportunity` transform → stage toward **`evaluate`** (or stay `discover` if only imported). Rejected/no-score: remain discover or close only via explicit human/policy path. |

**Normalization:** After Phase A, host **must** `ensureCase(productId)` + attach recommendation artifacts **to case** before returning. UI primary deep-link: `/terminal/process/{caseId}`, not only product.

---

### 5.2 Case-scoped evaluation / “run evaluation”  
*(Case workspace AI, process board next action `run_evaluation`, product twin “evaluate”)*

| Question | Answer |
|----------|--------|
| **Owner** | **Commerce Case** (bound product). |
| **AI Run independent?** | **No.** Run requires `commerceCaseId`. |
| **Update Case state?** | **Yes.** Opportunity upsert, confidence, policy; `syncCase` → `evaluate` completed / `qualify` ready when score+policy present. |
| **Artifacts on Case** | `recommendation_card`, `profit_calculation`, `policy_assessment`, `execution_package` (single-case), `search_evidence`. |
| **Events** | `AIObjective*` with `caseId`; `ProductEvaluated` + `caseId`; `CommerceCaseAdvanced` if stage/status change. |
| **Transitions** | Transform `validate_opportunity` / `calculate_landed_cost` / `evaluate_risk`. Edge `discover→evaluate` or complete `evaluate→qualify` when checks satisfied (`opportunity_score`, `cost_model`, `policy_inputs`). |

---

### 5.3 Qualify / policy / reject / watch  
*(Qualify stage actions, policy assess tools)*

| Question | Answer |
|----------|--------|
| **Owner** | **Commerce Case**. |
| **AI Run independent?** | **No.** |
| **Update Case state?** | **Yes** via policy assessment + recommendation field (`qualified` / `watch` / `reject` / `blocked`). Status may be `blocked` / `waiting` / `completed`. |
| **Artifacts on Case** | `policy_assessment`; optional `recommendation_card` update. |
| **Events** | `AIObjective*`; domain policy fact events if defined; `CommerceCaseAdvanced`. |
| **Transitions** | `evaluate→qualify` or stay on qualify; `blocked` if policy blocked; `qualify→prepare` only when `qualified_decision` + `no_blocking_policy` (human or explicit qualify tool — not silent AI promote). |

---

### 5.4 Prepare listing draft  
*(draftListing tool, live example supplier-comparison-listing-draft, prepare stage)*

| Question | Answer |
|----------|--------|
| **Owner** | **Commerce Case** + **Listing** (draft BO). Listing is the fact; Case is orchestration. |
| **AI Run independent?** | **No.** |
| **Update Case state?** | **Yes.** `hasListingDraft` → sync → stage **`prepare`** completed / next submit approval. |
| **Artifacts on Case** | `listing_draft` (ref listingId), `recommendation_card`, media notes if any. |
| **Events** | `AIObjective*`; `ListingPrepared` with `caseId` + `listingId`; `CommerceCaseAdvanced`. |
| **Transitions** | Transform `prepare_listing` / `improve_product_content`. Edge `qualify→prepare` when qualified; within prepare when draft created. **Not** auto `prepare→approve` without approval request. |

---

### 5.5 Request approval / publish intent  
*(queueListingApproval, PUBLISH_LISTING objective, live example approved-listing-publication prep)*

| Question | Answer |
|----------|--------|
| **Owner** | **Commerce Case** + **Approval** BO. |
| **AI Run independent?** | **No.** Run records proposal; Approval owns gate. |
| **Update Case state?** | **Yes.** Pending approval → stage **`approve`**, status **`waiting`**. AI does **not** set publish completed. |
| **Artifacts on Case** | `approval_request`, `listing_draft` ref, execution package section “awaiting_approval”. |
| **Events** | `AIObjective*`; `ApprovalRequested` + `caseId`; `CommerceCaseAdvanced`. |
| **Transitions** | Transform `request_approval`. Edge `prepare→approve`. Publish transition only after `ApprovalDecided` (human). |

---

### 5.6 Human approval decision  
*(Approvals UI — not AI-owned, but AI may brief)*

| Question | Answer |
|----------|--------|
| **Owner** | **Approval** + **Commerce Case**. |
| **AI Run independent?** | AI brief run optional, case-bound; decision is **not** an AI Run outcome. |
| **Update Case state?** | **Yes** on decide: approved → ready for publish; rejected → prepare/closed path. |
| **Artifacts on Case** | Approval decision record; prior AI `approval_request` superseded. |
| **Events** | `ApprovalDecided`; `CommerceCaseAdvanced`. |
| **Transitions** | `decide_approval`; `approve→publish` only if granted + connector capability. |

---

### 5.7 Publish listing  
*(Connector publish after approval — AI may monitor, not execute silently)*

| Question | Answer |
|----------|--------|
| **Owner** | **Listing** + **Commerce Case**. |
| **AI Run independent?** | Monitor/diagnose run case-bound; publish execution is domain/connector. |
| **Update Case state?** | **Yes** when active listing exists → **`publish` completed**. |
| **Artifacts on Case** | Connector result provenance; optional AI `execution_package` verification section. |
| **Events** | `ListingPublished` + `caseId`; `CommerceCaseAdvanced`. |
| **Transitions** | Transform `publish` (aiCanPerform: false). Edge `approve→publish→sell`. |

---

### 5.8 Sell / order received  
*(Orders, monitor_performance)*

| Question | Answer |
|----------|--------|
| **Owner** | **CustomerOrder** + **Commerce Case** (via product). |
| **AI Run independent?** | **No** for commerce explanation; bind case from order lines. |
| **Update Case state?** | **Yes** when paid order → **`sell`**. |
| **Artifacts on Case** | Order summary evidence; optional AI brief. |
| **Events** | `OrderReceived` / payment events + `caseId`; `CommerceCaseAdvanced`. |
| **Transitions** | `publish→sell`; next `sell→source` when paid. |

---

### 5.9 Supplier routing / PO  
*(workflow `supplier_routing`, live example customer-order-supplier-fulfillment)*

| Question | Answer |
|----------|--------|
| **Owner** | **Commerce Case** + **SupplierPurchaseOrder** + Order. |
| **AI Run independent?** | **No.** May propose supplier choice; PO draft is domain. |
| **Update Case state?** | **Yes.** PO draft/submit → **`source`**. |
| **Artifacts on Case** | Supplier comparison notes, `workflow_plan`, PO draft ref. |
| **Events** | `SupplierOrderPrepared` + `caseId`; `AIObjective*` if AI proposed; `ApprovalRequested` if PO needs approval; `CommerceCaseAdvanced`. |
| **Transitions** | Transform `source_inventory` / `compare_suppliers`. Edge `sell→source→fulfill`. |

---

### 5.10 Fulfillment / delivery exception  
*(workflow `delivery_exception`)*

| Question | Answer |
|----------|--------|
| **Owner** | **Fulfillment/Shipment** + **Commerce Case**. |
| **AI Run independent?** | **No.** |
| **Update Case state?** | **Yes** — stage **`fulfill`**, status in_progress/blocked on exception. |
| **Artifacts on Case** | Exception brief, draft customer message (draft artifact), remedy proposal. |
| **Events** | `ShipmentUpdated`; `AIObjective*` for analysis; `ApprovalRequested` if financial remedy; `CommerceCaseAdvanced`. |
| **Transitions** | Stay fulfill or `fulfill→reconcile` when closed; no skip to learn without facts. |

---

### 5.11 Reconcile / payout variance explain  
*(inspect payment tools, reconcile)*

| Question | Answer |
|----------|--------|
| **Owner** | Prefer **Commerce Case** when order/product known; else **org payment** with **optional** multi-case links. |
| **AI Run independent?** | Only if pure org ledger with no product link (`org_non_commerce` or multi). Prefer case bind. |
| **Update Case state?** | **Yes** when case-linked actuals → **`reconcile`**. |
| **Artifacts on Case** | Variance explanation artifact, profit actuals. |
| **Events** | `ReconciliationCompleted` + `caseId` when case-linked; `AIObjective*`. |
| **Transitions** | `fulfill→reconcile→learn`. |

---

### 5.12 Forecast evaluation / learn  
*(workflow `forecast_evaluation`, prediction outcomes, learning loop after operator run)*

| Question | Answer |
|----------|--------|
| **Owner** | **Commerce Case** (product outcome). |
| **AI Run independent?** | Batch multi_case OK for horizon job; each outcome **writes case**. |
| **Update Case state?** | **Yes** → **`learn`** when outcome exists. |
| **Artifacts on Case** | Prediction vs actual report; learning notes. |
| **Events** | `PredictionEvaluated` + `caseId`; `CommerceCaseAdvanced`; optional close proposal. |
| **Transitions** | `reconcile→learn`; `learn→closed` or `learn→discover` (re-entry) only via explicit decision. |

---

### 5.13 Margin protection / inventory protection  
*(workflow templates shadow/coming_soon)*

| Question | Answer |
|----------|--------|
| **Owner** | **Commerce Case** (+ Listing). |
| **AI Run independent?** | **No.** |
| **Update Case state?** | Propose price/inventory change; stage may return to **prepare/approve** if listing change consequential; status `waiting` if approval. |
| **Artifacts on Case** | Margin recompute, proposed price artifact, `approval_request`. |
| **Events** | `AIObjective*`; `ApprovalRequested`; `CommerceCaseAdvanced` on fact change. |
| **Transitions** | Often lateral: publish/sell → prepare/approve for amendment; never silent price live write. |

---

### 5.14 Live examples (product paths)

| Example | Owner | Run independent? | Case update | Artifacts | Events | Transitions |
|---------|-------|------------------|-------------|-----------|--------|-------------|
| Supplier comparison + listing draft | **Case** (ensure for product) | No | Yes — draft + evaluate facts | recommendation, listing_draft | AIObjective*, ListingPrepared, ProductEvaluated, CaseAdvanced | → prepare |
| Approved listing publication | **Case** + Approval | No | Yes — waiting approve / publish after human | approval_request | ApprovalRequested/Decided, ListingPublished | prepare→approve→publish |
| Order → supplier fulfillment | **Case** + Order + PO | No | Yes — sell/source/fulfill facts | workflow_plan, PO refs | Order*, SupplierOrder*, CaseAdvanced | sell→source→fulfill |

Examples are **scripts over case-bound domain APIs + one AI engine**, not parallel spines.

---

### 5.15 Org-non-commerce AI (exceptions — no Case spine)

| Interaction | Owner | AI Run independent? | Case? |
|-------------|-------|---------------------|-------|
| Billing status / checkout / portal | BillingSubscription (SaaS) | **Yes** (org run) | No |
| Connector health / fabric diagnose | ConnectorInstallation / ops | **Yes** (org run) | No |
| Wiring matrix / developer diagnose | Ops diagnostics | **Yes** | No |
| Pure search command-bar navigation | Search (may deep-link case) | N/A or ephemeral | Open case if hit is case |

These must set `bindingMode: org_non_commerce` and **must not** call case stage APIs.

---

## 6. Artifact ownership matrix

| Artifact kind | Primary owner | Also referenced by | Notes |
|---------------|---------------|--------------------|-------|
| `recommendation_card` | **Commerce Case** | AI Run (producer) | One active “latest” per case + history |
| `search_evidence` | **Commerce Case** (slice) or batch Run for multi | Run | Multi_case: batch evidence + per-case extract |
| `profit_calculation` | **Commerce Case** | Run | |
| `policy_assessment` | **Commerce Case** | Run, Product | Drives qualify blocked |
| `listing_draft` | **Listing** BO + **Case** ref | Run | Case.listingDraftId is fact link |
| `approval_request` | **Approval** + **Case** | Run | |
| `execution_package` | **Case** if single; **Run** roll-up if multi | Case list | Navigator UI prefers case package |
| `workflow_plan` | **Case** (proposal) | Workflow Run, AI Run | Handoff to workflow-engine |
| `media_analysis` | **Case** / Product | Run | |

**Rule:** If an artifact influences stage, next action, or approval, it **belongs on the Case**. The AI Run stores production metadata (trace, provider, latency) and foreign keys to artifact ids.

---

## 7. Event emission standard (case-first)

Every commerce-bound AI interaction emits:

| Event | When | Required payload fields |
|-------|------|-------------------------|
| `AIObjectiveStarted` | Engine accepted | `runId`, `bindingMode`, `caseId?`, `caseIds?`, `objectiveType`, `traceId` |
| `AIObjectiveCompleted` | Engine finished | same + `decision`, `artifactIds[]`, `dataMode` |
| `ToolExecutionFailed` | Consequential tool fail | `runId`, `caseId?`, `tool` |
| `ProductEvaluated` | Recommendation/score written | **`caseId`**, `productId`, `runId`, scores |
| `CommerceCaseAdvanced` | Stage or stageStatus change | `caseId`, `fromStage`, `toStage`, `fromStatus`, `toStatus`, `cause: 'ai_run'\|'sync'\|'domain'`, `runId?` |
| Domain facts | Listing/Order/PO/Approval/… | Always include **`caseId` when resolvable** |

**Entity type for case-bound AI events:** prefer `entityType: 'commerce_case'`, `entityId: caseId`, with `productId` in payload — so Event Fabric consumers project the spine correctly.

---

## 8. Workflow transitions vs AI

| Layer | Responsibility |
|-------|----------------|
| **Case stage graph** (`STAGE_TRANSITIONS` + `TRANSITION_REQUIREMENTS`) | Legal process edges |
| **Commerce transformations** (`TRANSFORM_CATALOG`) | Named operations AI/human may attempt; `aiCanPerform` flag |
| **Workflow Engine templates** | Durable multi-step automation; each step resolves `caseId` |
| **AI Runtime** | Chooses tools, produces plan **proposal**, does not commit illegal edges |

### Transition authority

```text
AI recommends transform
  → Domain service writes fact (or queues approval)
  → CaseService.syncCase / applyTransition(validate)
  → CommerceCaseAdvanced
  → UI nextAction from computeNextAction
```

AI **never** writes `currentStage` directly.  
Optional explicit `applyTransition` only after `validateStageTransition` + facts checks inside **CommerceCaseService**.

### Mapping transforms → typical AI tools (existing)

| Transform | Stage aim | AI tools (illustrative) |
|-----------|-----------|-------------------------|
| `discover_product` | discover | searchConnectedProducts, researchSearchPublicWeb |
| `validate_opportunity` | evaluate | calculateContributionProfit, scoreOpportunity |
| `calculate_landed_cost` | evaluate | calculateContributionProfit |
| `evaluate_risk` | qualify | assessPolicyRisk |
| `prepare_listing` | prepare | draftListing |
| `request_approval` | approve | (domain queue; AI only proposes) |
| `publish` | publish | none (connector + approval) |
| `source_inventory` | source | compare/search; domain PO |
| `fulfill_order` | fulfill | inspect order |
| `reconcile_payment` | reconcile | inspectPayment, explain variance |
| `learn` | learn | evaluateOutcomes |

---

## 9. AI Run data model (target semantics)

OperatorRun (or generalized AiRun) fields:

| Field | Rule |
|-------|------|
| `commerceCaseId` | **Required** for `bindingMode=case`; null only for multi_case parent or org_non_commerce |
| `bindingMode` | `case` \| `multi_case` \| `org_non_commerce` |
| `caseIdsJson` | For multi_case: all cases touched |
| `primaryCaseId` | Optional UI focus case |
| `status` | Execution status only — **not** commerce stage |
| `planJson` / artifacts | Producer payload; canonical copies on case |

**Recommendations:** each `OperatorRecommendation` gains required `commerceCaseId` when `productId` present (ensure case before insert).

---

## 10. Host orchestration sequence (target)

### Single-case

```text
1. Resolve or require commerceCaseId
2. Load CasePort context (stage, facts, graph)
3. AiExecutionEngine.run(profile, objective, context.caseId)
4. Domain writes from tool ports (opportunity, draft, …)
5. CaseService.syncCase(caseId)  // or validateTransition
6. Attach artifacts → case
7. Emit AIObjective* + ProductEvaluated + CommerceCaseAdvanced?
8. Return envelope with caseId, stage, nextAction, artifactIds
```

### Multi-case (portfolio)

```text
1. Engine ranks N products (tools/search)
2. For each productId: ensureCase → write facts → attach card artifact → collect caseId
3. Parent run bindingMode=multi_case, caseIdsJson=[…]
4. syncOrganization OR per-case sync
5. Envelope lists case-centric results (not product-only)
```

### Org non-commerce

```text
1. bindingMode=org_non_commerce
2. Engine tools limited to billing/ops
3. No CaseService stage APIs
4. Run independent under organizationId
```

---

## 11. UI / API contract implications (normalization, not new product)

| Surface | Normalization |
|---------|----------------|
| Case workspace AI | Always send `commerceCaseId`; show artifacts from case |
| Process board | Primary object remains case; AI actions = transforms on that case |
| Global Objectives / rail | Portfolio runs return **case links**; post-run open process for top case |
| Product page | Twin of case; AI still resolves `caseId` via product |
| Run history | Filterable by case; case page shows run children |
| Envelope `data` | Include `caseId`, `currentStage`, `stageStatus`, `nextAction` when bound |

---

## 12. What AI Run must never own

- Commerce stage machine  
- Approval final decision  
- Connector publish without approval path  
- Orphan recommendations without case (after product known)  
- Process “source of truth” for next action (that is Case + `computeNextAction`)

---

## 13. Normalization sequence (implementation order)

1. **Schema / API:** `bindingMode`; require `commerceCaseId` on case-scoped endpoints; recommendation.caseId  
2. **ensureCase(productId)** on every ranked product before rec persist  
3. **Attach artifacts to case** (metadataJson or artifact store keyed by caseId)  
4. **Events:** always populate `caseId` on ProductEvaluated / AIObjective when known; emit CommerceCaseAdvanced on real stage delta  
5. **Replace post-run only-org sync** with **per-case sync** for case mode; keep org sync for multi_case  
6. **Engine context:** case-first prompt vars from CasePort; no product-array-only identity  
7. **Workflow templates:** pass `caseId` through steps; correlate workflowRun ↔ case  
8. **UI clients:** case page always binds; portfolio results deep-link cases  
9. **Forbid** stage field writes from AI module — only CaseService  

---

## 14. Decision summary table (quick reference)

| Workflow / interaction | BO owner | AI Run independent? | Updates Case? | Case artifacts | Key events | Stage motion |
|------------------------|----------|---------------------|---------------|----------------|------------|--------------|
| Portfolio discover/rank | Case (per product) + org batch | No (batch record only) | Yes per product | cards, profit, policy, evidence | AIObjective*, ProductEvaluated, CaseAdvanced | → evaluate |
| Case evaluate | Case | No | Yes | package, cards, calcs | same | discover/evaluate → qualify readiness |
| Qualify / policy | Case | No | Yes | policy_assessment | CaseAdvanced | qualify / blocked |
| Listing draft | Case + Listing | No | Yes | listing_draft | ListingPrepared, CaseAdvanced | → prepare |
| Approval request | Case + Approval | No | Yes (waiting) | approval_request | ApprovalRequested | → approve |
| Approval decide | Approval + Case | Decision ≠ AI | Yes | decision ref | ApprovalDecided | → publish or back |
| Publish | Listing + Case | Monitor only | Yes | provenance | ListingPublished | → sell |
| Order / sell | Order + Case | No | Yes | order evidence | OrderReceived | → source |
| Supplier PO | Case + PO | No | Yes | workflow_plan, PO | SupplierOrderPrepared | → fulfill |
| Fulfill / exception | Fulfillment + Case | No | Yes | exception brief | ShipmentUpdated | fulfill / reconcile |
| Reconcile | Payment + Case | Prefer case | Yes if linked | variance art. | ReconciliationCompleted | → learn |
| Learn / forecast | Case | Batch ok | Yes | outcome report | PredictionEvaluated | → closed / re-discover |
| Margin/inventory protect | Case + Listing | No | Yes (often approve) | proposal + approval | ApprovalRequested | amend path |
| Billing / connectors / wiring | SaaS / Ops | **Yes** | **No** | n/a on case | AIObjective* only | none |

---

## 15. Closing judgment

**Commerce Case is the OS spine.**  
**AI Runtime is the execution kernel.**  
**AI Run is an audit/execution child, not the process.**

Normalization means:

1. Every commerce-applicable AI interaction **binds cases** (single or multi).  
2. Domain facts + CaseService own **stage**.  
3. Artifacts that matter for process **live on the Case**.  
4. Events are **case-addressable**.  
5. Workflows and transitions **operate on cases**, with AI proposing transforms already defined in the commerce state engine.

This completes A2 (case not primary unit of AI work) without inventing new product features — it re-anchors existing workflows to the ownership model already declared in `DOMAIN_OBJECT_OWNERSHIP.md` and `commerce-lifecycle.ts`.
