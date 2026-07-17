# TradeOps Route Consolidation

**Date:** 2026-07-16  
**Goal:** Process-first navigation; no orphan feature inventory.

| Existing route | Purpose | Lifecycle | Keep/Merge/Remove | New primary |
|----------------|---------|-----------|-------------------|-------------|
| `/terminal/cockpit` | Command center | Command | **Keep** — process control | Terminal |
| `/terminal` | Scanner | Discover | **Keep** as Discover | Discover |
| `/terminal/opportunities` | Ranked scores | Evaluate | **Keep** as Evaluate view | Evaluate |
| `/terminal/signals` | Signal feed | Evaluate/Intel | **Keep** under Intelligence | Signals |
| `/terminal/watchlist` | Saved cases | All | **Keep** (saved state) | Watchlist |
| `/terminal/pipeline` | Old stage counts | Process | **Redirect** | `/terminal/process` |
| `/terminal/tasks` | **NEW** work queue | All stages | **Keep** | Tasks |
| `/terminal/process` | **NEW** board | Full lifecycle | **Keep** | Commerce Process |
| `/terminal/process/[caseId]` | **NEW** journey | Full lifecycle | **Keep** | Product Journey |
| `/terminal/products/[id]` | Digital twin | Prepare / Evaluate | **Keep** | Products |
| `/terminal/approvals` | Human decisions | Approve | **Keep** | Approvals |
| `/terminal/orders` | Orders / fulfill | Sell–Fulfill | **Keep** | Orders & Fulfill |
| `/terminal/ai` | AI operator | Command | **Keep** | AI Operator |
| `/terminal/live-examples` | Runnable examples | Automation | **Keep** | Live examples |
| `/terminal/objectives` | Run history | Automation | **Keep** | Objectives |
| `/terminal/automations` | Workflows | Automation | **Keep** (credential) | Workflows |
| `/terminal/portfolio` | Portfolio | Intelligence | **Keep** | Portfolio |
| `/terminal/cashflow` | Cash | Intelligence | **Keep** | Cash flow |
| `/terminal/connectors` | Connectors | Platform | **Keep** | Connectors |
| `/terminal/customers` | Customer intel | Intelligence | **Keep** | Customers |
| `/terminal/agency` | Agency clients | Platform | **Keep** | Agency |
| `/terminal/control-tower` | Duplicate dashboard | Command | **Redirect** | `/terminal/cockpit` |
| `/app` | System | Platform | **Keep** | System |
| `/status` | Capability honesty | Platform | **Keep** | Capability |

## Nav structure (after)

```text
Terminal:   Command center · Process · Tasks
Commerce:   Discover · Evaluate · Listings · Orders · Fulfillment · Approvals
Intelligence: Portfolio · Cash flow · Customers · Watchlist
Automation: AI Operator · Workflows · Execution history · Live examples
Platform:   Connectors · System · Capability status
```

Listings = prepare/approve/publish cases. Fulfillment = sell/source/fulfill cases + orders.
Both share `CommerceCase` / order records with Process.

## Rule

No new sidebar route without a lifecycle stage, shared resource, or governance role.
