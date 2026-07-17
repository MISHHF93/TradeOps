# TradeOps Live Connector Ecosystem

## Purpose

TradeOps is a **Commerce Runtime** powered by live operational data. This document describes the production connector catalog, data pipeline, isolation rules, and operator APIs.

**Non-goals:** UI redesign. Simulation remains available but must be explicit.

---

## Architecture (canonical pipeline)

```
External API
  → OAuth / API credentials
  → Webhook Listener (preferred) | Polling Scheduler
  → Durable Queue (WebhookReceipt)
  → Retry Manager + DLQ
  → Normalizer (normalizeExternalPayload)
  → Canonical Models (Product, CommerceEvent, …)
  → Knowledge Graph / Commerce Runtime
  → AI Runtime (capability-based only)
  → Frontend (never vendor REST)
```

Frontend and AI **must not** call vendor APIs directly. They request **business capabilities**; the runtime resolves the provider.

---

## Packages

| Package | Role |
|---------|------|
| `@tradeops/connector-core` | Registry types, live-feed catalog, production catalog, ops-center health, normalization, capability map |
| `@tradeops/connector-live-http` | Credential-gated HTTP adapters (Shopify, Stripe, FX, Woo, EasyPost, SerpAPI, …) |
| `@tradeops/connector-fixture-*` | Local DEV fixtures only — always `isFixture: true` |
| `@tradeops/connector-google-merchant` | Google Merchant weekend / product input path |
| `apps/api` `LiveConnectorService` | Org install upsert, live sync, capability resolve |
| `apps/api` `ConnectorOpsService` | Ops Center health, webhooks, probes |
| `apps/api` `OpsSyncScheduler` | Webhook drain + probe + live HTTP interval |

---

## Production connector catalog

Source of truth: `packages/connector-core/src/production-connectors.ts`

Categories include:

- **Commerce:** Shopify GraphQL Admin, Amazon SP-API, eBay Sell, WooCommerce, BigCommerce
- **Supplier:** Alibaba, AliExpress, Inventory Source
- **Payments:** Stripe, PayPal, Square
- **Logistics:** EasyPost, ShipStation, UPS, FedEx, DHL, USPS, Canada Post
- **Marketing:** Google Ads, Meta Marketing, TikTok Ads
- **Analytics:** GA4, PostHog, Mixpanel
- **Accounting:** QuickBooks Online, Xero
- **Search / intelligence:** Google Merchant, Keepa, SerpAPI
- **Currency & tax:** Open Exchange Rates, Avalara, TaxJar
- **AI providers:** OpenAI, Anthropic, Gemini, xAI, Mistral (routed by AI Runtime)

Each connector registers:

- id, provider, category, domain  
- auth method, API version, scopes  
- business + technical capabilities  
- webhook topics, polling strategy, sync interval, rate limits  
- **credential env keys** (status is `credentials_required` until all present)

`resolveCredentialStatus()` / `listProductionRuntime()` never mark a connector live without env credentials.

---

## Live HTTP adapters (implemented)

`LIVE_HTTP_IMPLEMENTED` in connector-core:

| Provider key | Env credentials | Sync writes |
|--------------|-----------------|-------------|
| `shopify-graphql-admin` | `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` | Product upserts, OrderCreated events |
| `stripe-api` | `STRIPE_SECRET_KEY` | PaymentSucceeded (payouts), balance snapshot events |
| `open-exchange-rates` | `OPENEXCHANGERATES_APP_ID` | FX SyncCompleted event |
| `woocommerce-rest` | `WOOCOMMERCE_URL`, consumer key/secret | Product upserts |
| `easypost-api` | `EASYPOST_API_KEY` | Tracker / ShipmentDelayed events |
| `serpapi` | `SERPAPI_API_KEY` | Shopping search results event |

Other catalog entries are **registry-ready** (credential probe + install row + capability ads). Full HTTP adapters return `adapter_stub` when credentials exist but the adapter is not wired yet — **never fake data**.

---

## API surface (Ops Center)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/ops/connectors/health` | Health center + production catalog summary + queue + bus |
| GET | `/ops/connectors/registry` | Registry rows |
| GET | `/ops/connectors/production` | Full production descriptors + credential presence |
| POST | `/ops/connectors/ensure-registry` | Upsert org `ConnectorInstallation` rows from catalog |
| POST | `/ops/connectors/live-sync` | Credential-gated live HTTP → canonical + bus |
| POST | `/ops/connectors/:providerKey/probe` | Health heartbeat |
| POST | `/ops/connectors/reconcile-all` | Ensure registry + probe all |
| GET | `/ops/capabilities/resolve` | Capability resolve (board) |
| GET | `/ops/capabilities/live-resolve` | Capability resolve (production preference) |
| POST | `/ops/webhooks/:providerKey` | Webhook ingress (queued) |
| POST | `/ops/webhooks/process` | Drain queue |
| GET | `/ops/webhooks/dlq` | Dead letters |

---

## Event bus (standard business events)

Durable, idempotent via `(organizationId, providerKey, externalEventId)`:

`ProductCreated`, `OrderCreated`, `InventoryUpdated` / `InventoryChanged`, `SupplierUpdated`, `ShipmentDelayed`, `PaymentSucceeded`, `PaymentFailed`, `RefundIssued`, `CampaignPaused`, `ListingPublished`, `ConnectorConnected` / `Disconnected`, `SubscriptionRenewed`, `WebhookReceived`, `SyncCompleted`, `SyncFailed`, `QuotaWarning`.

Normalization entry: `normalizeExternalPayload()` in connector-core.

---

## Production isolation

`@tradeops/commerce-engine` → `production-isolation.ts`:

- `TRADEOPS_SIMULATION_MODE=1` — simulation allowed; must be labeled  
- `TRADEOPS_PRODUCTION_WORKSPACE=1` or `NODE_ENV=production` without simulation — **strict**: exclude fixture sources from production KPI paths  
- Fixtures always carry `isFixture: true` / `fixture-*` provider keys  

Honest empty states beat fabricated KPIs.

---

## Scheduler env

| Variable | Default | Meaning |
|----------|---------|---------|
| `TRADEOPS_OPS_SYNC_DISABLED` | off | Disable all ops loops |
| `TRADEOPS_WEBHOOK_DRAIN_MS` | 15000 | Webhook queue drain interval |
| `TRADEOPS_CONNECTOR_PROBE_MS` | 300000 | Install probe interval |
| `TRADEOPS_LIVE_SYNC_MS` | 900000 | Live HTTP sync interval |
| `TRADEOPS_LIVE_SYNC_DISABLED` | off | Disable live HTTP only |

---

## Observability

`apps/api/src/observability/telemetry.ts` records ops metrics (`live_sync_ok`, `capability_resolve`, `webhooks_received`, …). Ops health response includes tracing config description. Platform connectors (Prometheus, Grafana, OTel, Sentry) are registered for future wire-up.

---

## AI Capability Registry

AI requests capabilities such as `discover_products`, `read_orders`, `read_payments`, `monitor_fulfillment` — never `GET https://api.stripe.com/...`.

`CAPABILITY_PROVIDER_MAP` + `LiveConnectorService.resolveCapability()` rank providers by credential readiness, install status, and HTTP implementation.

---

## Audit: still not live without credentials

Anything in the production catalog without env secrets shows **credentials_required** and must not appear as live KPIs. Fixture packages remain for local demos only.

### Remaining adapter expansion (registry complete; HTTP partial)

Amazon SP-API, eBay, BigCommerce, Alibaba, PayPal, Square, ShipStation, carriers, ad platforms, GA4/PostHog/Mixpanel, QBO/Xero, Keepa, Avalara/TaxJar — credential probes + install metadata ready; implement HTTP modules in `@tradeops/connector-live-http` following the same pattern as Shopify/Stripe.

---

## Success criteria (phase checklist)

- [x] Production connector registry (single source of truth)  
- [x] Credential-gated status (no connected without env)  
- [x] Live HTTP package wired into monorepo build  
- [x] Live sync → Product / CommerceEvent canonical path  
- [x] Webhook queue + normalizer + bus events  
- [x] Capability resolve for AI  
- [x] Production isolation helpers + simulation labeling  
- [x] Ops Center health merges production catalog  
- [ ] Full HTTP for every catalog vendor (incremental)  
- [ ] OAuth redirect flows per vendor (env/token path first)  
- [ ] Grafana/Prometheus scrape endpoints production-hardend  
