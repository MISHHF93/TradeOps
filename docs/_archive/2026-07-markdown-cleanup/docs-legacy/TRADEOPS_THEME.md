# TradeOps Theme (Midnight Exchange)

**Source blueprint:** [`theme.md`](../theme.md)  
**Visual tokens:** `apps/web/src/app/globals.css`  
**Shell:** `apps/web/src/components/layout/terminal-shell.tsx`

## Application shell (§8)

```text
┌────────────────────────────────────────────────────────────┐
│ Command bar (logo · search · commands · env · theme)       │
├──────────────┬─────────────────────────────┬───────────────┤
│ Sidebar      │ Main workspace              │ AI context    │
│ Operate      │                             │ panel         │
│ Intelligence │                             │ (collapsible) │
│ Network      │                             │               │
│ Automate     │                             │               │
│ Govern       │                             │               │
└──────────────┴─────────────────────────────┴───────────────┘
```

| Piece | Path |
|-------|------|
| Command bar | `components/layout/command-bar.tsx` |
| Terminal shell | `components/layout/terminal-shell.tsx` |
| Grouped sidebar | `components/navigation/terminal-sidebar.tsx` |
| Nav groups data | `lib/nav-groups.ts` |
| AI context panel | `components/ai/ai-context-panel.tsx` |

## Component architecture (§22)

```text
apps/web/src/components/
  primitives/     status-badge
  navigation/     public-site-nav, founder-menu, terminal-sidebar
  data-display/   public-tools
  forms/          auth, onboarding, org-switcher, agency
  tables/         scanner-table
  charts/         (placeholder for future)
  terminal/       actions, demo-loop, pipeline, orders
  ai/             operator console, side panel, context panel
  workflows/      weekend-google-actions
  connectors/     (placeholder)
  commerce/       money, signal-badge, freshness-badge, watchlist-button
  feedback/       founder-access-banner, ga4
  layout/         theme-toggle, command-bar, terminal-shell
```

Root-level files under `components/*.tsx` re-export for stable import paths.

## Design tokens

- Dark (default) + light (`data-theme`)
- Compact / comfortable density (`data-density`)
- **Interactive accent:** official cyan `#25C7E8` — intelligence/AI/focus only (never profit/loss)
- Semantic colors remain separate for positive / negative / warning / blocked
- See [TRADEOPS_ACCENT_SYSTEM.md](./TRADEOPS_ACCENT_SYSTEM.md)
- Fluid type + gutters: `clamp()` / `min()` for viewport reflow
- Cards/grids use `minmax(min(100%, …), 1fr)`; tables scroll horizontally on narrow screens

## Route aliases

| Blueprint | Implementation |
|-----------|----------------|
| `/terminal` homepage | `/terminal/cockpit` (command center) |
| `/scanner` | redirect → `/terminal` |
| Products list | scanner rows + product detail |
| Workflows | `/terminal/automations` |
| AI | `/terminal/ai` + docked panel |

## Remaining blueprint depth

- Full command palette (⌘K) with fuzzy search  
- Sidebar collapse to 64px icon mode  
- Resizable AI panel width  
- charts/ + connectors/ component libraries  
- Full table column manager / saved views  
