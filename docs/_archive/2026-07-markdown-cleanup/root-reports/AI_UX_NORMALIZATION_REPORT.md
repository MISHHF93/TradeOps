# AI UX Normalization Report

**Date:** 2026-07-19  
**Scope:** Information architecture, layout, and component ownership  
**Out of scope:** New AI runtime, new tools, backend operator cycle redesign

---

## 1. Problem statement

TradeOps presented AI as multiple competing products:

- persistent right rail (`AiContextPanel`);
- full-page `/terminal/ai` + `AiOperatorConsole`;
- left Focus “AI” destination;
- global `ProcessRelatedLinks` including “AI Operator”;
- long-form results crammed into a narrow rail.

Users had to choose *where* to run AI rather than *what* business work to do.

---

## 2. Target model (implemented)

```text
One Workspace · One Context · One AI Operator · One Primary Nav · One Execution Surface
```

| Surface | Role |
|---------|------|
| **Right rail** | Universal contextual AI Operator (composer, progress, short summary, top rec, open full) |
| **`/terminal/objectives`** | Run history only |
| **`/terminal/objectives/[id]`** | Full briefing, package, recs, audit |
| **Left Focus** | Business destinations; **Objectives** replaces **AI** |
| **Center pages** | Business objects — no second objective textarea |

---

## 3. Implementation summary

### Navigation & routes

- `packages/commerce-engine` Focus: **Objectives** instead of **AI** for all personas.
- Procedure / deep links that pointed at `/terminal/ai` retargeted to **objectives** or workspace.
- `next.config.mjs` + `app/terminal/ai/page.tsx`: **redirect** to `/terminal/objectives`.
- `terminal-routes.ts`: `/terminal/ai` = `legacy_redirect`.

### Layout

- `TerminalShell` wraps **`AiOperatorProvider`** (shared draft, last run id, rail mode).
- Rail modes: `closed | compact | standard | expanded` (persisted in `localStorage`).
- Center workspace keeps majority width; compact/expanded CSS vars.

### Right rail density

- Briefing **preview** (~420 chars), not full essay.
- **Top recommendation only** by default; “more” expands secondaries.
- **Open full result** → `/terminal/objectives/{runId}`.
- Provenance chips retained (Cohere / fixture / Phase B).

### Duplicate surfaces

- Full AI landing page **removed** (redirect only).
- `TerminalPageFrame` **hides** global related strip by default.
- `AiSidePanel` deprecated (does not auto-open a second composer).

### Shared state (`ai-operator-context.tsx`)

- `draftObjective`, `lastRunId`, `railMode`, `openWithObjective()`.
- Does **not** store authoritative results client-side.

---

## 4. Backend preserved

- Same `runOperator` / SSE client → `POST /api/v1/ai/operator/run`.
- Same OperatorRun persistence and Cohere Phase B path.
- No fixture essay substitution; `briefingSource` still authoritative.

---

## 5. Tests run

| Suite | Result |
|-------|--------|
| `@tradeops/commerce-engine` workspace nav tests | **Pass** (59) |
| Web `tsc --noEmit` | **Pass** (after changes) |
| Full Playwright matrix / production web build | Not re-run in this pass |

---

## 6. Manual verification checklist

1. Open `http://127.0.0.1:3000/terminal/workspace` — left Focus has **Objectives**, not **AI**.
2. Right rail visible; run an objective — short summary + **Open full result**.
3. Visit `/terminal/ai` — lands on **Objectives** history.
4. Open a run — full briefing on `/terminal/objectives/[id]`.
5. Toggle rail width control (compact / standard / expanded).
6. Confirm pages no longer show a second global “Home Discover … AI Operator” strip under titles (unless a page opts into `showRelatedNav`).

---

## 7. Follow-ups (not blocking)

- Prefill rail from `?objective=` query on objectives page via `openWithObjective` on client mount.
- Case page “Run AI” should call `openWithObjective` instead of only linking history.
- Further split `objective-*.tsx` components under `components/objectives/` (detail page still monolithic).
- Responsive mobile sheet for AI rail.
- Re-enable `showRelatedNav` only on Process board if product wants a short spine.

---

## 8. Completion vs professor criteria

| Criterion | Status |
|-----------|--------|
| One persistent AI Operator | **Yes** (right rail) |
| Rail = universal entry | **Yes** |
| Long-form in one workspace | **Yes** (`objectives/[id]`) |
| `/terminal/ai` not duplicate | **Yes** (redirect) |
| AI removed from primary left nav | **Yes** → Objectives |
| Dual objective input removed | **Yes** (page gone) |
| Duplicate page-level global nav off by default | **Yes** |
| Shared objective draft state | **Yes** (context) |
| Same backend path | **Yes** |
| Rail not full report | **Yes** (compact + handoff) |
| Fixture labeling | **Yes** (chips) |
| Full a11y/Playwright/prod build matrix | **Partial** — manual + unit only |

See also: `AI_SURFACE_OWNERSHIP_MATRIX.md`, `NAVIGATION_NORMALIZATION_REPORT.md`.
