# Connector Standard

> Fixtures implement this standard today; real Shopify/Amazon remain BLOCKED without credentials.

## Families

marketplace | storefront | supplier | payment | shipping | advertising | trend | review

## Capabilities (declare only what is implemented)

`searchProducts`, `readProduct`, `readReviews`, `readSupplier`, `quoteShipping`, `readInventory`, `createListing`, `updateListing`, `pauseListing`, `readOrders`, `createSupplierOrder`, `submitFulfillment`, `readTracking`, `readPayments`, `readFees`, `receiveWebhooks`

## States

`not_configured` | `credentials_required` | `connected` | `authorization_expired` | `permission_limited` | `rate_limited` | `unhealthy` | `disabled`

Fixture connectors always advertise themselves as **FIXTURE** and never claim production API connectivity.

## Contract location

`packages/connector-core` — manifests, health, capability types, registry.
