# Connector Capability Framework

## Principle

Connectors are **intelligent capability providers**, not raw API wrappers.

| Avoid (AI planning surface) | Prefer (business capabilities) |
|----------------------------|--------------------------------|
| Products REST | `discover_products` |
| Orders API | `read_orders` |
| Inventory endpoint | `synchronize_inventory` |
| Listing GraphQL mutation | `publish_listing` / `prepare_listing` |

## Layers

1. **Technical capabilities** — typed `ConnectorCapability` on manifests  
2. **Business capabilities** — `BusinessCapability` mapped in `business-capabilities.ts`  
3. **Advertisement** — provider key, auth mode, API version, health, scopes, rate-limit hints  
4. **Selection** — `selectProvidersForCapabilities()` ranks by coverage, live vs fixture, health  

## API

* `GET /api/v1/ecosystem/capabilities`  
* `POST /api/v1/ecosystem/capabilities/select` `{ required: ["publish_listing"] }`  
* AI tool `listConnectorCapabilities` uses the board when host injects deps  

## Execution gate

Before AI execution:

1. Capability advertised  
2. Installation status allows operation  
3. Scopes / auth present  
4. Loop mode allows live vs fixture  
5. Human approval if consequential  

Never claim live success without authorization evidence.
