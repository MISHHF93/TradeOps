# TRADEOPS PROFESSOR MODE
## PROJECT WRAP-UP — LEAVE NOTHING BEHIND

Continue inside the existing **TradeOps** repository at the workspace root.

This is a **close-out / completeness** phase. Do **not** redesign the product from scratch. Do **not** start unrelated greenfield work.

Your job is to **audit everything built across recent phases**, identify anything incomplete, half-wired, orphaned, or still demo-backed, and **bring the platform to a coherent, shippable AI Commerce Operating System** without leaving gaps.

---

## CONTEXT — WHAT WAS ALREADY BUILT (DO NOT RE-DO FROM ZERO)

Recent phases already delivered substantial work. Treat these as the baseline. Extend and finish; do not replace.

### 1. Live Connector Ecosystem & Production Data Platform
- Production connector catalog (`packages/connector-core/src/production-connectors.ts`)
- Live HTTP adapters (`@tradeops/connector-live-http`) — Shopify, Stripe, FX, Woo, EasyPost, SerpAPI (credential-gated)
- `LiveConnectorService`, webhook queue/normalizer, OpsSyncScheduler
- Ops APIs: health, registry, production catalog, live-sync, capability resolve
- Docs: `TRADEOPS_CONNECTOR_ECOSYSTEM.md`, `TRADEOPS_CONNECTOR_AUDIT.md`

### 2. AI Execution Navigator (Objective Resolution Engine)
- Execution Package (10 sections): objective, state, evidence, recommendations, plan, timeline, dependencies, risks, status, verification
- `packages/ai-runtime/src/execution-navigator.ts`
- `POST /ai/navigator/resolve`, operator run with navigate default
- Knowledge base deltas on OperatorRun
- Docs: `TRADEOPS_AI_EXECUTION_NAVIGATOR.md`

### 3. Persona-Driven Workspaces
- Principle: **One User · One Workspace · One Objective · One AI**
- Dynamic Workspace Resolver, Focus + More sidebar
- Persona homes: priorities, AI briefing, objectives, KPIs, alerts
- AI-first navigation (`GET /workspace/navigate`)
- Docs: `TRADEOPS_WORKSPACE_IA.md`

### 4. Operational Intelligence Engine
- Live signals → persona-weighted insights → attention score → focus objective
- Wired into workspace resolve, sidebar health, AI focus prefill
- Docs: `TRADEOPS_INTELLIGENCE_ENGINE.md`

---

## PHASE GOAL

**Leave nothing behind.**

Produce a system where:

1. Every major surface is **persona-workspace owned** or clearly **process / case / admin / connector**.
2. Every production KPI is **live, canonical, derived (labeled), or unavailable** — never fabricated.
3. Every connector is **registered**, **health-aware**, and **credential-honest**.
4. Every AI interaction starts from an **objective** and can produce an **Execution Package**.
5. Intelligence **continuously ranks** what matters for the current persona.
6. Simulation/fixtures are **isolated and labeled**.
7. Builds, tests, and smoke paths pass.
8. A single **close-out report** documents done vs remaining (honest).

---

## MANDATORY FIRST STEP — FULL GAP AUDIT

Before implementing, audit the repository and produce a structured inventory.

### A. Demo / mock / fake inventory
List every remaining instance of:
- mock services, fake datasets, seeded-only demo KPIs
- random number generators used as production metrics
- hardcoded dashboard numbers
- disconnected workflows
- simulated connectors presented as live
- unlabeled fixture products in production workspaces

### B. Connector completeness
For each production catalog connector:
| Field | Status |
|-------|--------|
| Registered in catalog | Y/N |
| Credential probe | Y/N |
| Live HTTP adapter | Y/N / stub |
| Webhook handler | Y/N |
| Normalization | Y/N |
| Health in Ops Center | Y/N |
| Tests | Y/N |

### C. Workspace / nav completeness
- Every terminal route: persona ownership, category (workspace | process | case | settings | connector | admin)
- Orphan pages still in permanent nav
- Sidebar Focus still too large for any persona
- Persona homes missing intelligence surface

### D. AI / intelligence completeness
- Execution Package on every operator run
- Knowledge base load on subsequent objectives
- Intelligence signals fully loaded from DB
- AI tools never call vendor REST directly
- Focus objective drives AI panel

### E. Quality gates
- `pnpm` package builds for touched packages
- Unit tests for connector-core, live-http, ai-runtime, commerce-engine
- API typecheck/build
- Web typecheck
- Any broken imports, dead routes, or missing exports

**Output of audit:** `docs/TRADEOPS_CLOSEOUT_AUDIT.md` with status **DONE / PARTIAL / MISSING** per item.

---

## THEN IMPLEMENT — CLOSE ALL MATERIAL GAPS

Work through the audit. Prefer finishing PARTIAL items over inventing new features.

### Priority order (must address)

1. **Honesty**
   - Remove or label any remaining fabricated production KPIs.
   - Ensure production isolation filters work when strict/simulation flags set.
   - Empty states when live data unavailable.

2. **Connector path**
   - Ensure monorepo build includes `@tradeops/connector-live-http`.
   - Live-sync + ensure-registry paths work end-to-end when env creds present.
   - Registry never shows `connected` without credentials.
   - Adapter stubs remain explicit (`adapter_stub`), never fake payloads.
   - Expand HTTP adapters only where high value and pattern already exists (optional if time; document if deferred).

3. **Workspace + intelligence**
   - Confirm every persona home uses intelligence surface.
   - Confirm sidebar is Focus + collapsed More only.
   - Confirm AI prefill uses focus objective.
   - Wire any missing signal (orders, opportunities, signals, failed runs) if not loading.

4. **AI Execution Navigator**
   - Confirm operator/run returns execution package.
   - Confirm objectives detail page renders package.
   - Confirm knowledge deltas persist and reload.

5. **Route cleanup**
   - Redirect or own any orphan feature pages still competing with workspaces.
   - Cockpit → executive (if not already).
   - Pipeline → process (if not already).

6. **Observability / ops**
   - Ops health center reports production catalog summary.
   - Telemetry metrics for live_sync / capability_resolve if present.
   - Document remaining OTel/Prometheus/Grafana wire-up honestly as PARTIAL if not production-hard.

7. **Tests & docs**
   - Fix failing tests.
   - Update close-out report and release notes.
   - Ensure FIRST_RUN / LOCAL_SETUP mention simulation vs production and connector env keys.

### Explicitly out of scope (document, do not block close-out)
- Full HTTP for every vendor in the catalog (Amazon SP-API, all carriers, all ad platforms, etc.) — registry + credential gates are enough if documented.
- Full OAuth redirect UIs for every provider — env/token path acceptable if documented.
- Capital/network investment custody features.
- UI redesign / new design system.

---

## SUCCESS CRITERIA (CLOSE-OUT COMPLETE ONLY WHEN)

- [ ] Close-out audit document exists and is accurate
- [ ] No production workspace path invents KPIs
- [ ] Fixtures/simulation always labeled
- [ ] Workspace resolver + Focus nav + intelligence brief work for all six personas
- [ ] AI navigator produces Execution Packages on objective resolution
- [ ] Connector registry is single source of truth; live HTTP credential-gated
- [ ] Builds and unit tests for core packages pass
- [ ] Honest remaining backlog listed (not hidden)
- [ ] One paragraph “how to run locally and see intelligence + AI objective” in close-out doc

---

## EXECUTION STYLE

- **Implement**, do not only plan.
- Prefer small, coherent commits of logic over drive-by refactors.
- Match existing monorepo patterns (Nest API, Next web, packages/*).
- Never claim live marketplace truth without credentials and successful sync.
- When something cannot be finished, mark **PARTIAL** with exact file path and next step — do not silently leave dead code.

---

## DELIVERABLES

1. `docs/TRADEOPS_CLOSEOUT_AUDIT.md` — full gap matrix  
2. Code fixes for all material PARTIAL items that can be closed in this session  
3. `docs/TRADEOPS_RELEASE_CLOSEOUT.md` — what shipped, how to verify, residual backlog  
4. Green builds/tests for packages touched  

---

## START NOW

1. Run the gap audit across the repo.  
2. Fix the highest-impact honesty and wiring gaps.  
3. Verify with tests/builds.  
4. Write the close-out documents.  

Remember: the standard is **nothing important left behind** — either finished, or explicitly tracked with status and next step. No silent half-work.
