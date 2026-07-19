# Cohere Post-Implementation Verification

**Date:** 2026-07-19  
**Mode:** Verification only (no AI runtime redesign)  
**Secrets:** Not included in this document.

---

## Executive verdict

| Area | Verdict |
|------|---------|
| Local Cohere authentication | **PASS** (`COHERE_OK` deep health) |
| Phase B real generation | **PASS** (`briefingSource=cohere`, schema `operator_briefing`) |
| Fixed / demo essay substitution | **PASS** (none observed; `fixed_template=false`) |
| Sidebar API path (shared client) | **PASS** (5/5 objectives completed with Cohere) |
| Browser bundle secrets | **PASS** (no `COHERE_API_KEY` in `apps/web/src`) |
| Streaming | **PARTIAL** (real SSE `state`/`result` events; not full `objective.*` / `text.delta` catalog) |
| Deployed production runtime | **NOT VERIFIED** (no cloud deploy config / secrets store in repo) |
| Web UI process (:3000) | **DOWN** at audit time (API+DB up) |

**Claim allowed:** Local API + operator path produce real Cohere-generated, schema-validated briefings persisted as operator runs.  
**Claim not allowed:** Production deployment verified, or full professor event catalog streaming, or live browser-sidebar session automation.

---

## 1. Files inspected

### Core path
- `scripts/start.mjs` — root `.env` load (empty-fill)
- `packages/config/src/dotenv.ts`, `packages/config/src/index.ts` — `loadDotEnvFiles` + `envSchema` + key mirror
- `apps/api/src/main.ts` — `loadEnv()` before Nest listen
- `apps/api/src/ai/ai-operator.service.ts` — init bootstrap, `runObjective`, `synthesizeWithLlm: true`, forceShadow opt-in
- `apps/api/src/ai/ai.controller.ts` — `GET health?deep=true`, `POST operator/run`, `POST operator/run/stream`
- `packages/ai-runtime/src/cohere-adapter.ts` — Chat V2, deep probe, error codes
- `packages/ai-runtime/src/provider-abstraction.ts` — Cohere-only policy
- `packages/ai-runtime/src/operator-cycle.ts` — Phase A tools + Phase B synthesis
- `packages/ai-runtime/src/schema-registry.ts` — `operator_briefing`
- `apps/web/src/lib/ai-operator-client.ts` — sidebar/console shared client (SSE→JSON)
- `apps/web/src/components/ai/ai-context-panel.tsx` — right AI sidebar
- `apps/web/src/lib/ai-briefing-provenance.ts` — provenance chips

### Config / deploy templates
- `.env.example`, `.env.production.example`, `.env.development.example`, `.env.test.example`
- No `vercel.json` / `fly.toml` / active production host config found in-repo

### Prior report
- `COHERE_PHASE_B_FIX_REPORT.md`

### Live artifact from this audit
- `scripts/_verify-cohere-results.json` (generated; no secrets)

---

## 2. Changes discovered (Git)

Large working tree vs `master` (~73 modified tracked files + many untracked). Cohere-relevant **untracked** additions:

| Path | Classification |
|------|----------------|
| `packages/ai-runtime/src/cohere-adapter.ts` (+ tests) | **correct** |
| `packages/ai-runtime/src/provider-abstraction.ts` | **correct** |
| `packages/ai-runtime/src/schema-registry.ts` | **correct** |
| `packages/config/src/dotenv.ts` (+ tests) | **correct** |
| `apps/web/src/lib/ai-operator-client.ts` | **correct** |
| `apps/web/src/lib/ai-briefing-provenance.ts` | **correct** |
| `COHERE_PHASE_B_FIX_REPORT.md` | **correct** (docs) |
| `packages/ai-runtime/src/xai-adapter.ts` | **unnecessary** for production path (policy ignores xAI generative) |
| `cohereapisetup.md` | **incomplete** (docs hygiene; not audited for secrets here) |

Tracked diffs of note:

| Path | Classification |
|------|----------------|
| `scripts/start.mjs` empty-env fill | **correct** |
| `packages/config/src/index.ts` Cohere schema | **correct** |
| `apps/api` AI controller/service | **correct** (core path) |
| `packages/ai-runtime/src/operator-cycle.ts` Phase B | **correct** |
| `.env.example` | **correct** |
| `.env.production.example` models (was outdated) | **incomplete** → **repaired this audit** to command-a-plus / embed-v4 / rerank-v3.5 |
| Broad UI/CSS/commerce edits | **untested** by this Cohere audit (out of scope) |

No parallel second Cohere runtime was created.

---

## 3. Local environment status

| Component | Status |
|-----------|--------|
| PGlite `:51214` | UP |
| API `:4000` | UP (`postgres=up`; overall **degraded** when Redis down) |
| Web `:3000` | **DOWN** at verification time |
| Redis `:6379` | Not running (optional for operator) |
| Root `.env` `COHERE_API_KEY` | Present (len 40; not printed) |
| Models in `.env` | `command-a-plus-05-2026`, `embed-v4.0`, `rerank-v3.5` |
| `AI_PROVIDER` | `cohere` |

### Env load confirmation

| Consumer | Receives `COHERE_API_KEY`? |
|----------|----------------------------|
| Nest API (`loadEnv` + `onModuleInit`) | **Yes** |
| Worker | **Not required** for Phase B operator path; no worker Cohere bootstrap found as hard dependency |
| Next browser bundle | **No** (scan: 0 client key refs) |
| Git tracked `.env` | **None** |

Whitespace/empty rejection: unit tests + `resolveCohereApiKey` trim.  
Restart applies env: API restarted with keys for live tests.

---

## 4. Deployed environment status

| Check | Result |
|-------|--------|
| In-repo production secret injection | **Not found** (placeholders only) |
| Evidence app redeployed to a host | **Not found** |
| Preview vs production separation | Templates exist (`.env.production.example`); **host values not verified** |
| Serverless timeout / stream buffering | **N/A / not verified** (local Node process) |

**Production `COHERE_API_KEY` existence in a real host:** **UNKNOWN — manual action required.**

---

## 5. Cohere authentication result

`GET /api/v1/ai/health?deep=true` (live):

| Field | Value |
|-------|--------|
| configured | true |
| authenticated | true |
| modelAvailable | true |
| structuredOutputHealthy | true |
| errorCode | **COHERE_OK** |
| model | command-a-plus-05-2026 |
| keyPresent | true |
| latencyMs | ~776–1098 (sample range) |

Embed/Rerank models are configured via env defaults and used by adapter methods; deep health probes **Chat V2 + structured JSON**, not separate embed/rerank HTTP probes.

Provider request ID from Cohere HTTP is **not** currently surfaced in deep health response (latency is). Internal TradeOps `requestId` / `correlationId` are returned on operator runs.

---

## 6. Phase A result

Observed on all five operator runs (tool traces):

| Step | Observed |
|------|----------|
| Classification | `objectiveType=READ_ONLY_ANALYSIS` (including “listing but do not publish” — read-only path) |
| Tool selection / execution | `listConnectorCapabilities`, `researchSearchPublicWeb`, `searchConnectedProducts`, profit ×3, policy ×3 |
| Tools completed | 9/9 per run |
| Tenant context | Founder-direct org scope; runs persisted with `runId` |
| Permissions | Founder path allows operator |

**Note:** Inventory / automotive research still ranks **fixture store products** when that is the authorized catalog — honest `dataMode=fixture`, not invented demo essay.

---

## 7. Phase B result

| Check | Result |
|-------|--------|
| Evidence → Cohere | Yes (timeline synthesizing → validating) |
| Narrative provider | **cohere** on 5/5 runs |
| Schema | `schema=operator_briefing` in Phase B detail |
| `fixed_template` | **false** |
| Malformed JSON repair loop | **NOT IMPLEMENTED** (parse fallback keeps raw text; no second repair attempt) |
| Frontend receives only final result | Yes (JSON result or SSE `result` event) |

Sample Phase B latency from runs: ~4.3s–12.8s synthesis; total objective ~9–18s.

---

## 8. Structured-output result

- Chat V2 body uses `response_format.type = "json_object"` + registered schema with **required** fields (`operator_briefing`).
- No `strict_tools` on Phase B synthesis body.
- Deep health structured probe healthy.
- Unit tests cover body shape (`cohere-adapter.test.ts`).

**Gap:** No automated “malformed → one repair → else block” integration test/path.

---

## 9. Sidebar test results

Tests used the **same API contract as the right AI sidebar** (`POST /api/v1/ai/operator/run`, `navigate: false` — matches `ai-operator-client.ts`). Browser DOM automation was not run; **Web :3000 was down**.

| # | Objective | runId | requestId | briefingSource | schema | dataMode | recs | latencyMs | fixed essay? |
|---|-----------|-------|-----------|----------------|--------|----------|------|-----------|--------------|
| 1 | Hi | `8e2b15c6-…` | `67136528-…` | **cohere** | operator_briefing_ok | fixture | 3 | 16596 | no |
| 2 | Explain lifecycle | `11e2c5dc-…` | `d2e5c072-…` | **cohere** | ok | fixture | 3 | 12548 | no |
| 3 | Low-inventory products | `d9243fae-…` | `0ad3edb8-…` | **cohere** | ok | fixture | 3 | 8988 | no |
| 4 | Canadian auto-parts research | `96fdae8f-…` | `bddb5825-…` | **cohere** | ok | fixture | 3 | 17866 | no |
| 5 | Prepare listing, do not publish | `5e8f0291-…` | `199fa2ef-…` | **cohere** | ok | fixture | 3 | 15604 | no |

- **provider:** cohere  
- **model:** command-a-plus-05-2026  
- **connector/tools:** Tavily research tool when configured + store tools; fixture catalog  
- **final status:** completed / accept  
- **frontend:** would render via `responseSummary` + provenance chips when web is up  

Persisted runs: API returns `runId` and stores operator runs (list endpoint available).

---

## 10. Streaming status

| Item | Status |
|------|--------|
| Sidebar client | Prefers SSE ` /ai/operator/run/stream`, falls back to JSON |
| Fake progress timers in AI panel | **Not found** (progress from `onProgress` SSE only) |
| Live SSE events observed | `event: state` with states: `queued`, `classifying`, `calling_tools`, `retrieving`, `evaluating`, `ranking`, `synthesizing`, `validating`, `completed`; then `event: result` |
| Professor catalog (`objective.started`, `text.delta`, `artifact.validated`, …) | **Not implemented as named events** — **PARTIAL** |

---

## 11. Fixture / static-response findings

| Finding | Assessment |
|---------|------------|
| `dataMode: fixture` labeled | **correct** honesty |
| No “I evaluated N products / Strongest opportunity” fixed essay | **correct** |
| `fixed_template=false` on cohere successes | **correct** |
| Missing key → blocked, tools may still rank | **correct** (unit + prior live tests) |
| Auto-parts research returns fixture non-auto products | **truthful fixture mode**, not silent demo invention — product set limited by store |

---

## 12. Remaining blockers

1. **Web process down** — cannot visually confirm sidebar chrome without restart.  
2. **No cloud deployment verification** — production secret presence unknown.  
3. **Redis down** — API may stay `degraded`; not blocking Phase B.  
4. **No Phase B JSON repair-once path**.  
5. **SSE event names** incomplete vs professor catalog; no `text.delta` streaming of tokens.  
6. **Deep health** does not separately probe Embed/Rerank HTTP.  
7. **`.env.bak-*` files** may hold secrets on disk — ensure never committed (gitignored patterns vary).  
8. Broad monorepo uncommitted UI/commerce changes **untested** by this audit.

---

## 13. Exact manual actions required

1. Start web: `pnpm stack:up:win` or restart Next on `:3000`.  
2. Open `http://127.0.0.1:3000`, run one objective in the **right AI panel**; confirm chips: **Cohere (live)**, **No fixed template**.  
3. For production: inject `COHERE_API_KEY` + model env into the real host secret store; redeploy API; hit deployed `/api/v1/ai/health?deep=true`.  
4. Optionally start Redis if workers/queues are required.  
5. Rotate keys if they were ever pasted into chat.  
6. Delete or quarantine local `.env.bak-*` if unused.

---

## 14. Test results

| Suite | Result |
|-------|--------|
| `@tradeops/ai-runtime` unit | **40/40 pass** |
| `@tradeops/config` unit | **28/28 pass** |
| Live deep health | **COHERE_OK** |
| Live 5 objectives | **5/5 cohere**, 0 fixed essays |
| Live SSE probe | **state + result** events |
| Secret scan (source + NEXT_PUBLIC) | **0 findings** |
| Git tracked `.env` | **none** |
| Format / full monorepo lint / full production web build | **Not fully run** (web build previously fragile; package.json BOM fixed earlier) |
| Tenant-isolation dedicated suite | **Not re-run** in this pass |

---

## 15. Production build result

| Build | Result |
|-------|--------|
| `ai-runtime` / `api` tsc build | **Pass** (prior session + typecheck) |
| `apps/web` production `next build` | **Not re-run successfully in this verification** (was failing earlier on `package.json` BOM; JSON now valid) |
| Deploy pipeline | **None verified** |

---

## Path checklist (end-to-end)

```
Right AI sidebar (ai-context-panel)
  → ai-operator-client (SSE/JSON, navigate:false, forceShadow opt-in only)
  → POST /api/v1/ai/operator/run[/stream]
  → Auth / founder_direct tenant context
  → Phase A classify + typed tools
  → Phase B Cohere Chat V2 + operator_briefing schema
  → responseSummary + briefingSource=cohere
  → OperatorRun persistence (runId)
  → Frontend briefing + provenance chips
```

**Locally this path works for generation.** UI process must be up for human visual confirmation.

---

## Diff classification summary (Cohere-critical)

| Item | Class |
|------|--------|
| Env load + empty-fill | correct |
| Cohere adapter + deep health + error codes | correct |
| Phase B synthesis + no fixed essay | correct |
| Sidebar client + provenance UI | correct |
| xAI adapter file retained | unnecessary (inactive) |
| SSE professor event catalog | incomplete |
| JSON repair-once | incomplete |
| Production host secrets | untested |
| Outdated production model comments | incomplete → repaired |

---

## Bottom line

**Do claim (local):** Real Cohere Phase B briefings with schema validation and no fixed product essays on the operator API path used by the right sidebar client.  
**Do not claim:** Deployed production verified, full token streaming, or browser UI confirmed while web is down.

Repair applied during verification only: **`.env.production.example` model defaults** aligned to the approved Cohere stack.
