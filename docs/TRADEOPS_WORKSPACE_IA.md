# TradeOps Information Architecture — Persona Workspaces

## Principle

**One User · One Workspace · One Objective · One AI · One Canonical Navigation Model**

Enterprise systems (Salesforce, ServiceNow, SAP, Dynamics, AWS) expose hundreds of capabilities. Users see a **role- and objective-appropriate subset**. TradeOps follows the same model.

---

## Resolver pipeline

```
Login
  → Identify User
  → Identify Persona
  → Identify Current Objective
  → Identify Active Commerce Cases
  → Identify Connected Services
  → Generate Personalized Workspace
  → Generate Dynamic Sidebar (Focus + More)
  → Generate AI Briefing
  → Display Recommended Actions
```

Implementation:

| Layer | Location |
|-------|----------|
| Pure resolver | `packages/commerce-engine/src/workspace.ts` |
| API | `WorkspaceService` · `GET /workspace` · `GET /workspace/navigate` · `GET /workspace/inventory` |
| Shell | `TerminalLayout` → `TerminalShell` → `TerminalSidebar` |
| Persona home | `/terminal/workspace/[persona]` |

---

## Personas (6)

| Persona | Focus (sidebar) | Home |
|---------|-----------------|------|
| Executive | Brief, Objectives, Decisions, Revenue, AI Advisor | `/terminal/workspace/executive` |
| Operator | Home, Tasks, Orders, Cases, Shipments, AI | `/terminal/workspace/operator` |
| Researcher | Home, Discovery, Opportunities, Cases, AI | `/terminal/workspace/researcher` |
| Analyst | Home, Signals, Portfolio, Customers, AI | `/terminal/workspace/analyst` |
| Developer | Home, Connectors, Runtime, Automations, AI | `/terminal/workspace/developer` |
| Administrator | Home, Personas, Billing, System, AI | `/terminal/workspace/administrator` |

**More** (collapsed by default): secondary destinations + procedure deep-links.

---

## Page categories

Every terminal route must be one of:

1. **Workspace** — persona home surface  
2. **Business process** — discover, prepare, fulfill, reconcile steps  
3. **Commerce Case** — process board / case detail  
4. **Settings / admin** — billing, org, personas  
5. **Connector** — hub, ecosystem, automations  
6. **System administration** — status, release readiness  

Full ownership catalog: `ROUTE_OWNERSHIP` in `workspace.ts` and `GET /workspace/inventory`.

### Merged / redirected

| Old feature page | Disposition |
|------------------|-------------|
| `/terminal/cockpit` | → Executive workspace |
| `/terminal/pipeline` | → `/terminal/process` |
| `/scanner` | → `/terminal` |

Rarely used advanced surfaces (disputes, live-examples, agency) live under **More** or AI search.

---

## Persona home surface

Each workspace home shows, in order:

1. Today’s priorities  
2. AI briefing  
3. 3–5 active objectives  
4. Next recommended actions  
5. Key KPIs  
6. Alerts  
7. Commerce Cases in flight  
8. Everything else (AI / More)

---

## AI-first navigation

Users ask:

- “Show my delayed shipments.”  
- “Compare suppliers.”  
- “Open today’s revenue.”  
- “Review connector health.”  

`resolveAiNavigation()` + command bar + `GET /workspace/navigate?q=` route to the correct workspace surface.

---

## What users should *not* see

- Full platform capability dump in the sidebar  
- Capital / network investment surfaces in default ops nav  
- Unrelated persona procedures in permanent chrome  
- Always-visible marketing, advanced tax, multi-carrier config  

Those remain available via **AI**, **command bar**, or **More**.

---

## Success criteria checklist

- [x] Pages catalogued with persona ownership  
- [x] Workspaces persona-driven with focused surface  
- [x] Sidebar generated dynamically (Focus + collapsed More)  
- [x] Feature pages merged (cockpit → exec) or owned  
- [x] Navigation reflects persona + objective + counts  
- [x] Cognitive load reduced (≤7 focus items)  
- [x] AI / command bar as primary discovery for the long tail  
- [x] Platform feels like an AI Commerce OS, not a feature catalog  
