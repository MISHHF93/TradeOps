# AI Surface Ownership Matrix

**Date:** 2026-07-19  
**Principle:** One workspace · one AI Operator rail · one objective history · one full-result workspace.

| Current surface | Previous responsibility | Duplicate with | Final responsibility | Final route/component | Action |
|-----------------|-------------------------|----------------|----------------------|----------------------|--------|
| Right `AiContextPanel` | Contextual operator + full long results | Center `/terminal/ai` console | **Global contextual assistant** — composer, progress, concise summary, top rec, handoff | Shell right rail `components/ai/ai-context-panel.tsx` | **Canonical** — compact density + Open full result |
| `/terminal/ai` full page + `AiOperatorConsole` | Full AI landing + second composer | Right rail | **Legacy** | Redirect → `/terminal/objectives` | **Redirect**; do not render console |
| `ai-side-panel` | Alternate strip operator | Right rail | **Legacy / unused** | `components/ai/ai-side-panel.tsx` | **Deprecate** (closed by default) |
| `/terminal/objectives` | Run history | Part of AI page history list | **Persistent history** | `app/terminal/objectives/page.tsx` | **Canonical** history only |
| `/terminal/objectives/[id]` | Full run detail | Rail long-form | **Detailed result workspace** | `app/terminal/objectives/[id]/page.tsx` | **Canonical** long-form |
| Left nav “AI” | Primary destination for operator | Right rail | **Removed** | Persona Focus uses **Objectives** | **Replaced** in `buildPersonaNav` |
| `ProcessRelatedLinks` global strip | Page-level global nav | Left sidebar | **Misplaced** as default | `TerminalPageFrame` | **Off by default** (`showRelatedNav=false`) |
| Objective textarea on AI page | Second composer | Rail composer | **Removed** with page redirect | — | **Eliminated** |
| SessionStorage full run dumps | Client “authority” | API `OperatorRun` | **Removed** earlier | Server `runId` only | **Correct** |
| Live examples | Guided demos | Objectives | **Dev utility** | `/terminal/live-examples` | **Keep** (More / developer) |
| Command palette “AI Operator” | Jump to `/terminal/ai` | Rail | Jump to **Objectives** history | `command-palette` / routes | **Updated** |
| Case “Run AI” links | Opened full AI page | Rail | Prefill via query → objectives + rail | Case/workspace CTAs → objectives | **Updated** |

## Canonical model

```text
Left rail     → business workspaces & procedures (no AI product page)
Center        → active business object / objective history / full result
Right rail    → AI Operator (always available)
```

| Need | Where |
|------|--------|
| Ask / run objective | Right rail |
| See long briefing, package, all recs | `/terminal/objectives/[id]` |
| Browse past runs | `/terminal/objectives` |
| Stage-aware case work | Case page + rail context (not a second AI app) |
