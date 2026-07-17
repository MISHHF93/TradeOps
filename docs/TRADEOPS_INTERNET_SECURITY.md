# Internet & LAN security for TradeOps

**Risk you hit:** On Windows with Node inbound firewall rules, binding `0.0.0.0` + `TRADEOPS_ACCESS_MODE=founder_direct` means **anyone on your LAN (or WAN if port-forwarded) can use the product as owner with no login.**

## Current safe local posture

| Setting | Secure local value | Why |
|---------|-------------------|-----|
| `API_HOST` | `127.0.0.1` | API not reachable from other machines |
| `WEB_HOST` | `127.0.0.1` | Next.js not reachable from LAN |
| `WEB_ORIGIN` | `http://localhost:3000` | Strict CORS |
| `API_PUBLIC_URL` | `http://127.0.0.1:4000` | Browser/SSR talks to loopback |
| `TRADEOPS_ACCESS_MODE` | `founder_direct` | OK **only** on loopback |
| `AUTH_BYPASS` | `true` | Same — loopback only |
| `APP_SECRET` | 48+ random bytes | Sessions / HMAC |
| `CREDENTIALS_MASTER_KEY` | 32-byte base64 | Connector vault |

### One-shot harden local machine

```powershell
node scripts/apply-local-secure-env.mjs
node scripts/generate-secrets.mjs --write   # if you only want new secrets
pnpm stop
pnpm start
```

Boot refuses to start if `founder_direct` + public bind without opt-in (`assertSecurityBoot` in API `main.ts`).

## Is it “connected to the Internet”?

- **Loopback bind (127.0.0.1):** reachable only from this PC. Safe for founder_direct.
- **All interfaces (0.0.0.0) + firewall allow Node:** LAN devices can open `http://YOUR_LAN_IP:3000` and act as founder.
- **Router port-forward / cloud VM public IP:** same as putting no-login admin on the internet. **Do not.**

## Internet / shared deploy (checklist)

1. `TRADEOPS_ACCESS_MODE=authenticated` (or `multi_tenant`)  
2. `AUTH_BYPASS=false`  
3. `NODE_ENV=production`  
4. Strong `APP_SECRET` + `CREDENTIALS_MASTER_KEY` (never defaults)  
5. TLS reverse proxy (Caddy/nginx/Cloudflare) — app listens on 127.0.0.1 only  
6. `WEB_ORIGIN=https://your.domain` and CORS matches  
7. Session cookies `Secure` (production path)  
8. Firewall: only 443 public; 3000/4000 closed  
9. Live API keys **server-side only** (never `NEXT_PUBLIC_*` for secrets)  
10. Capital / investment gates stay OFF unless compliance-ready  

**Do not** set `TRADEOPS_ALLOW_INSECURE_BIND=1` or `TRADEOPS_ALLOW_PUBLIC_FOUNDER=1` on a public host unless you fully accept the risk.

## API keys — fill in `.env` (never commit)

| Variable | Purpose | Where to get |
|----------|---------|--------------|
| `XAI_API_KEY` | Grok / SpaceXAI chat + optional embed | https://console.x.ai |
| `XAI_BASE_URL` | Default `https://api.x.ai/v1` | |
| `XAI_CHAT_MODEL` | e.g. `grok-4.5` | |
| `TRADEOPS_AI_MODE` | `auto` \| `tools_only` \| `xai_rag` \| … | [TRADEOPS_XAI_CONFIGURATION.md](./TRADEOPS_XAI_CONFIGURATION.md) |
| `STRIPE_SECRET_KEY` | SaaS billing / payments | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | Stripe Dashboard |
| `SHOPIFY_SHOP_DOMAIN` | Live Shopify | Shopify admin |
| `SHOPIFY_ACCESS_TOKEN` | Live Shopify | Shopify admin |
| `GOOGLE_MERCHANT_*` | Merchant Center feed | Google |
| `OPENEXCHANGERATES_APP_ID` | FX | openexchangerates.org |
| `SERPAPI_API_KEY` | Shopping intel | serpapi.com |
| `EASYPOST_API_KEY` | Shipping | EasyPost |
| `WOOCOMMERCE_*` | WooCommerce | Woo REST API |
| `BIGCOMMERCE_*` | BigCommerce | BC admin |
| `EBAY_ACCESS_TOKEN` | eBay | eBay developers |
| `PAYPAL_*` | PayPal | PayPal developer |
| `SHIPSTATION_*` | ShipStation | ShipStation |
| `KEEPA_API_KEY` | Keepa | Keepa |
| `SQUARE_ACCESS_TOKEN` | Square | Square |

Template: [`.env.example`](../.env.example) · keys section also appended by `apply-local-secure-env.mjs`.

### After adding keys

```powershell
pnpm stop
pnpm start
pnpm run e2e:tenancy
# Optional live probes (only with real keys):
# POST /api/v1/ai/xai/probe
# POST /api/v1/ops/connectors/live-sync
```

Without keys, TradeOps stays **fixture / shadow / tools_only** — it will not invent live marketplace success.

## Quick verification

```powershell
# Should listen on 127.0.0.1 only (not 0.0.0.0) after harden
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,4000 }

# From another device on Wi‑Fi, http://YOUR_LAN_IP:3000 should FAIL
# On this PC, http://localhost:3000 should work
```

## Related

- [TRADEOPS_SECURITY_MODEL.md](./TRADEOPS_SECURITY_MODEL.md)  
- [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md)  
- [TRADEOPS_MULTI_TENANCY.md](./TRADEOPS_MULTI_TENANCY.md)  
- [TRADEOPS_XAI_CONFIGURATION.md](./TRADEOPS_XAI_CONFIGURATION.md)  
