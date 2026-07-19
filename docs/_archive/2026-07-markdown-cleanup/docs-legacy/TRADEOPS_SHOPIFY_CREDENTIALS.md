# Shopify connector credentials (when ready)

TradeOps does **not** claim a live Shopify connection until OAuth succeeds.

## Prerequisites

1. Shopify Partner account + custom app (or public app) with scopes you actually need, typically:
   - `read_products`, `write_products` (listing drafts)
   - `read_orders`, `write_orders` / fulfillment scopes as required
   - `read_inventory`, `write_inventory`
2. Dev store for sandbox testing.
3. HTTPS redirect URL for OAuth (local: tunnel such as ngrok/cloudflared → API webhook/OAuth callback).

## Environment (future)

```env
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_SCOPES=read_products,write_products,read_orders,read_inventory
SHOPIFY_APP_URL=https://your-tunnel.example
```

Merchant tokens must be stored **encrypted server-side** (credential vault), never in the browser.

## Until then

Use **Fixture Marketplace (DEV)** and **Fixture Supplier (DEV)** — explicitly labeled, no fake production status.
