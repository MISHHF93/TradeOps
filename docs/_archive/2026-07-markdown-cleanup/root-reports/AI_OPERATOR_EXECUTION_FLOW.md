# TradeOps AI Operator — Execution Flow (A → Z)

**Audience:** founders, operators, and engineers who need a clear picture of what happens after you type a prompt in the AI Operator.  
**Scope:** the **live path** used by the right-rail AI Operator today (not a redesign).  
**Related:** `AI_UX_NORMALIZATION_REPORT.md`, `COHERE_POST_IMPLEMENTATION_VERIFICATION.md`, `docs/architecture/AI_EXECUTION_FLOW.md` (if present).

---

## One-sentence summary

You type an **objective** in the right rail → the browser calls the **API** → the server runs **Phase A tools** (deterministic) → **Phase B Cohere** writes a briefing from that evidence → the run is **saved** → the rail shows a **short summary** and you open the **full result** under Objectives.

```text
You (prompt)
  → Right AI Operator rail
  → POST /api/v1/ai/operator/run  (or /stream)
  → Auth + tenant + loop mode
  → Load products / case context
  → Phase A: classify + typed tools
  → Phase B: Cohere structured briefing
  → Persist OperatorRun + recommendations
  → UI: summary in rail · full page at /terminal/objectives/[id]
```

---

## Where you start (UI)

| Surface | Role |
|---------|------|
| **Right rail — AI Operator** | Canonical place to type and run an objective |
| **`/terminal/objectives`** | History of past runs |
| **`/terminal/objectives/[id]`** | Full briefing, recs, package, timeline |
| **`/terminal/ai`** | Redirects to objectives (not a second AI app) |

You should **not** need a separate “AI page” to run work. The rail is always available.

---

## A → Z step-by-step

### A. You enter an objective

Examples:

- “Find products worth evaluating for Canada with healthy margin.”
- “Show low-inventory products.”
- “Research Canadian automotive-parts opportunities and cite sources.”

Optional context:

- Commerce Case ID (when “AI on this case” prefilled the rail)
- Workspace persona / focus objective from the API (seed chips)

**Client state** (not the source of truth for results):

- draft text in the rail (`AiOperatorProvider`)
- panel open / compact / expanded preference

---

### B. You click **Send** (or press Enter)

Component: `apps/web/src/components/ai/ai-context-panel.tsx`  
Client: `apps/web/src/lib/ai-operator-client.ts`

1. UI sets busy / progress label.
2. Calls `runOperator({ objective, preferStream: true })`.
3. Prefer **SSE** `POST /api/v1/ai/operator/run/stream`.
4. If stream fails → fall back to **JSON** `POST /api/v1/ai/operator/run`.

Body (typical):

```json
{
  "objective": "…your text…",
  "navigate": false
}
```

`forceShadow` is **only** sent when explicitly opted in (not default).

**No Cohere API key leaves the browser.** The key is server-only.

---

### C. API receives the request

Controller: `apps/api/src/ai/ai.controller.ts`  
Service: `apps/api/src/ai/ai-operator.service.ts`

1. Auth / founder-direct identity resolves **organization** + **user**.
2. Entitlements check (AI allowed for org).
3. Loop mode resolved:

   | Input | Typical mode |
   |-------|----------------|
   | Local founder, fixtures | `development` |
   | Explicit `forceShadow` | `shadow` |
   | `TRADEOPS_FORCE_FIXTURE` | `fixture` |
   | Controlled live + live creds | `controlled_live` (when enabled) |

4. Correlation IDs created: `requestId` / `correlationId` (returned to the client).

---

### D. Load business data (before tools)

Server loads **authorized store data** for the org, for example:

- products (live connectors and/or **fixture** catalog)
- optional Commerce Case binding / AI case context
- connector capability board

**Honesty rule:** if data is fixture-labeled, the run reports `dataMode: "fixture"`. Nothing pretends to be live Shopify if it is not.

---

### E. Phase A — classify the objective

Package: `packages/ai-runtime` → `runOperatorCycle`

1. **Objective type** (examples):
   - `READ_ONLY_ANALYSIS` — research / rank / explain (most sidebar prompts)
   - publish / PO / financial types — may set **approval required**
2. Extract soft filters from text when possible (market, margin, price, etc.).
3. Emit progress (stream): `classifying`, `calling_tools`, …

Phase A is **deterministic and typed**. It does not invent products.

---

### F. Phase A — select and run tools

Tools live in the TradeOps tool registry (not free-form vendor calls from the model).

Typical tool sequence for product research:

| Order | Tool (example) | Purpose |
|-------|----------------|---------|
| 1 | `listConnectorCapabilities` | What sources exist / health |
| 2 | `researchSearchPublicWeb` | Tavily public web (if `TAVILY_API_KEY` set) |
| 3 | `searchConnectedProducts` | Org catalog / connected sources |
| 4 | `calculateContributionProfit` | Unit economics (per candidate) |
| 5 | `assessPolicyRisk` | Policy gate (per candidate) |

Each tool:

- validates inputs against its schema  
- checks permissions / loop mode  
- returns structured results  
- is recorded in **toolTrace**

If Tavily is missing: research tool **blocks honestly** (no fake search hits).  
If store is empty: later stages report empty / no qualifiers — **no demo essay**.

Progress events (SSE `state`): e.g. `retrieving`, `evaluating`, `ranking`.

---

### G. Phase A — rank and build recommendations

From tool outputs the cycle:

1. Drops candidates missing required cost data  
2. Applies policy / margin / filter rules  
3. Ranks survivors  
4. Builds **recommendation cards** (title, rationale, confidence, next actions, evidence flags)

These cards are **tool-backed**, not written by Cohere first.

Critic / auditor passes may annotate issues (severity, calculation/policy notes).

---

### H. Phase B — Cohere generative briefing (only if configured)

**Only after** tool evidence exists (or empty-store / no-qualifier short status).

1. Progress: `synthesizing` — “Phase B synthesis”.
2. Server builds:
   - **system** instructions (tool evidence only; no fixed template essay; JSON schema)
   - **user** prompt = your objective + loop mode + evidence brief + fact lines
3. Calls **Cohere Chat API V2** (`https://api.cohere.com/v2/chat`) with:
   - model: `COHERE_CHAT_MODEL` (default `command-a-plus-05-2026`)
   - `response_format.type = "json_object"`
   - schema id: **`operator_briefing`**
4. Parses structured fields (`narrative`, `nextAction`, …).
5. Sets:
   - `briefingSource: "cohere"`
   - `fixed_template=false` on the timeline  
   - `responseSummary` = model narrative (not a canned scorecard)

**If `COHERE_API_KEY` is missing / invalid / empty text:**

- `briefingSource: "blocked"` (or similar honest code)
- short status string  
- **no** fixed multi-product essay  
- recommendation cards still available when tools ranked products  

Key is loaded from monorepo root `.env` via `loadEnv()` — **never** from the browser.

---

### I. Build execution package (when navigated / package path)

For many runs the service also attaches an **Execution Package** (objective, state, evidence, plan, risks, verification).  
Sidebar runs use `navigate: false` so the rail stays light; the full package is still available on the run detail API/UI when produced.

---

### J. Persist the run

Server writes durable records, for example:

- **OperatorRun** — objective, status, decision, plan/timeline JSON, tool trace  
- **OperatorRecommendation** rows — ranked options  
- optional case sync / events for the process board  

Returns to the client:

| Field | Meaning |
|-------|---------|
| `runId` | Open full result: `/terminal/objectives/{runId}` |
| `requestId` / `correlationId` | Support / logs |
| `status` | e.g. `completed` |
| `decision` | e.g. `accept` / `block` |
| `loopMode` | e.g. `development` |
| `briefingSource` | `cohere` \| `blocked` \| `empty_store` \| … |
| `responseSummary` | Briefing or honest status text |
| `recommendations` | Ranked cards |
| `timeline` | Phase A/B steps |
| `toolTrace` | Tools that ran |
| `honesty` | Fixture / live / shadow notes |

---

### K. Stream completion (if SSE)

SSE events (simplified names used today):

```text
event: state   → queued → classifying → calling_tools → retrieving
               → evaluating → ranking → synthesizing → validating → completed
event: result  → full OperatorRun payload
event: error   → failure (no silent demo)
```

The rail does **not** use fake timers for production progress; labels come from these events.

---

### L. Right rail renders (concise)

`AiContextPanel` shows:

1. Provenance chips (e.g. **Cohere (live)**, fixture, Phase B latency)  
2. Short briefing preview (not the full long essay)  
3. **Top** recommendation  
4. Actions: **Open full result**, history, optional “more recs”  
5. Collapsible tool names / secondary recs  

Long tables, full package, and full narrative belong on the objective page.

---

### M. Full result workspace (optional but recommended)

User clicks **Open full result** → `/terminal/objectives/{runId}`:

- complete briefing  
- all recommendations + confidence  
- timeline / sources  
- execution package sections when present  
- audit-friendly durable record  

History list: `/terminal/objectives`.

---

### N. Follow-up actions

From cards or full page, the user may:

- view product  
- add to watchlist  
- create listing draft (still not publish)  
- open case / task / approval  
- rerun a new objective in the rail  

Consequential actions (publish, PO, refunds, billing) remain **approval-gated** when classified as such.

---

## End-to-end diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│  CENTER WORKSPACE          │  RIGHT RAIL — AI OPERATOR          │
│  Products / Cases / …      │  [objective textarea] [Send]       │
└─────────────┬──────────────┴──────────────┬─────────────────────┘
              │                             │
              │                    B. runOperator()
              │                             ▼
              │              POST /api/v1/ai/operator/run[/stream]
              │                             │
              │         ┌───────────────────┴───────────────────┐
              │         │  API: auth · tenant · loopMode        │
              │         │  load products / case context         │
              │         └───────────────────┬───────────────────┘
              │                             ▼
              │         ┌───────────────────────────────────────┐
              │         │  PHASE A (tools, deterministic)       │
              │         │  classify → tools → rank → recs       │
              │         └───────────────────┬───────────────────┘
              │                             ▼
              │         ┌───────────────────────────────────────┐
              │         │  PHASE B (Cohere Chat V2, optional)   │
              │         │  evidence → JSON briefing schema      │
              │         │  or honest block if key/API fails     │
              │         └───────────────────┬───────────────────┘
              │                             ▼
              │         Persist OperatorRun + recommendations
              │                             │
              │         ◄──── result + runId ───────────────────┘
              ▼
   /terminal/objectives/[runId]   full A→Z artifact for humans & audit
```

---

## What each “layer” is allowed to invent

| Layer | May invent products/prices? | Output |
|-------|----------------------------|--------|
| Phase A tools | **No** | Structured tool results only |
| Phase B Cohere | **No** new facts; narrative from evidence | Briefing text + schema fields |
| Fixture mode | Uses labeled fixture catalog | `dataMode: fixture` always visible |
| Failure paths | **No** demo essay | Short honest status + cards if any |

---

## Environment that powers the path

| Variable | Used for |
|----------|----------|
| `COHERE_API_KEY` | Phase B Chat / health (server only) |
| `COHERE_CHAT_MODEL` | Default `command-a-plus-05-2026` |
| `COHERE_EMBED_MODEL` / `COHERE_RERANK_MODEL` | Embed/rerank when used |
| `TAVILY_API_KEY` | Public web research tool |
| `DATABASE_URL` | Persist runs + load products |
| `TRADEOPS_ACCESS_MODE` | e.g. `founder_direct` local |

Loaded by: root `.env` → `packages/config` `loadEnv()` → Nest API.  
**Never** `NEXT_PUBLIC_COHERE_*`.

Deep health: `GET /api/v1/ai/health?deep=true` → `COHERE_OK` when live.

---

## How to read a finished run (checklist)

1. **Rail chips:** `Cohere (live)` vs blocked; fixture badge if applicable.  
2. **`briefingSource`:** must be `cohere` for generative briefing.  
3. **Timeline:** Phase B line like `provider=cohere … schema=operator_briefing`.  
4. **`fixed_template=false`** on briefing source step.  
5. **`runId`** → full page for the complete narrative.  
6. **toolTrace** → which tools ran (Tavily, profit, policy, …).

---

## Example timeline (happy path)

| Step | Meaning |
|------|---------|
| Objective received | Your prompt accepted |
| Phase A tool ranking | Tools selected |
| Validating connected data sources | Connectors / capabilities |
| Public web research | Tavily (if keyed) |
| Searching authorized product sources | Catalog search |
| Costs, risks, opportunity scores | Economics + policy |
| Candidates ranked | Recommendation list ready |
| Phase B synthesis | Cohere writing briefing |
| Synthesis complete | Narrative ready |
| Briefing source = cohere | Not a fixed template |
| Operator cycle finished | Run complete |

---

## Failure paths (still A → Z, just shorter)

| Failure | What you see |
|---------|----------------|
| No products | `empty_store` / import fixtures CTA |
| Tools rank none | `no_qualifiers` + filter notes |
| No / bad Cohere key | `blocked` + short status; **cards still may show** |
| Cohere HTTP error | Coded note (`COHERE_KEY_INVALID`, rate limit, etc.) |
| DB down | API 503; operator refuses to invent results |

---

## File map (for engineers)

| Step | Primary files |
|------|----------------|
| Rail UI | `apps/web/src/components/ai/ai-context-panel.tsx` |
| Client HTTP/SSE | `apps/web/src/lib/ai-operator-client.ts` |
| Shared draft / rail mode | `apps/web/src/lib/ai-operator-context.tsx` |
| Routes | `apps/api/src/ai/ai.controller.ts` |
| Orchestration | `apps/api/src/ai/ai-operator.service.ts` |
| Cycle A+B | `packages/ai-runtime/src/operator-cycle.ts` |
| Cohere | `packages/ai-runtime/src/cohere-adapter.ts` |
| Tools | `packages/ai-runtime/src/tool-registry.ts`, `builtin-tools.ts` |
| Web search | `packages/ai-runtime/src/web-search-provider.ts` |
| Env | `packages/config/src/dotenv.ts`, `index.ts` |
| History UI | `apps/web/src/app/terminal/objectives/` |

---

## Bottom line

**From A to Z:**  
prompt in the **right rail** → **API** → **Phase A tools** (truth) → **Phase B Cohere** (wording from truth) → **save run** → **short rail summary** → **full objective page** for the long read.

That is the only AI execution path the product should use for operator objectives.
