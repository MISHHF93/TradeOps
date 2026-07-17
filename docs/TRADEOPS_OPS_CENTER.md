# Real-Time Commerce Operations Center

## Principle

Connectors are **live operational sensors** for the Commerce Runtime — not isolated API clients.

AI never calls vendor REST paths. It requests **business capabilities**; the registry resolves providers.

## Components

| Piece | Location |
|-------|----------|
| Provider catalog | `packages/connector-core/src/live-feed-registry.ts` |
| Ops types + health aggregation | `packages/connector-core/src/ops-center.ts` |
| Capability resolution | `business-capabilities.ts` + `resolveCapability` |
| API | `ConnectorOpsService` · `GET /ops/connectors/health` |
| UI | `/terminal/connectors` Health Center |

## Domains

Commerce Platforms · Supplier Intelligence · Payments · Logistics · Marketing · Analytics · Accounting · AI Runtime · Platform Observability

## Providers (registry)

Shopify, Amazon, eBay, WooCommerce, BigCommerce, Alibaba, AliExpress, Faire, Stripe, PayPal, ShipStation, EasyPost, DHL, FedEx, UPS, Google Ads, Meta, TikTok Ads, GA4, PostHog, Mixpanel, QuickBooks, Xero, Prometheus, Grafana, OpenTelemetry, Sentry, plus fixtures.

**Honesty:** Catalog ≠ connected. Live status requires install + auth. Fixtures labeled.

## Event bus

Standard events: `OrderCreated`, `InventoryChanged`, `ListingPublished`, `ConnectorDisconnected`, …

Webhook-first when supported; durable retry/DLQ are deployment concerns (document + EventFabric ingest today).

## Tracing

OpenTelemetry-compatible design; set collector endpoint in deploy. Local: structured logs + CommerceEvent stream.

## API

```http
GET  /api/v1/ops/connectors/health
GET  /api/v1/ops/connectors/registry
GET  /api/v1/ops/capabilities/resolve?capability=discover_products
POST /api/v1/ops/connectors/:providerKey/probe
```
