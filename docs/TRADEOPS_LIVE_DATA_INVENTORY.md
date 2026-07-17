# Live Data Inventory

## Rule

Every visible business metric is either:

1. **Live / canonical** — from org DB or connected connector, with provenance  
2. **Derived model** — computed from canonical inputs, labeled as estimate  
3. **Fixture / simulation** — labeled `TEST FIXTURE` or `SIMULATION`  
4. **Unavailable** — empty state with how to connect (never invented)

## Inventory (major surfaces)

| ID | Surface | Metric | Origin | Live? |
|----|---------|--------|--------|-------|
| process.open_cases | Process | Open cases | CommerceCase COUNT | Yes (canonical) |
| process.friction | Process | Friction | State engine heuristic | Derived |
| scanner.opportunities | Discover | Scores | Opportunity model | Derived; fixture labeled |
| portfolio.revenue | Portfolio | Revenue | CustomerOrder sum | Yes (canonical) |
| portfolio.pending_payouts | Portfolio | Pending payouts | CommercePayout or null | No invent |
| portfolio.ad_allocation | Portfolio | Ad allocation | Product.adAllocationMinor | Planning only |
| cockpit.counts | Command center | Counts | Prisma counts | Yes |
| ops.connector_health | Connectors | Health | Install + registry | Yes (sensors) |
| channel.profitability | Product | Channel fees | Modeled assumptions | Simulation label |
| ai.recommendations | AI | Recs | OperatorRun + products | Evidence required |

## API

- `GET /api/v1/ops/live-data-inventory` — full inventory JSON  
- Portfolio / cockpit responses include `provenance` objects  

## Simulation isolation

- `TRADEOPS_SIMULATION_MODE=1` / `NEXT_PUBLIC_TRADEOPS_SIMULATION_MODE=1` → workspace-wide Simulation banner  
- Fixture products: `sourcePlatform` starts with `fixture` → TEST FIXTURE  
- Fixture connectors installed → terminal banner if simulation mode is off  
- Production workspace must not mix unlabeled demo numbers  

## Automatic refresh

- Webhook drain: `OpsSyncScheduler` every `TRADEOPS_WEBHOOK_DRAIN_MS` (default 15s)  
- Connector probe: every `TRADEOPS_CONNECTOR_PROBE_MS` (default 5m)  
- Disable: `TRADEOPS_OPS_SYNC_DISABLED=1`  
- Manual: `POST /ops/webhooks/process`, `POST /ops/connectors/reconcile-all`  

## AI evidence

- Each recommendation includes `evidence.productId`, `evidenceLinks[]` (product + source), fixture flags  
- UI AI panel links to product twin and connectors; no ungrounded cards without productId

## Forbidden

- `Math.random()` for business metrics  
- Inventing payouts as `% of revenue`  
- Hardcoding `fixture-marketplace` concentration when other channels exist  
- AI recs without product/order evidence links  
