# End-to-End Runtime

**Canonical blueprint:** `TRADEOPS_AI_RUNTIME_BLUEPRINT.md`

## Request path

```
User action (persona object workspace + AI Context Rail)
  → Next.js client (credentials: include)
  → Nest /api/v1/*
  → AuthGuard (session or founder_direct)
  → org-scoped AuthContext
  → permissions + SaaS entitlements
  → AI Host Adapter (thin)
  → Workflow Engine (durable AI objective run)
  → AI Runtime (One AI Runtime — Phase A/B)
  → Search Manager | Connector Fabric | domain ports
  → normalize + BO write
  → Case sync (One Commerce Case)
  → AI Artifacts
  → Event Fabric
  → Knowledge Graph projection
  → CanonicalEnvelope + dataMode (Data Fabric)
  → SSE projection / UI
```

## Lifecycle spine

Commerce Case stages only. Stage list pages are filters. Product page is a twin facet.

## Runtime states

idle → queued → classifying → retrieving → calling_tools → normalizing → validating → awaiting_approval → executing → reconciling → completed | partial | blocked | failed

## Data modes

| Mode | Meaning |
|------|---------|
| live | Authorized external provider |
| fixture | Dev connector, same contract |
| simulation | Synthetic/local computation |
| shadow | Would-do ledger, no external write |
| blocked | Missing capability/credential |

## Two-phase AI

- **Phase A:** classify, plan, tools, evidence  
- **Phase B:** synthesize validated response + envelope  

See `TRADEOPS_AI_RUNTIME_BLUEPRINT.md` and `AI_EXECUTION_FLOW.md`.

## One-* principles

One Platform · One Workspace · One Commerce Case · One AI Runtime · One Workflow Engine · One Search Layer · One Connector Fabric · One Knowledge Graph · One Data Fabric · One Source of Truth
