# Navigation Normalization Report

**Date:** 2026-07-19

## Problem

Three competing navigation layers:

1. Left persona Focus / More  
2. Central `ProcessRelatedLinks` (Home / Discover / … / AI Operator)  
3. Right AI rail (correct persistent AI)

Plus `/terminal/ai` as a fourth “AI product” destination.

## Changes

### Left Focus (commerce-engine `PERSONA_PRIMARY_NAV`)

| Persona | Before (AI slot) | After |
|---------|------------------|--------|
| All personas | `AI` → `/terminal/ai` | **`Objectives`** → `/terminal/objectives` |

AI Operator is **not** a left-nav product; the rail is always available.

### Fallbacks

- `apps/web` `nav-groups.ts`, `persona-nav.ts`, `terminal-sidebar` FALLBACK_NAV aligned.

### Routes

| Path | Kind | Behavior |
|------|------|----------|
| `/terminal/objectives` | canonical | History |
| `/terminal/objectives/[id]` | detail | Full workspace |
| `/terminal/ai` | legacy_redirect | → `/terminal/objectives` (`next.config.mjs` + page redirect) |

### Central related strip

- `TerminalPageFrame` now defaults **`showRelatedNav={false}`** so pages no longer re-render global destinations under the title.
- Stage strip remains opt-in via `showStageStrip` for true process context.

### Command / deep links

- Palette and case CTAs point at **Objectives** (or stay on page + use rail), not a second AI console.

## What remains intentional

- **More** menus still list role-specific resources (finance, connectors, etc.).
- **Lifecycle stage strip** on process-aware pages (contextual, not global nav).
- **Command bar** search for jump navigation.

## Verification

- `commerce-engine` tests updated and **passing** (Focus labels = Objectives, not AI).
- No primary nav item labeled solely “AI”.
