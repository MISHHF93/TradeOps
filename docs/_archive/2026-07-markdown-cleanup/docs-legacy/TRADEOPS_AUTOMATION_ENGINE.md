# TradeOps Automation Engine

## Current state (honest)

| Layer | Status |
|-------|--------|
| Versioned workflow templates | **Operational** (`@tradeops/workflow-engine`) |
| Template list/run API | **Operational** `GET/POST /api/v1/automation/workflows/*` |
| Shadow / approval gating | **Operational** (consequential steps skipped until approved/live) |
| Visual builder | **Coming soon** |
| Durable DAG executor + compensation | **Partial / planned** |
| Weekend Google job | **Operational (shadow)** |

## API

- `GET /api/v1/automation/workflows/templates`
- `POST /api/v1/automation/workflows/run` body: `{ templateKey, variables?, dryRun? }`

Runs are audited and recorded as operator runs with `objective: workflow:<key>`.

## Triggers (supported families in templates)

scheduled_interval · manual · supplier_cost_change · supplier_stock_change · marketplace_order · tracking_delay · forecast_horizon · …

Full trigger wiring for webhooks/schedulers expands with Redis worker + credentialed connectors.
