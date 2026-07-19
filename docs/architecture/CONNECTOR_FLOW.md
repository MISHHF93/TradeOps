# Connector Flow

**Normative ownership model:** `CONNECTOR_FABRIC_ARCHITECTURE.md`

```
Business capability request (e.g. publish_listing, search_suppliers)
  → Connector Fabric authorize (org, loopMode, approval)
  → Resolve provider (install health, fixture policy — never AI-selected vendor API)
  → Map capability → technical operation (Fabric-private)
  → LIVE_HTTP_IMPLEMENTED?
      yes + credentials → live adapter
      fixture allowed → fixture adapter
      else → blocked honesty (no silent live→fixture failover)
  → normalize to canonical models
  → persist Product / Listing / Order / Shipment / …
  → publish domain event
  → CapabilityResult { data, dataMode, provenance }
```

## Callers

| Caller | May request |
|--------|-------------|
| AI Runtime | Business capabilities via `FabricPort` only |
| Search Manager | `search_suppliers`, `marketplace_discovery` via Fabric |
| Commerce services | Same invoke API for live side effects |
| Ops UI | Health + installations (may show provider names to humans) |

## Active stack (adapters behind Fabric)

Shopify, Stripe, EasyPost, fixtures; search/AI providers are **not** commerce capability executors (see Search Manager / AI Runtime).

## Fixtures

Same capability contracts as live. Always `isFixture` / `dataMode=fixture`. Never auto-selected on live failure.

## Planned

Amazon, eBay, Woo, BigCommerce, Alibaba, … — not executable, not “connected.”
