# Persona-driven operating workspaces

## Goal

TradeOps is a **Commerce Operating System**. Navigation is not a feature catalog.
Every page, sidebar item, AI prompt, and connector action belongs to a **persona**
and an **executable procedure**.

## Operating personas

| Persona | Mission |
|---------|---------|
| Executive | KPIs, risks, approvals, financial health, strategy |
| Operator | Prepare → publish → orders → fulfill → reconcile |
| Researcher | Discover → evaluate → score → recommend |
| Analyst | Signals, portfolio, customers, learn from outcomes |
| Developer | Connectors, workflows, diagnostics, live examples |
| Administrator | Org, access, audit, SaaS billing |

Legacy stored values (`founder`, `procurement`, `finance`, `agency`, `auditor`)
map into the six operating personas via `resolveOperatingPersona`.

## Workspace Resolver

`GET /api/v1/workspace`

Resolves:

* persona (from membership.workspacePersona)
* permissions / role
* organization
* current objective
* active Commerce Cases
* pending tasks / blockers / approvals
* connectors
* recommended next action
* **dynamic sidebar nav**
* **AI context preamble + allowed tools**

`POST /api/v1/workspace/persona` — switch persona (rebuilds nav + AI).

## Procedure engine

Defined in `packages/commerce-engine/src/workspace.ts`.

Each procedure has ordered steps (beginning → middle → completion criteria)
with hrefs into existing terminal routes. Process spine remains `CommerceCase`.

## Dynamic sidebar

`TerminalSidebar` renders `ResolvedWorkspace.nav` only — not a static module tree.
Next-action card sits above the nav.

## AI context

`AiOperatorService.runObjective` prepends `aiContextPreamble` from the resolver
so the model knows who the user is, which workspace is active, open cases, and
which tools are in-persona.

## Route consolidation

| Route | Action |
|-------|--------|
| `/scanner` | redirect → `/terminal` |
| `/terminal/pipeline` | redirect → `/terminal/process` |
| `/signup` | prefer `/register` |
| `/capital/*`, `/network/*` | gated / non-default ops (not in persona nav) |
| Feature silos (signals, listings, …) | kept as **procedure steps**, not top-level feature menus |

## Inventory snapshot (app routes)

**Public:** `/`, product, pricing, docs, tools, status, legal, auth.

**Terminal (operational):** workspace hubs, process, tasks, discover, opportunities,
listings, approvals, orders, fulfillment, finance/*, portfolio, cashflow, customers,
watchlist, signals, ai, connectors, automations, objectives, live-examples, ecosystem,
agency, cockpit, control-tower, products/[id].

**Admin:** `/app`, `/app/billing`, onboarding, platform/plans.

Every operational route is owned by at least one persona procedure.

## Files

* `packages/commerce-engine/src/workspace.ts` — pure model + resolver
* `apps/api/src/commerce/workspace.service.ts` — DB-backed resolver
* `apps/web/src/app/terminal/workspace/**` — persona switchboard + homes
* `apps/web/src/components/navigation/terminal-sidebar.tsx` — dynamic nav
* `apps/api/src/ai/ai-operator.service.ts` — workspace preamble injection
