# TradeOps Theme Blueprint
## Visual System, Interaction Language, and Implementation Standard

**Product:** TradeOps  
**Category:** AI-powered multichannel commerce operating system  
**Primary Positioning:** *The AI Command Center for Global Commerce*  
**Experience Goal:** A professional commerce trading terminal that remains understandable for individual sellers, scalable for teams, and credible for enterprise customers.

---

# 1. Design Vision

TradeOps must feel like a modern institutional trading terminal redesigned for physical commerce.

It should combine:

- the density and decisiveness of a financial operations terminal;
- the clarity of a modern SaaS product;
- the control of an enterprise command center;
- the speed of a developer tool;
- the intelligence of an AI-native operating system.

The interface must communicate:

- control;
- precision;
- movement;
- operational confidence;
- measurable opportunity;
- disciplined risk management;
- real-time awareness.

TradeOps must not look like:

- a generic Shopify template;
- a card-heavy admin dashboard;
- a crypto casino;
- a neon gaming interface;
- a decorative AI concept;
- an unfinished developer console;
- a conventional dropshipping website.

---

# 2. Core Design Principles

## 2.1 Intelligence Before Decoration

Every visible element must help the user:

- understand;
- decide;
- compare;
- execute;
- monitor;
- investigate.

Avoid decoration that does not improve comprehension.

## 2.2 Dense, Not Crowded

TradeOps should support large amounts of information while preserving hierarchy.

Use:

- compact tables;
- grouped controls;
- progressive disclosure;
- contextual drawers;
- expandable detail rows;
- persistent filters;
- clear status systems.

Do not solve density by hiding everything across excessive pages.

## 2.3 One Canonical Workspace

All modules should feel like parts of one operating system.

Do not create visually unrelated pages for:

- products;
- suppliers;
- listings;
- orders;
- AI;
- workflows;
- cash flow.

Use shared structure, tokens, controls, and interaction patterns.

## 2.4 Signals Must Be Explainable

BUY, SELL, HOLD, SCALE, REDUCE, EXIT, and BLOCKED states must never appear without supporting evidence.

Every signal should expose:

- score;
- confidence;
- reason;
- risk;
- freshness;
- next action.

## 2.5 AI Must Feel Operational

The AI should not appear as a floating novelty chatbot.

It should function as:

- operator;
- analyst;
- workflow composer;
- investigator;
- auditor;
- execution assistant.

Its interface must expose plans, tools, evidence, actions, approvals, and outcomes.

## 2.6 Safe Execution

The design must clearly distinguish:

- analysis;
- draft;
- approval required;
- executing;
- completed;
- failed;
- blocked.

Users must always know whether TradeOps is suggesting an action or performing one.

---

# 3. Brand Foundation

## 3.1 Brand Name

# TradeOps

Use the name as one word with capital **T** and **O**.

Correct:

- TradeOps
- TradeOps AI
- TradeOps Terminal
- TradeOps Commerce OS

Avoid:

- Trade Ops
- tradeops
- TRADE OPS

Uppercase `TRADEOPS` may be used sparingly for terminal labels or technical identifiers.

## 3.2 Tagline

Primary:

> **The AI Command Center for Global Commerce**

Secondary:

> **One system for products, channels, suppliers, workflows, and cash flow.**

Short interface tagline:

> **Discover. Decide. Execute.**

## 3.3 Brand Personality

TradeOps should feel:

- intelligent;
- disciplined;
- technical;
- premium;
- global;
- operational;
- trustworthy;
- fast.

It should not feel:

- playful;
- childish;
- speculative;
- overhyped;
- chaotic;
- excessively futuristic.

---

# 4. Visual Direction

## 4.1 Theme Name

**Midnight Exchange**

A dark-first operational theme inspired by global trading systems, logistics control rooms, enterprise intelligence software, and modern developer tooling.

## 4.2 Core Appearance

- Near-black foundation.
- Deep graphite surfaces.
- Cool steel borders.
- Electric cyan (`#25C7E8`) as the primary interactive accent — intelligence, AI, focus, selection (never profit/loss).
- Controlled semantic colors for profit, warning, loss, and information.
- White and cool-gray text.
- Minimal glow.
- No gradients on operational cards.
- No glassmorphism.
- No oversized shadows.
- No decorative blur behind data.

## 4.3 Light Theme

Create a light theme for enterprise and daylight usage, but design dark mode first.

The light theme should preserve:

- hierarchy;
- compactness;
- semantic colors;
- border contrast;
- chart readability.

Do not simply invert the dark palette.

---

# 5. Color System

All colors must be implemented as semantic CSS variables.

## 5.1 Dark Theme Tokens

```css
:root,
[data-theme="dark"] {
  --color-canvas: #070A0F;
  --color-sidebar: #090D14;
  --color-surface-1: #0D121B;
  --color-surface-2: #111824;
  --color-surface-3: #17202D;
  --color-surface-hover: #1B2635;
  --color-surface-active: #202D3E;

  --color-border-subtle: #1D2836;
  --color-border-default: #2A3747;
  --color-border-strong: #3B4A5D;

  --color-text-primary: #F4F7FB;
  --color-text-secondary: #B7C1CF;
  --color-text-tertiary: #7F8B9B;
  --color-text-disabled: #536071;
  --color-text-inverse: #071018;

  --color-accent: #25C7E8;
  --color-accent-hover: #4DD4EE;
  --color-accent-active: #11AFCF;
  --color-accent-subtle: rgba(37, 199, 232, 0.12);
  --color-accent-border: rgba(37, 199, 232, 0.35);

  --color-positive: #42D392;
  --color-positive-subtle: rgba(66, 211, 146, 0.12);
  --color-warning: #F3B94A;
  --color-warning-subtle: rgba(243, 185, 74, 0.12);
  --color-negative: #FF6B74;
  --color-negative-subtle: rgba(255, 107, 116, 0.12);
  --color-info: #6EA8FE;
  --color-info-subtle: rgba(110, 168, 254, 0.12);
  --color-neutral: #9AA6B6;

  --color-buy: #42D392;
  --color-sell: #25C7E8;
  --color-hold: #F3B94A;
  --color-scale: #70E1B1;
  --color-reduce: #F39C5A;
  --color-exit: #FF6B74;
  --color-blocked: #A78BFA;
}
```

## 5.2 Light Theme Tokens

```css
[data-theme="light"] {
  --color-canvas: #F4F7FA;
  --color-sidebar: #FFFFFF;
  --color-surface-1: #FFFFFF;
  --color-surface-2: #F8FAFC;
  --color-surface-3: #EEF3F7;
  --color-surface-hover: #E9F0F5;
  --color-surface-active: #DDE8EF;

  --color-border-subtle: #E1E8EF;
  --color-border-default: #CAD5DF;
  --color-border-strong: #AAB8C6;

  --color-text-primary: #111827;
  --color-text-secondary: #465365;
  --color-text-tertiary: #6F7D8D;
  --color-text-disabled: #A0AAB7;
  --color-text-inverse: #F8FBFD;

  --color-accent: #0AA2C2;
  --color-accent-hover: #25C7E8;
  --color-accent-active: #078CA8;
  --color-accent-subtle: rgba(10, 162, 194, 0.12);
  --color-accent-border: rgba(10, 162, 194, 0.35);

  --color-positive: #178A5B;
  --color-positive-subtle: rgba(23, 138, 91, 0.10);
  --color-warning: #B7791F;
  --color-warning-subtle: rgba(183, 121, 31, 0.10);
  --color-negative: #C53A45;
  --color-negative-subtle: rgba(197, 58, 69, 0.10);
  --color-info: #326FC7;
  --color-info-subtle: rgba(50, 111, 199, 0.10);
  --color-neutral: #64748B;
}
```

## 5.3 Color Rules

- Accent cyan indicates interaction, selection, active focus, AI, and intelligence — never profit or loss.
- Green indicates verified positive business outcomes.
- Red indicates loss, failure, rejection, or destructive action.
- Amber indicates uncertainty, waiting, or attention.
- Purple indicates policy blocks, governance, or exceptional restrictions.
- Never use green merely because an action is clickable.
- Never use red for routine “sell” signals; SELL is a commerce action, not necessarily a negative outcome.
- Pair colors with labels and icons.
- Never rely on color alone.

## 5.4 Accent application matrix

Accent is the **language of intelligence and interaction**. It must never be decorative.

| Surface | Accent role | Semantic role |
| --- | --- | --- |
| Nav / tabs / filters | Active selection, focus rail | — |
| Inputs / keyboard focus | Focus ring, caret, active border | Validation errors → negative |
| Primary / AI buttons | Execute / command | Destructive → negative; approve → positive |
| Command palette | Cursor, match highlight, active row | — |
| Tables | Selected row left rail, sort active | Profit / margin → positive/negative |
| AI Operator | Avatar, typing, progress, tool chips, timeline, suggestions | Auditor OK/fail → positive/negative; blocked → purple |
| Workflows | AI nodes, active edges, execution progress | Approval green; failure red; blocked purple |
| Connectors | Connected / syncing indicator | Expired warning; failed negative |
| Charts | Focus series / confidence band | Profit series green; loss series red |
| Confidence meters | Intelligence confidence fill | — |
| Page / card backgrounds | **Never fill with accent** | Neutral surfaces only |

Tokens (dark):

```css
--color-accent: #25C7E8;
--color-accent-hover: #4DD4EE;
--color-accent-active: #11AFCF;
--color-accent-subtle: rgba(37,199,232,.12);
--color-accent-border: rgba(37,199,232,.35);

--color-positive: #42D392;
--color-negative: #FF6B74;
--color-warning: #F3B94A;
--color-info: #6EA8FE;
--color-blocked: #A78BFA;
```

Implementation lives in `apps/web/src/app/globals.css` (token root + ACCENT SYSTEM section) and component classes (`ai-*`, `cmd-palette-*`, `wf-*`, `conn-*`, `filter-chip`, `tabs` / `.tab`).

**Single source of truth:** CSS custom properties on `:root` / `[data-theme]` via `globals.css` + `ThemeToggle` (`data-theme`). No duplicate color systems.

### Implementation status (§§5–15)

| § | Area | Status |
| --- | --- | --- |
| 4 | AI idle / thinking / executing / awaiting_approval | Implemented (`data-ai-state`, pulse, progress, accent+amber) |
| 5 | Terminal operational accents | Command bar, workspace title, kbd, connectors |
| 6 | Tables interaction-only accent | Hover, select rail, sort, filter chips, compare |
| 7 | Button system | primary / secondary / ghost / destructive / approval / ai |
| 8 | Connectors | Neutral card + status dots; sync line; semantic expired/failed |
| 9 | Workflows | `wf-node-*` + `wf-edge-*` |
| 10 | Product signals | Label + role text; SELL ≠ loss |
| 11 | Charts | Token series + legend/sparkline primitives |
| 12 | Command palette | Accent cursor / match / selection |
| 13 | Micro-interactions | 120–180ms (`--transition-fast` 140ms) |
| 14 | Accessibility | Labels, borders, reduced-motion, focus-visible |
| 15 | Order | Tokens → components; rebuild web after CSS changes |

---

# 6. Typography

## 6.1 Font Strategy

Use a dual-font system.

### Interface Font

Preferred:

- Inter
- Geist Sans
- IBM Plex Sans

Use for:

- navigation;
- headings;
- labels;
- controls;
- descriptions;
- AI conversation;
- public website.

### Data Font

Preferred:

- IBM Plex Mono
- Geist Mono
- JetBrains Mono

Use for:

- prices;
- percentages;
- IDs;
- SKUs;
- timestamps;
- quantities;
- calculated scores;
- API and connector data;
- code and logs.

## 6.2 Type Scale

```css
--font-size-xs: 0.75rem;
--font-size-sm: 0.8125rem;
--font-size-base: 0.875rem;
--font-size-md: 1rem;
--font-size-lg: 1.125rem;
--font-size-xl: 1.375rem;
--font-size-2xl: 1.75rem;
--font-size-3xl: 2.25rem;
```

Operational application body text should default to `14px`.

Public marketing pages may use `16px` body text.

## 6.3 Weight Rules

- 400: body and supporting content.
- 500: labels and navigation.
- 600: important headings and totals.
- 700: rare marketing emphasis only.

Avoid ultra-bold interface text.

## 6.4 Number Formatting

Use tabular numbers for:

- money;
- percentages;
- quantities;
- scores;
- timestamps.

Examples:

```text
$12,840.50
+18.4%
74 / 100
12d 4h
```

Always include currency context where ambiguity exists.

---

# 7. Spacing and Geometry

## 7.1 Base Spacing Scale

Use a 4px base unit.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

## 7.2 Border Radius

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-pill: 999px;
```

Use:

- 6px for dense controls and badges.
- 8px for inputs, buttons, and compact panels.
- 12px for primary workspace panels.
- 16px only for public website sections or large dialogs.

Avoid excessively rounded “bubble” interfaces.

## 7.3 Borders

Operational hierarchy should rely more on borders and surface shifts than shadows.

```css
--border-width-default: 1px;
--border-width-emphasis: 2px;
```

## 7.4 Shadows

Use only for:

- floating menus;
- drawers;
- modals;
- command palette;
- AI overlay.

Do not use shadows on every dashboard panel.

---

# 8. Application Shell

## 8.1 Desktop Structure

```text
┌─────────────────────────────────────────────────────────────────┐
│ Global Command Bar                                              │
├──────────────┬───────────────────────────────────────┬──────────┤
│ Navigation   │ Main Workspace                        │ AI /     │
│ Sidebar      │                                       │ Context  │
│              │                                       │ Panel    │
└──────────────┴───────────────────────────────────────┴──────────┘
```

Recommended dimensions:

- Left sidebar: 232px expanded.
- Left sidebar: 64px collapsed.
- Right AI panel: 360–440px.
- Top command bar: 52px.
- Workspace gutters: 16–24px.

## 8.2 Global Command Bar

Must include:

- TradeOps logo or symbol;
- global search;
- command launcher;
- environment indicator;
- connector health summary;
- active workflow indicator;
- notification center;
- theme control;
- founder workspace menu.

## 8.3 Sidebar Navigation

Primary groups:

### Operate

- Terminal
- Scanner
- Watchlist
- Products
- Listings
- Orders
- Fulfillment

### Intelligence

- Predictions
- Trends
- Reviews
- Pricing
- Portfolio
- Cash Flow

### Network

- Suppliers
- Channels
- Connectors
- Customers

### Automate

- AI Workspace
- Workflows
- Approvals
- Agent Activity

### Govern

- Risk
- Audit
- System
- Settings

Rules:

- Use concise labels.
- Limit top-level visible items.
- Group less-used modules.
- Preserve selected state.
- Display small status counts only when meaningful.
- Avoid nesting deeper than two levels.

## 8.4 Context Panel

The right panel must adapt to the current page.

It may display:

- AI Operator;
- selected product;
- action history;
- risk explanation;
- workflow state;
- approval evidence;
- connector diagnostics.

It should be collapsible and resizable.

---

# 9. Primary Workspace Patterns

## 9.1 Terminal

The Terminal is the homepage.

It must answer:

- What requires attention?
- What opportunities are rising?
- What is currently executing?
- Where is cash at risk?
- Which connectors are unhealthy?
- What should the founder do next?

Recommended structure:

1. Command summary.
2. Capital and cash state.
3. Active opportunities.
4. Operational exceptions.
5. Workflow activity.
6. AI recommendations.
7. Recent execution history.

Avoid a generic grid of unrelated cards.

## 9.2 Market Scanner

Use a professional data table as the primary interface.

Required features:

- column selection;
- saved views;
- filter builder;
- sorting;
- row pinning;
- comparison mode;
- bulk selection;
- freshness indicator;
- source indicator;
- confidence indicator;
- expandable detail rows.

Default columns:

- product;
- signal;
- opportunity score;
- confidence;
- source cost;
- target price;
- expected profit;
- margin;
- demand;
- competition;
- shipping;
- supplier;
- risk;
- freshness.

## 9.3 Product Digital Twin

Use a split workspace:

- left: product identity and media;
- center: performance, offers, forecasts, listings;
- right: AI explanation and actions.

Tabs:

- Overview
- Offers
- Channels
- Reviews
- Forecast
- Pricing
- History
- Compliance
- Activity

## 9.4 Workflow Builder

Use a vertical or horizontal flow canvas with clearly typed nodes.

Node categories:

- Trigger
- Data
- Condition
- AI
- Action
- Approval
- Wait
- Notification
- Evaluation

Every node must show:

- status;
- connector;
- risk level;
- required permissions;
- last execution result.

## 9.5 Approval Queue

Each approval item must display:

- requested action;
- requesting agent or workflow;
- financial impact;
- policy risk;
- confidence;
- evidence;
- reversibility;
- expiration;
- approve;
- reject;
- modify.

Never use a one-click approval without context.

---

# 10. Component Blueprint

## 10.1 Buttons

### Primary

Use for the main action in a local context.

Examples:

- Create Workflow
- Approve Action
- Publish Listing

### Secondary

Use for supporting actions.

### Ghost

Use for lightweight navigation and tool actions.

### Destructive

Use for irreversible or harmful operations.

### AI Action

Use accent styling plus an intelligence icon, but follow normal button geometry.

Button sizes:

- Compact: 28–30px height.
- Default: 34–36px height.
- Large: 40–44px height.

## 10.2 Inputs

Inputs should:

- use clear labels;
- expose units;
- show validation immediately;
- support keyboard navigation;
- include source or freshness metadata where relevant.

Do not rely solely on placeholder text.

## 10.3 Status Badges

Badges must use controlled semantics:

- Connected
- Degraded
- Expired
- Approval Required
- Running
- Completed
- Failed
- Stale
- Live
- Shadow
- Draft

## 10.4 Signal Badges

Signals:

- BUY
- SELL
- HOLD
- SCALE
- REDUCE
- EXIT
- BLOCKED

Every signal badge should be selectable to reveal its explanation.

## 10.5 Tables

Tables must support:

- sticky headers;
- compact and comfortable density;
- row selection;
- keyboard navigation;
- column resizing;
- empty states;
- loading states;
- partial failure states.

Use monospace for numeric values.

Align:

- text left;
- numeric values right;
- status center or left depending on density.

## 10.6 Charts

Charts must answer a specific question.

Approved chart types:

- line charts for time series;
- bar charts for comparisons;
- stacked bars for composition;
- waterfall charts for profit decomposition;
- heat maps for channel or time performance;
- scatter plots for risk versus return;
- forecast bands for predictive ranges;
- funnel charts only for real stage conversion.

Avoid:

- decorative pie charts;
- 3D charts;
- unlabeled sparkline overload;
- multiple unrelated colors;
- charts without units or source dates.

## 10.7 Panels

Panel structure:

- title;
- optional subtitle;
- status or action area;
- content;
- optional footer metadata.

Do not nest cards inside cards.

## 10.8 Modals and Drawers

Use drawers for:

- record details;
- AI evidence;
- connector setup;
- workflow logs.

Use modals for:

- approval;
- destructive confirmation;
- focused configuration;
- credential entry.

Do not use full-screen modals unless the workflow genuinely requires isolation.

---

# 11. AI Interaction Blueprint

## 11.1 AI Operator Surfaces

The AI must exist in four forms:

1. Persistent side panel.
2. Dedicated AI Workspace.
3. Contextual inline recommendations.
4. Command palette actions.

## 11.2 AI Response Structure

Operational AI responses should use:

- Objective
- Findings
- Evidence
- Recommendation
- Confidence
- Risks
- Proposed Actions
- Approval Requirements
- Outcome Tracking

## 11.3 AI Execution States

```text
Understanding
Planning
Collecting Evidence
Evaluating
Critiquing
Auditing
Waiting for Approval
Executing
Verifying
Completed
Failed
Blocked
```

Show the current state visually.

## 11.4 AI Action Cards

Each AI-proposed action must show:

- action title;
- target record;
- connector;
- expected impact;
- risk;
- confidence;
- evidence count;
- approval status;
- execution status.

## 11.5 AI Transparency

Users must be able to inspect:

- tools used;
- data sources;
- calculation trace;
- model version;
- prompt or workflow version;
- missing data;
- errors;
- human overrides.

Do not expose hidden chain-of-thought. Present concise operational reasoning and evidence.

---

# 12. Motion and Feedback

## 12.1 Motion Philosophy

Motion should communicate state change, not entertainment.

Use:

- 120–180ms for hover and focus.
- 180–240ms for panels and menus.
- 240–320ms for drawers and page transitions.

## 12.2 Approved Motion

- subtle fade;
- short slide;
- progress animation;
- row highlight;
- status pulse for active execution;
- skeleton loading.

## 12.3 Avoid

- bouncing;
- continuous glow;
- spinning decorative objects;
- animated gradients;
- excessive parallax;
- slow transitions.

Respect `prefers-reduced-motion`.

---

# 13. Responsive Blueprint

## 13.1 Desktop

Full terminal experience with:

- left navigation;
- central workspace;
- optional AI panel;
- dense tables.

## 13.2 Tablet

- collapsible sidebar;
- AI panel becomes drawer;
- reduced table columns;
- persistent filter access;
- touch-friendly controls.

## 13.3 Mobile

Mobile should be an operational companion, not a compressed desktop terminal.

Prioritize:

- alerts;
- approvals;
- orders;
- connector health;
- AI commands;
- cash summary;
- workflow status.

Do not attempt to display every scanner column on mobile.

Use:

- stacked records;
- summary rows;
- detail drawers;
- bottom navigation for core actions.

---

# 14. Accessibility

TradeOps must meet WCAG 2.2 AA targets.

Requirements:

- keyboard access;
- visible focus;
- semantic landmarks;
- accessible names;
- high contrast;
- non-color status indicators;
- screen-reader table labels;
- chart summaries;
- reduced-motion support;
- minimum target sizes;
- form error association;
- live-region announcements for execution state.

Do not use low-contrast gray text for essential information.

---

# 15. Iconography

Use one consistent line-icon family.

Recommended:

- Lucide
- Phosphor
- Heroicons Outline

Rules:

- 16px for dense controls.
- 18–20px for navigation.
- 20–24px for empty states.
- Avoid mixing icon families.
- Pair unfamiliar icons with labels.
- Do not use emoji as primary interface icons.

Suggested semantic icons:

- Terminal: command square
- Scanner: radar or search
- Products: package
- Suppliers: factory or network
- Orders: receipt
- Fulfillment: truck
- Portfolio: briefcase
- Cash Flow: wallet
- AI: sparkles or neural symbol
- Workflows: route
- Approvals: shield check
- Connectors: plug
- Risk: shield alert
- System: activity

---

# 16. Public Website Theme

The public website should use the same design language with more breathing room.

## Hero

Headline:

> **Operate Every Commerce Channel From One Intelligent System**

Supporting copy:

> TradeOps connects products, suppliers, marketplaces, workflows, and cash flow so sellers and commerce teams can discover opportunities, automate operations, and measure real profitability.

Primary CTA:

- Open TradeOps

Secondary CTA:

- Explore the Platform

Since Direct Founder Access Mode is active, do not show signup or login actions.

## Public Sections

- Commerce Control Tower
- Predictive Product Intelligence
- Multichannel Operations
- Supplier and Procurement Intelligence
- AI Workflow Automation
- Cash Flow and Portfolio Risk
- Connector Ecosystem
- Individual, SMB, Agency, and Enterprise Solutions
- Security and Governance
- Product Roadmap

## Public Visual Style

- dark hero;
- precise product screenshots;
- structured diagrams;
- controlled accent use;
- no generic stock photos;
- no exaggerated profit claims;
- no crypto-style visual language.

---

# 17. Information Density Modes

Support two density settings:

## Compact

Best for:

- scanner;
- orders;
- logs;
- connector activity;
- expert users.

## Comfortable

Best for:

- onboarding;
- public screens;
- product detail;
- less technical users.

Persist density preference locally or per founder workspace.

---

# 18. Empty, Loading, and Error States

## Empty States

Every empty state must explain:

- what is missing;
- why it matters;
- what action to take.

Example:

> No supplier connectors are active. Connect an authorized supplier source to begin importing product offers.

## Loading States

Use:

- skeleton tables;
- progressive data arrival;
- explicit connector status;
- visible refresh timestamps.

Do not freeze the entire workspace when one connector is slow.

## Error States

Show:

- what failed;
- which connector or workflow failed;
- whether retry is safe;
- last successful state;
- suggested recovery action;
- diagnostic reference.

Never show raw stack traces to ordinary users.

---

# 19. Trust and Truthfulness Rules

TradeOps must visually distinguish:

- live data;
- delayed data;
- stale data;
- estimated data;
- predicted data;
- user-entered data;
- unavailable data.

Recommended labels:

- LIVE
- UPDATED 2M AGO
- STALE
- ESTIMATE
- FORECAST
- MANUAL
- UNAVAILABLE

Do not show fake real-time indicators.

Do not show a success state until external execution is confirmed.

---

# 20. Design Tokens

```css
:root {
  --font-interface: "Inter", "Geist Sans", system-ui, sans-serif;
  --font-data: "IBM Plex Mono", "Geist Mono", monospace;

  --font-size-xs: 0.75rem;
  --font-size-sm: 0.8125rem;
  --font-size-base: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.375rem;
  --font-size-2xl: 1.75rem;
  --font-size-3xl: 2.25rem;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 999px;

  --sidebar-expanded: 232px;
  --sidebar-collapsed: 64px;
  --topbar-height: 52px;
  --ai-panel-width: 400px;

  --transition-fast: 140ms ease;
  --transition-default: 200ms ease;
  --transition-panel: 280ms ease;
}
```

---

# 21. Tailwind Theme Mapping

Map semantic tokens into Tailwind instead of hardcoding colors throughout components.

Example:

```ts
const colors = {
  canvas: "var(--color-canvas)",
  sidebar: "var(--color-sidebar)",
  surface: {
    1: "var(--color-surface-1)",
    2: "var(--color-surface-2)",
    3: "var(--color-surface-3)",
    hover: "var(--color-surface-hover)",
    active: "var(--color-surface-active)",
  },
  border: {
    subtle: "var(--color-border-subtle)",
    DEFAULT: "var(--color-border-default)",
    strong: "var(--color-border-strong)",
  },
  content: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    tertiary: "var(--color-text-tertiary)",
    disabled: "var(--color-text-disabled)",
  },
  accent: {
    DEFAULT: "var(--color-accent)",
    hover: "var(--color-accent-hover)",
    active: "var(--color-accent-active)",
    subtle: "var(--color-accent-subtle)",
  },
  positive: "var(--color-positive)",
  warning: "var(--color-warning)",
  negative: "var(--color-negative)",
  info: "var(--color-info)",
};
```

Do not use arbitrary Tailwind colors inside operational components unless mapped to semantic design tokens.

---

# 22. Component Architecture

Recommended component layers:

```text
/components
  /primitives
  /navigation
  /data-display
  /forms
  /tables
  /charts
  /terminal
  /ai
  /workflows
  /connectors
  /commerce
  /feedback
  /layout
```

## Primitive Components

- Button
- IconButton
- Input
- Select
- Checkbox
- Switch
- Badge
- Tooltip
- Popover
- Dialog
- Drawer
- Tabs
- CommandMenu
- Divider
- Skeleton

## Commerce Components

- Money
- Margin
- OpportunityScore
- ConfidenceIndicator
- SignalBadge
- FreshnessBadge
- ConnectorBadge
- SupplierScore
- LandedCostBreakdown
- ProfitWaterfall
- ProductIdentity
- ListingStatus
- OrderLifecycle
- CashExposure
- ApprovalSummary

## AI Components

- AICommandInput
- AIPlan
- AIToolCall
- AIEvidence
- AIActionProposal
- AICriticResult
- AIAuditorResult
- AIExecutionTimeline
- AIOutcomeEvaluation

---

# 23. Page Blueprint

## `/terminal`

- Command summary
- Cash position
- Opportunity feed
- Exceptions
- Active workflows
- AI recommendations
- Approval backlog
- Connector health

## `/scanner`

- Filter bar
- Saved views
- Opportunity table
- Compare drawer
- AI scan command

## `/products`

- Product catalog
- Identity status
- Digital twin completeness
- Listing coverage
- Supplier coverage

## `/products/[id]`

- Product twin
- Offers
- Channels
- Forecast
- Reviews
- Pricing
- Compliance
- Activity

## `/orders`

- Unified order table
- Lifecycle status
- Margin status
- fulfillment status
- exception filters

## `/workflows`

- Workflow library
- Active workflows
- Execution history
- Builder
- Version history

## `/ai`

- Conversation
- objectives
- plans
- tool activity
- actions
- outcomes
- evaluations

## `/connectors`

- Connector catalog
- capability matrix
- connection status
- health
- scopes
- last synchronization

## `/portfolio`

- product exposure
- supplier concentration
- channel concentration
- cash exposure
- risk-adjusted profit

## `/cash-flow`

- available cash
- pending payouts
- supplier obligations
- fee breakdown
- refund reserve
- forecast

## `/system`

- environment
- worker health
- queue health
- schema versions
- release readiness
- logs

---

# 24. Implementation Rules for Grok

When applying this blueprint:

1. Audit the current UI before replacing components.
2. Preserve working business logic.
3. Create semantic design tokens first.
4. Centralize theme variables.
5. Build reusable primitives.
6. Normalize spacing, typography, borders, and states.
7. Replace duplicated components.
8. Apply the application shell.
9. Update the Terminal first.
10. Update tables and data views.
11. Integrate the AI panel.
12. Apply responsive behavior.
13. Add accessibility.
14. Verify dark and light themes.
15. Test all operational states.

Do not:

- create a separate frontend;
- rewrite business logic for visual reasons;
- leave old and new theme systems mixed;
- hardcode colors in individual pages;
- add decorative components without data;
- use excessive cards;
- use gradients in operational workspaces;
- hide failed actions;
- falsely label data as live.

---

# 25. Validation Checklist

## Brand

- [ ] TradeOps naming is consistent.
- [ ] Primary tagline is consistent.
- [ ] Logo placement is consistent.
- [ ] No generic ecommerce template styling remains.

## Tokens

- [ ] Dark tokens implemented.
- [ ] Light tokens implemented.
- [ ] Semantic colors implemented.
- [ ] Typography tokens implemented.
- [ ] Spacing and radius tokens implemented.

## Shell

- [ ] Sidebar implemented.
- [ ] Command bar implemented.
- [ ] AI panel implemented.
- [ ] Context state persists.
- [ ] Responsive collapse works.

## Components

- [ ] Buttons normalized.
- [ ] Inputs normalized.
- [ ] Tables normalized.
- [ ] badges normalized.
- [ ] dialogs and drawers normalized.
- [ ] loading and error states normalized.

## AI

- [ ] AI is available globally.
- [ ] tool activity is visible.
- [ ] evidence is visible.
- [ ] approval state is visible.
- [ ] execution state is visible.
- [ ] outcomes are visible.

## Accessibility

- [ ] Keyboard navigation works.
- [ ] visible focus exists.
- [ ] screen-reader labels exist.
- [ ] contrast passes.
- [ ] reduced motion works.
- [ ] status is not color-only.

## Responsive

- [ ] desktop terminal works.
- [ ] tablet navigation works.
- [ ] mobile approval flow works.
- [ ] tables degrade gracefully.
- [ ] AI panel becomes a drawer.

## Truthfulness

- [ ] live data is labeled.
- [ ] stale data is labeled.
- [ ] forecasts are labeled.
- [ ] unavailable data is not fabricated.
- [ ] external actions are verified before success.

---

# 26. Definition of Done

The TradeOps theme implementation is complete only when:

- the platform has one unified visual system;
- dark and light themes use semantic tokens;
- the Terminal feels like a commerce command center;
- dense data remains readable;
- the AI functions as an operational layer;
- signals are explainable;
- approvals and execution states are unmistakable;
- tables and charts are consistent;
- the application works across desktop, tablet, and mobile;
- the interface meets accessibility requirements;
- public and operational surfaces share one brand;
- no dead visual system remains;
- no critical component hardcodes colors outside the token system;
- all important states are implemented and tested;
- the production build succeeds.

---

# 27. Final Theme Statement

> TradeOps should feel like the place where commerce is observed, evaluated, governed, and executed. It is not a storefront. It is the operating terminal behind storefronts.