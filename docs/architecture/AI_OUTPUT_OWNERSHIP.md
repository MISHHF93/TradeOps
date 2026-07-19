# AI Output Ownership — Canonical Business Objects vs Artifacts

**Role:** Lead Enterprise Architect — output ownership normalization  
**Status:** Target architecture (consistency; not feature expansion)  
**Goal:** Every AI output has exactly one **system of record**. Process facts live on **canonical business objects**. AI-only proposals, narratives, and evidence packs live as **AI Artifacts** attached to Cases/Runs. The Knowledge Graph and Data Fabric **project and label** — they never own competing copies of commerce truth.  
**Depends on:** `DOMAIN_OBJECT_OWNERSHIP.md`, `business-objects.ts`, `COMMERCE_CASE_AI_ORCHESTRATION.md`, `AI_RUNTIME_ARCHITECTURE.md`, `SEARCH_MANAGER_ARCHITECTURE.md`, `CONNECTOR_FABRIC_ARCHITECTURE.md`, `data-provenance.ts`, `knowledge-graph.ts`

---

## 1. Dual-ownership rule (non-negotiable)

| Class | System of record | May also exist as |
|-------|------------------|-------------------|
| **Commerce fact** (score, listing status, payment state, case stage) | Canonical **Business Object** (Prisma / domain service) | AI Artifact **reference** (by id) + KG edge — never a second fact table owned by AI |
| **AI proposal / narrative / evidence bundle** | **AI Artifact** (+ producer AI Run) | Envelope text projection; Case artifact set pointer |
| **Relationship** | **Knowledge Graph projection** over BOs | Not stored as free-form AI prose as authority |
| **Source honesty** | **Data Fabric labels** (`dataMode`, provenance) on reads/writes | Not a parallel object store |

**Forbidden:**  
AI `recommendation_card` as the only place opportunity score lives while Opportunity/Case also store a different score with no single writer.  
**Required:**  
One write path per fact field; AI either *proposes* (artifact) or *commits via domain service* (BO update) under policy.

---

## 2. Inventory of AI outputs today

Sources: `OperatorCycleResult`, `RecommendationDraft`, artifact kinds, host side effects (`upsertOpportunity`, listing draft, approval queue, shadow decisions, prediction outcomes, navigator package, envelope).

### 2.1 Decision matrix

| # | AI output | Current form | Become canonical BO? | Target system of record | AI Artifact? | Notes |
|---|-----------|--------------|----------------------|-------------------------|--------------|-------|
| O1 | **Phase B `responseSummary` / narrative briefing** | Run text / envelope `text` | **No** | AI Artifact `operator_briefing` (new kind) or envelope-only ephemeral + optional artifact | **Yes** | Never invent products; no stage authority |
| O2 | **Objective classification** (type, risk, filters) | In-memory / planJson | **No** | AI Run metadata + plan section of `execution_package` | Embedded in package | Not a commerce BO |
| O3 | **Plan / toolsToCall / steps** | `planJson` on OperatorRun | **No** (durable multi-step → Workflow) | AI Artifact `workflow_plan` **or** Workflow Run when handed off | **Yes** | Case attaches plan; workflow owns execution |
| O4 | **Tool trace** | OperatorRun / cycle | **No** | AI Run audit only | Optional debug artifact | Not KG nodes as facts |
| O5 | **Timeline / progress states** | Timeline + SSE | **No** | Stream projection of runtime states | No | Ephemeral |
| O6 | **Critic / auditor notes** | Cycle + rec rows | **No** | AI Artifact `validation_report` (or section of package) | **Yes** | Does not override policy BO |
| O7 | **Decision** (accept/revise/block/escalate) | Run fields | **No** | AI Run decision fields | In package | Human Approval is separate BO |
| O8 | **Recommendation card** (rank, title, rationale, next actions) | `OperatorRecommendation` + card DTO | **Partial** | **Opportunity** BO holds scores/economics facts; **Case** holds process position; card becomes Artifact `recommendation_card` **view of** those + narrative | **Yes** | Card is not SoR for score |
| O9 | **productCard** economics (margin, profit, costs) | Embedded JSON | **Yes (fields)** | **Product** costs/prices if durable; **Opportunity** expected profit/margin/score; calc snapshot as Artifact `profit_calculation` | **Yes** snapshot | Domain calc tools write Opportunity via service |
| O10 | **Policy risk / outcome** | Card + tool | **Yes** | **PolicyAssessment** BO (already exists pattern) | Artifact `policy_assessment` mirrors assessment id | Single writer: policy service |
| O11 | **Assumptions / missingData** | Rec JSON | **No** | Artifact only (honest gaps) | **Yes** | May block Case status via CaseService reading gaps |
| O12 | **Forecast blob** | Rec JSON | **Yes if durable** | Forecast/signal model or Opportunity forecast fields; else Artifact | Optional | PredictionOutcome owns learn-back |
| O13 | **Proposed action** (draft/publish/evaluate) | String on rec | **No as free string** | Maps to **CommerceTransformation** + optional Approval / Listing | Artifact proposes transform code | Domain applies |
| O14 | **Listing draft content** | Tool / host create | **Yes** | **Listing** BO (`draft`) | Artifact `listing_draft` **points to** listingId | No parallel draft store in AI |
| O15 | **Approval queue** | Host `queueListingApproval` | **Yes** | **Approval** BO | Artifact `approval_request` → approvalId | AI never decides |
| O16 | **Shadow decision** | ShadowDecision table | **No** (shadow ledger) | Shadow ledger (explicit non-production) | Optional link | Never presented as live BO |
| O17 | **Search / web evidence** | Tool trace / Tavily | **No** as Product | **Search evidence Artifact** + provenance; products only if Fabric/import persists **Product** | **Yes** `search_evidence` | SERP ≠ catalog Product |
| O18 | **Execution package** (10-section navigator) | Host assembly | **No** | AI Artifact `execution_package` on **Case** (or multi-case roll-up on Run) | **Yes** | References BO ids only |
| O19 | **Engineering tasks** in package | Navigator tasks | **No** | Package section or Workflow tasks | Inside package | Not Product fields |
| O20 | **Live evidence items** in navigator | Package | **No** | Derived from Search + Fabric provenance | Inside package / search_evidence | |
| O21 | **Ranked options** in navigator | Package | **No** | Same as recommendations → Opportunity + cards | Package refs | |
| O22 | **Candidate stats / filters applied** | Cycle | **No** | AI Run metadata | Package metrics | |
| O23 | **Sources / connector honesty** | Cycle sources[] | **No** | Data Fabric + ConnectorInstallation health | Provenance records | |
| O24 | **Envelope** (meta, actions, blocked) | API response | **No** | Transport contract | Materialized from run+BOs | Not stored as competing SoR |
| O25 | **Learning / PredictionOutcome** | Host learning loop | **Yes** | **PredictionOutcome** (analytics BO) linked Product/Case | Optional summary artifact | |
| O26 | **Case stage / nextAction** | sync after run | **Yes** | **Commerce Case** only | Never AI-owned stage field | Facts → infer/sync |
| O27 | **Harmonization links** | Host side path | **Yes** | Product identity / link tables | No AI artifact required | Domain |
| O28 | **Billing checkout / portal URLs** | Finance tools | **No** (SaaS) | BillingSubscription / session | Run tool output only | org_non_commerce |
| O29 | **Payment variance explanation** | Tool narrative | **Partial** | **Payment/Reconciliation** BO holds numbers; narrative = Artifact or envelope text | **Yes** explain artifact | |
| O30 | **Refund draft** | Tool draft object | **Yes when submitted** | Payment/refund BO or Approval | Draft artifact until approved | |
| O31 | **Supplier comparison narrative** | Example / rec | **Partial** | **Supplier** + **Offer** BOs for structured offers; narrative artifact | **Yes** | |
| O32 | **Media analysis proposal** | Artifact kind | **Partial** | Media assets on Product/Listing when accepted | `media_analysis` until applied | |
| O33 | **Document excerpts** (official docs search) | Search hits | **No** as free BO unless stored | **Document** BO if tenant-stored; else search_evidence only | **Yes** | |
| O34 | **Customer insights** | Rare / analytics | **Yes if durable** | **Customer** BO + analytics signals | Insight artifact optional | |
| O35 | **Workflow plan steps** | planJson / kind | **No** until handoff | Artifact → **Workflow Run** when durable | **Yes** then workflow owns | |

---

## 3. Ownership matrix (normalized)

| Object | System of record | AI may | AI must not |
|--------|------------------|--------|-------------|
| **Commerce Case** | CaseService / CommerceCase row | Attach artifacts; propose transforms; trigger sync | Own stage/status columns directly; free-text as stage |
| **Product** | Product domain / Prisma | Create via Fabric import/discover; update costs only via domain | Invent product from SERP; store product twin only in rec JSON |
| **Supplier / Offer** | Supplier/Offer domain | Create/update via Fabric `search_suppliers` persist path | Duplicate offers only inside recommendation cards |
| **Listing** | Listing domain | prepare/publish via Fabric + domain | Second draft table in AI module |
| **Order** | Order domain | Read/explain; never invent | AI-only order rows |
| **Shipment** | Shipment/Fulfillment domain | create_shipment capability | AI-only tracking as truth |
| **Payment** | Payment domain | verify/reconcile explain | Narrative as ledger |
| **Customer** | Customer domain | Insights with provenance | Fabricated profiles |
| **Documents** | Document store | Index via Search; cite in evidence | Claim docs are listings |
| **AI Artifacts** | Artifact store (case-scoped) | Create all proposal/evidence/narrative kinds | Use as SoR for scores/stages/listings |
| **AI Run** | Run store | Execution audit | Process spine |
| **Events** | Event Fabric | Emit lifecycle/domain events with caseId | Event log as only product store |
| **Analytics** | Signals, Opportunity scores history, PredictionOutcome, KPI store | Write outcomes via analytics services | Parallel KPI only in envelope |
| **Knowledge Graph** | **Projection** over BOs + typed edges | Refresh projection after BO/artifact writes | Separate graph DB of contradictory facts |
| **Data Fabric** | Policy + labels on every evidence/write | Set dataMode/provenance on outputs | Own commerce rows |

### 3.1 Opportunity (explicit)

`opportunity` is already a **BusinessObjectType**. AI ranking must:

1. Upsert **Opportunity** (score, expectedProfit, margin, confidence, productId, caseId).  
2. Emit Artifact `recommendation_card` with `opportunityId` + narrative.  
3. Case.opportunityScore/confidence **copied from Opportunity** via Case sync — not independently invented.

---

## 4. Artifact kinds — refined ownership

| Kind | Payload holds | Must reference | Becomes BO when |
|------|---------------|----------------|-----------------|
| `recommendation_card` | Narrative, rank, assumptions, missingData, hrefs | `caseId`, `productId`, `opportunityId` | Scores already on Opportunity |
| `profit_calculation` | Immutable calc snapshot + provenance | `productId` / `opportunityId` | Inputs may update Product/Opportunity |
| `policy_assessment` | Mirror of assessment | `policyAssessmentId` | **PolicyAssessment** written first |
| `listing_draft` | Optional content snapshot | **`listingId`** | Listing row is SoR |
| `approval_request` | Rationale | **`approvalId`** | Approval row is SoR |
| `search_evidence` | SearchHit[] + honesty | query, hit object ids | Product only if import ran |
| `execution_package` | Navigator sections with **ids only** for BOs | `caseId` / `caseIds` | Never |
| `workflow_plan` | Steps proposal | `caseId` | Workflow Run on handoff |
| `media_analysis` | Proposal | `productId` | Media assets when applied |
| `operator_briefing` *(add)* | Phase B text + briefingSource | `runId`, `caseId?` | Never |
| `validation_report` *(add)* | Critic/auditor | `runId` | Never |
| `payment_explanation` *(add)* | Narrative | `paymentId` / reconciliationId | Amounts on Payment BO |

---

## 5. How one AI interaction updates the system (no duplicate ownership)

### 5.1 Write pipeline (ordered)

```text
1. AI Runtime executes (tools via Search Manager / Fabric / domain ports)
2. Domain services commit canonical BO writes (Opportunity, PolicyAssessment, Listing, …)
3. CaseService.syncCase / ensureCase — stage from facts only
4. AI Artifact materializer writes artifacts referencing BO ids
5. AI Run record stores producer metadata + artifact ids + decision
6. Event Fabric emits domain + AIObjective* events (entityId = case when bound)
7. Knowledge Graph projection invalidated/rebuilt from BO loaders (not from artifact prose)
8. Data Fabric labels already on Search hits / Fabric results flow into provenance on BOs + artifacts
9. Envelope built as read model for this request (not a 10th store)
```

**Order matters:** BO before artifact that cites it; Case sync after facts; KG after both; events after durable writes.

### 5.2 What each layer receives

| Layer | Update mechanism | Does not receive |
|-------|------------------|------------------|
| **Business objects** | Explicit domain API from tool ports / post-run commit map | Free-form LLM JSON as upsert without schema |
| **Commerce Case** | Fact inference + artifact attachment list | Direct stage from model text |
| **AI Artifacts** | Materializer from validated run result | Duplicate full Product blobs |
| **Events** | Host EventPort after commits | Substitute for Prisma |
| **Knowledge Graph** | `projectCaseKnowledgeGraph({…ids from DB…})` | Parsing briefing for edges |
| **Data Fabric** | Propagate dataMode on each write’s provenance fields | Separate “AI dataMode table” conflicting with envelope |
| **Analytics** | PredictionOutcome, scores history services | KPI only in responseSummary |

### 5.3 Knowledge Graph update (detail)

KG is a **read-time or cacheable projection**, not a write-ahead store.

After AI run commits:

```text
Load Case + Product + Opportunities + Listings + Orders + Payments + Shipments
     + Approvals + Artifact ids + AI Run ids + Connector keys
→ projectCaseKnowledgeGraph
→ edges:
    case_for_product
    product_has_opportunity
    product_has_listing
    product_has_artifact
    ai_run_about_case / ai_run_about_product
    order_contains_product, …
```

New relations to enforce:

| Relation | When AI causes |
|----------|----------------|
| `ai_run_about_case` | bindingMode case/multi |
| `ai_run_about_product` | recommendation for product |
| `product_has_artifact` / `case_has_artifact` | materialize |
| `opportunity` node | Opportunity upsert |
| `approval_for_listing` | approval queue |

**Never:** create a KG node for “margin 22%” without Opportunity/Product field holding 22%.

### 5.4 Data Fabric update (detail)

Data Fabric is **policy + labeling**, not an object owner.

On every AI interaction:

1. Each tool/Search/Fabric result already carries `dataMode` / origin.  
2. BO writes copy provenance onto Opportunity/Product/Listing rows (observedAt, sourceConnector, isFixture).  
3. Artifacts store evidence provenance arrays.  
4. Envelope `meta.dataMode` = aggregate (strictest or mixed + warnings).  
5. KG node `meta` may echo fixture flags for UI — still projection.

**No second product catalog** under “AI evidence products.”

### 5.5 Example: portfolio rank (multi_case)

| Step | Owner |
|------|--------|
| Search hits | Search Manager |
| Profit/policy tools | Domain pure + PolicyAssessment write |
| Opportunity upsert per product | Opportunity BO |
| ensureCase + sync | Commerce Case |
| recommendation_card artifacts | AI Artifact on each Case |
| Parent AI Run | multi_case audit |
| ProductEvaluated + CaseAdvanced events | Event Fabric |
| KG per case | Projection |
| Briefing | operator_briefing artifact + envelope text |

### 5.6 Example: publish proposal (case)

| Step | Owner |
|------|--------|
| prepare_listing | Listing BO draft via domain/Fabric |
| approval_request | Approval BO + artifact ref |
| Case → approve waiting | Case sync from hasPendingApproval |
| Phase B text | Briefing artifact |
| Publish itself | Human + Fabric `publish_listing` — not AI output |

---

## 6. Mapping AI interaction types → object updates

| Interaction | BOs touched | Artifacts | Events | KG | Data Fabric |
|-------------|-------------|-----------|--------|-----|-------------|
| Research rank | Product (read), Opportunity (write), Case (ensure/sync) | cards, profit, policy, search_evidence, briefing, package | AIObjective*, ProductEvaluated, CaseAdvanced? | case/product/opp/artifact edges | per-hit modes on evidence + opp |
| Case evaluate | Same single case | Same | Same | Same | Same |
| Draft listing | Listing, Case | listing_draft, card | ListingPrepared, CaseAdvanced | listing node | fixture/live of channel |
| Approval request | Approval, Case | approval_request | ApprovalRequested | approval node | — |
| Order/payment explain | Payment/Order read | payment_explanation, briefing | AIObjective* | existing edges | payment dataMode |
| Shipment create (post-approval) | Shipment | optional package | ShipmentCreated | shipment node | carrier live/fixture |
| Org billing AI | BillingSubscription | run only | AIObjective* | none | n/a |
| Learn / forecast | PredictionOutcome, Case learn | optional | PredictionEvaluated | outcome via product/case | model provenance |

---

## 7. Anti-duplication checklist

| Smell | Remediation |
|-------|-------------|
| Score in card JSON ≠ Opportunity.score | Opportunity is SoR; card reads it |
| Stage only in execution_package | Case is SoR; package quotes case.currentStage at build time |
| Product title only in recommendation | Product.title SoR |
| Draft listing body only in artifact | Listing row SoR |
| Web hit stored as Product without import | search_evidence only until Fabric/domain import |
| Envelope cached as case state | Envelope is request-scoped read model |
| KG edge without BO | Insert BO first |
| Analytics KPI only in briefing | Write PredictionOutcome / signal |

---

## 8. Read model for UI (derived, not owned)

UI may compose:

```text
Case workspace =
  Case BO
  + Product BO
  + Opportunity BO
  + Listings/Orders/…
  + Artifacts (latest briefing, cards, package)
  + KG projection
  + dataMode banners from provenance
```

Pages never treat AI Run as the product page source of truth.

---

## 9. Normalization sequence

1. **Classify** every write in `AiOperatorService` post-cycle into BO vs artifact (use matrix §2).  
2. **Opportunity + PolicyAssessment** always written before recommendation rows; rec stores FKs.  
3. **Listing/Approval** only via domain ids on artifacts.  
4. **Materialize** `execution_package`, `operator_briefing`, `search_evidence` with caseId.  
5. **Strip** durable economics from living only in `evidenceJson` without Opportunity.  
6. **KG rebuild** hook after case-bound runs (projection API).  
7. **Provenance fields** on Opportunity/Product updates from tool dataMode.  
8. **Tests:** no Product created from public_web hits without import path; case stage unchanged by briefing alone.

---

## 10. Closing judgment

Most AI outputs should **not** become new business object types. They should either:

1. **Update existing BOs** (Opportunity, PolicyAssessment, Listing, Approval, PredictionOutcome, Case facts), or  
2. **Remain AI Artifacts** (briefing, package, evidence, validation, plans) that **point at** BOs.

**Commerce Case** orchestrates.  
**BOs** hold facts.  
**Artifacts** hold AI reasoning and evidence.  
**Events** notify.  
**Knowledge Graph** projects relationships.  
**Data Fabric** labels honesty.

That is single ownership — not parallel AI and commerce truths.
