# Frontend ↔ Backend Wiring & Route Linking

**Canonical UX:** [CONTEXTUAL_AI_UX.md](./CONTEXTUAL_AI_UX.md)  
**Route registry (code):** `apps/web/src/lib/terminal-routes.ts`  
**Persona nav (code):** `packages/commerce-engine/src/workspace.ts` → `GET /api/v1/workspace`  
**Next redirects:** `apps/web/next.config.mjs`

---

## Shell

| UI | API |
|----|-----|
| Terminal layout | `GET /workspace`, connectors summary |
| Left nav | `ResolvedWorkspace.nav` (persona Focus / More) |
| Command bar | `GET /search` then `/workspace/navigate` |
| ⌘K palette | `commandPaletteEntries()` from `terminal-routes` + live search hits |
| AI Context Panel (sole AI chrome) | `POST /ai/operator/run` (+ `commerceCaseId`) |
| Case page | `GET /commerce/cases/:id/workspace` |
| Process board | `GET /commerce/process` |
| Connectors | `GET /ops/connectors/health` + fabric |
| Approvals | `GET/POST /approvals*` |
| Diagnostics | `GET /ops/diagnostics` (auth) |

## Client rules

- Always `credentials: 'include'`
- Never embed secrets in Next public env except non-secret public keys
- Surface API errors; never invent success
- Display fixture / dataMode honesty when present

---

## Should this route be linked?

| Link in… | Meaning |
|----------|---------|
| **Focus nav** | Primary work for the persona (Cases, Discover, etc.) |
| **More nav** | Secondary / platform / history |
| **⌘K / command** | Jump target (canonical list pages only) |
| **Related strip** | Optional procedure spine under page headers |
| **Deep link only** | Opened from lists/search/BO relations — **not** primary nav |
| **Redirect only** | Legacy URL; never nav or palette |

### Commerce spine — **yes, link**

| Path | Link? | Where | Notes |
|------|-------|--------|--------|
| `/terminal` | **Yes** | Focus (Discover), ⌘K, related | Product intake |
| `/terminal/process` | **Yes** | Focus (Cases), ⌘K, related | Primary orchestration |
| `/terminal/process/[caseId]` | Deep only | Cards, search, process board | Case hub |
| `/terminal/products/[productId]` | Deep only | Scanner, case twin, search | Product twin |
| `/terminal/tasks` | **Yes** | Focus/More by persona, ⌘K, related | Blockers |
| `/terminal/listings` | **Yes** | More / procedures, ⌘K, related | Listing BO list |
| `/terminal/orders` | **Yes** | Focus/More, ⌘K, related | Order BO list |
| `/terminal/fulfillment` | **Yes** | More / procedures, ⌘K | Shipments |
| `/terminal/approvals` | **Yes** | Focus/More, ⌘K, related | Human gates |
| `/terminal/opportunities` | **Yes** | More (not AI home), ⌘K, related | Opportunity BO list |
| `/terminal/watchlist` | **Yes** | More, ⌘K | Optional watch facet |

### Workspace — **yes, link**

| Path | Link? | Where |
|------|-------|--------|
| `/terminal/workspace` | **Yes** | Switch persona, ⌘K |
| `/terminal/workspace/[persona]` | **Yes** | Persona home (Focus “Home”), deep from switcher |

### Intelligence / finance / platform — **yes, link (secondary)**

| Path | Link? | Where |
|------|-------|--------|
| `/terminal/signals` | **Yes** | Analyst/researcher More, ⌘K |
| `/terminal/portfolio` | **Yes** | Executive/analyst, ⌘K |
| `/terminal/cashflow` | **Yes** | Executive, ⌘K |
| `/terminal/customers` | **Yes** | Analyst, ⌘K |
| `/terminal/finance/payments` | **Yes** | Finance More, ⌘K, related “Finance” |
| `/terminal/finance/payouts` | **Yes** | Finance, ⌘K |
| `/terminal/finance/reconciliation` | **Yes** | Finance hub, ⌘K, related |
| `/terminal/finance/disputes` | **Yes** | Finance, ⌘K |
| `/terminal/connectors` | **Yes** | Developer Focus/More, ⌘K |
| `/terminal/ecosystem` | **Yes** | Developer/ops More, ⌘K |
| `/terminal/automations` | **Yes** | Developer More, ⌘K |
| `/terminal/agency` | **Yes** | Admin More, ⌘K |
| `/terminal/live-examples` | **Yes** | More / Learn only, ⌘K — **not** Focus |

### AI — **link carefully**

| Path | Link? | Where | Notes |
|------|-------|--------|--------|
| AI Context Rail | **Yes** | Always chrome | Sole launch surface |
| `/terminal/objectives` | **Yes (secondary)** | More as “Run history”, ⌘K | **Not** Focus AI product |
| `/terminal/objectives/[id]` | Deep only | From history / rail “full result” | Run detail |
| `/terminal/ai` | **No** | Redirect only | → objectives (preserve query) |

### Legacy — **do not link**

| Path | Behavior | Link? |
|------|----------|--------|
| `/terminal/pipeline` | → `/terminal/process` | **No** |
| `/terminal/cockpit` | → `/terminal/workspace/executive` | **No** |
| `/terminal/control-tower` | → `/terminal/workspace/executive` | **No** |
| `/scanner` | → `/terminal` | **No** |
| `/terminal/finance` | → reconciliation | **No** |

---

## Consistency check (code)

| Check | Status |
|-------|--------|
| Every `page.tsx` under `app/terminal` has registry entry or is covered by legacy_redirect | **Yes** |
| Legacy routes redirect in page **and** `next.config.mjs` | **Yes** |
| Persona Focus/More hrefs are real terminal paths | **Yes** (workspace engine) |
| Detail routes (`case`, `product`, `objective id`) not in Focus as top-level apps | **Yes** |
| Command palette excludes `legacy_redirect` | **Yes** (`command: false`) |

---

## Recommended linking policy (summary)

1. **Link lists of BOs** (cases, products via Discover, orders, listings, approvals) — not feature names.  
2. **Deep-link details** from those lists and Search Manager hits.  
3. **Do not link** legacy cockpit/pipeline/control-tower/ai full-page.  
4. **AI:** open rail; link **run history** only under More.  
5. **Persona Home** should deep-link priority cases and Discover/Process — already preferred over old “AI” CTA.

---

## Matrix source

- Static registry: `apps/web/src/lib/terminal-routes.ts`  
- Live ops matrix (if enabled): `GET /api/v1/ops/wiring-matrix`  
- Historical docs: `docs/_archive/` (do not treat as current)
