# TradeOps Accent System — Midnight Exchange

**Official primary accent (interaction / intelligence only):**

```css
--color-accent: #25C7E8;
--color-accent-hover: #4DD4EE;
--color-accent-active: #11AFCF;
--color-accent-subtle: rgba(37,199,232,.12);
--color-accent-border: rgba(37,199,232,.35);
```

## What accent means

| Means | Does **not** mean |
|-------|-------------------|
| Intelligence, AI, focus | Profit |
| Selection, navigation | Loss |
| Command execution | Success/failure outcomes |
| Connector linkage | Warning (use amber) |
| Workflow path / progress | Policy block (use purple) |

## Semantic colors (outcomes)

| Token | Role |
|-------|------|
| `--color-positive` `#42D392` | Verified positive business outcomes |
| `--color-negative` `#FF6B74` | Loss, failure, rejection |
| `--color-warning` `#F3B94A` | Attention, waiting |
| `--color-info` `#6EA8FE` | Neutral information |
| `--color-blocked` `#A78BFA` | Policy / governance blocks |

## Rules (professor mode)

| Rule | Application |
|------|-------------|
| Panels stay neutral | Cards/surfaces use surface tokens only |
| Tables | Accent on hover surface + **selected left border only** — no full-row cyan wash |
| Buttons | Primary accent · secondary neutral+hover accent border · ghost accent text on hover · destructive red · approve green |
| Connectors | Neutral card + small accent dot when connected; sync = accent line; fail/expire = semantic |
| Workflows | AI nodes accent; approvals green; failures red; blocked purple; active edges accent |
| Charts | Primary series = accent; profit green; loss red; forecast accent transparency |
| Command palette | Centerpiece: accent caret, match highlight, selected item left border |
| Accessibility | Label + border + icon/status text; `prefers-reduced-motion` |

## Where it is wired

- Tokens + button/table/nav/AI/connector/chart/palette CSS: `apps/web/src/app/globals.css`  
- AI states: `components/ai/ai-context-panel.tsx`  
- Command palette: `components/layout/command-palette.tsx` (Ctrl/Cmd+K)  
- Connectors: `components/connectors/connector-status.tsx` + connectors page cards  
- Blueprint: `theme.md`
