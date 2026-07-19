# Health and Diagnostics

## Public

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health/live` | Process liveness |
| `GET /api/v1/health` | Dependency readiness (may be degraded) |
| `GET /api/v1/public/capabilities` | Launch honesty board |

## Authenticated ops

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/ops/diagnostics` | Cohere, Tavily, Shopify, Stripe, EasyPost, DB, Redis, registries — **no secrets** |
| `GET /api/v1/ops/wiring-matrix` | UI action → backend mapping |
| `GET /api/v1/commerce/lifecycle/path` | Fixture vs Shopify E2E blockers |
| `GET /api/v1/ops/connectors/health` | Connector sensors |
| `GET /api/v1/ops/connectors/fabric` | Active + planned feeds |

## Probe statuses

ok | degraded | missing_config | blocked | error

`missing_config` lists env **names** only, never values.
