# TradeOps API keys catalog

**Purpose:** Every vendor credential slot the platform understands.  
**Source of truth:** `packages/connector-core/src/production-connectors.ts` (`credentialEnvKeys`).  
**Your fill-in file:** root **`.env`** (never commit).  
**Refresh slots:** `pnpm run env:sync-keys`

> Without keys, TradeOps runs in **fixture / shadow / tools_only** mode and will not invent live marketplace success.

---

## How to use

1. Open **`.env`** in the repo root (already has empty slots after sync).
2. Paste real values after `=` for vendors you use.
3. Restart: `pnpm stop` then `pnpm start`.
4. Check readiness: `GET http://127.0.0.1:4000/api/v1/ops/connectors/production`  
   (or terminal Connectors / Ops — `liveReady` only when env keys are present).

**Security:** keep `API_HOST=127.0.0.1`. Never put secrets in `NEXT_PUBLIC_*` variables.

---

## Primary AI (recommended first)

| Variable | Vendor | Get it |
|----------|--------|--------|
| `XAI_API_KEY` | xAI Grok | https://console.x.ai |
| `XAI_BASE_URL` | xAI | default `https://api.x.ai/v1` |
| `XAI_CHAT_MODEL` | xAI | e.g. `grok-4.5` |
| `XAI_EMBED_MODEL` | xAI | optional |
| `TRADEOPS_AI_MODE` | TradeOps | `auto` \| `tools_only` \| `xai_rag` \| `xai_rag_tools` \| `xai_disabled` |
| `GROK_API_KEY` | alias | same as `XAI_API_KEY` if used |

Optional other LLM providers (routing registry; primary product path is xAI):

| Variable | Get it |
|----------|--------|
| `OPENAI_API_KEY` | https://platform.openai.com |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `GOOGLE_AI_API_KEY` | https://ai.google.dev |
| `MISTRAL_API_KEY` | https://console.mistral.ai |

---

## Commerce platforms

| Variables | Vendor | Docs |
|-----------|--------|------|
| `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` | Shopify | https://shopify.dev/docs/api/admin-graphql |
| `AMAZON_SP_CLIENT_ID`, `AMAZON_SP_CLIENT_SECRET`, `AMAZON_SP_REFRESH_TOKEN` | Amazon SP-API | https://developer-docs.amazon.com/sp-api/ |
| `EBAY_ACCESS_TOKEN` | eBay | https://developer.ebay.com/develop |
| `WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET` | WooCommerce | https://woocommerce.github.io/woocommerce-rest-api-docs/ |
| `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_ACCESS_TOKEN` | BigCommerce | https://developer.bigcommerce.com/docs/rest-management |
| `GOOGLE_MERCHANT_ACCESS_TOKEN`, `GOOGLE_MERCHANT_ID`, `GOOGLE_MERCHANT_DATA_SOURCE_ID` | Google Merchant | https://developers.google.com/merchant/api |

---

## Suppliers / dropship

| Variables | Vendor | Docs |
|-----------|--------|------|
| `ALIBABA_APP_KEY`, `ALIBABA_APP_SECRET` | Alibaba | https://open.alibaba.com/ |
| `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` | AliExpress | https://openservice.aliexpress.com/ |
| `INVENTORY_SOURCE_API_KEY` | Inventory Source | https://www.inventorysource.com/ |

---

## Payments & SaaS billing

| Variables | Vendor | Docs |
|-----------|--------|------|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe | https://dashboard.stripe.com/apikeys |
| `STRIPE_PRICE_*` | Stripe Price IDs | Dashboard → Products → Prices |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE` | PayPal | https://developer.paypal.com |
| `SQUARE_ACCESS_TOKEN`, `SQUARE_API_BASE` | Square | https://developer.squareup.com |

---

## Logistics

| Variables | Vendor | Docs |
|-----------|--------|------|
| `EASYPOST_API_KEY` | EasyPost | https://docs.easypost.com/ |
| `SHIPSTATION_API_KEY`, `SHIPSTATION_API_SECRET` | ShipStation | https://www.shipstation.com/docs/api/ |
| `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET` | UPS | https://developer.ups.com/ |
| `FEDEX_CLIENT_ID`, `FEDEX_CLIENT_SECRET` | FedEx | https://developer.fedex.com/ |
| `DHL_API_KEY` | DHL | https://developer.dhl.com/ |
| `USPS_CLIENT_ID`, `USPS_CLIENT_SECRET` | USPS | https://developers.usps.com/ |
| `CANADA_POST_USERNAME`, `CANADA_POST_PASSWORD` | Canada Post | https://www.canadapost-postescanada.ca/ac/support/api/ |

---

## Marketing & analytics

| Variables | Vendor | Docs |
|-----------|--------|------|
| `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REFRESH_TOKEN` | Google Ads | https://developers.google.com/google-ads/api/docs/start |
| `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Meta Ads | https://developers.facebook.com/docs/marketing-apis/ |
| `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` | TikTok Ads | https://business-api.tiktok.com/portal/docs |
| `GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | GA4 API | https://developers.google.com/analytics |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | GA4 browser (public) | Analytics → Admin → Data streams |
| `POSTHOG_API_KEY`, `POSTHOG_HOST` | PostHog | https://posthog.com/docs/api |
| `MIXPANEL_PROJECT_TOKEN`, `MIXPANEL_API_SECRET` | Mixpanel | https://developer.mixpanel.com |

---

## Accounting / ERP / industrial

| Variables | Vendor | Docs |
|-----------|--------|------|
| `QUICKBOOKS_ACCESS_TOKEN`, `QUICKBOOKS_REALM_ID` | QuickBooks | https://developer.intuit.com |
| `XERO_ACCESS_TOKEN`, `XERO_TENANT_ID` | Xero | https://developer.xero.com |
| `SAP_CLIENT_ID`, `SAP_CLIENT_SECRET`, `SAP_BASE_URL` | SAP S/4HANA | https://api.sap.com/ |
| `NETSUITE_ACCOUNT_ID`, `NETSUITE_CONSUMER_KEY`, `NETSUITE_TOKEN_ID` | NetSuite | Oracle NetSuite docs |
| `INFOR_CLIENT_ID`, `INFOR_CLIENT_SECRET`, `INFOR_TENANT` | Infor CSI | https://docs.infor.com/ |
| `SALSIFY_API_KEY`, `SALSIFY_ORG_ID` | Salsify PIM | https://developers.salsify.com/ |
| `AKENEO_CLIENT_ID`, `AKENEO_CLIENT_SECRET`, `AKENEO_BASE_URL` | Akeneo | https://api.akeneo.com/ |
| `WINDCHILL_BASE_URL`, `WINDCHILL_USER`, `WINDCHILL_PASSWORD` | PTC Windchill | PTC docs |
| `AUTODESK_CLIENT_ID`, `AUTODESK_CLIENT_SECRET` | Autodesk APS | Autodesk Platform Services |
| `MANHATTAN_CLIENT_ID`, `MANHATTAN_CLIENT_SECRET` | Manhattan WMS | vendor portal |

---

## Intelligence / tax / FX

| Variables | Vendor | Docs |
|-----------|--------|------|
| `KEEPA_API_KEY` | Keepa | https://keepa.com |
| `SERPAPI_API_KEY` | SerpAPI | https://serpapi.com |
| `OPENEXCHANGERATES_APP_ID` | Open Exchange Rates | https://docs.openexchangerates.org |
| `AVALARA_ACCOUNT_ID`, `AVALARA_LICENSE_KEY` | Avalara | https://developer.avalara.com |
| `TAXJAR_API_KEY` | TaxJar | https://developers.taxjar.com |

---

## Ops / observability (optional)

| Variables | Notes |
|-----------|--------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry export |
| `TRADEOPS_OPS_SYNC_DISABLED` | `1` to pause ops schedulers |
| `TRADEOPS_LIVE_SYNC_DISABLED` | `1` to pause live HTTP sync |

---

## After filling keys

```powershell
pnpm stop
pnpm start
pnpm run e2e:tenancy
# Optional:
# curl http://127.0.0.1:4000/api/v1/ai/xai/probe -X POST
# curl http://127.0.0.1:4000/api/v1/ops/connectors/production
```

Re-sync key slots if connectors are added in code:

```powershell
pnpm run env:sync-keys
```

Related: [TRADEOPS_INTERNET_SECURITY.md](./TRADEOPS_INTERNET_SECURITY.md), [TRADEOPS_XAI_CONFIGURATION.md](./TRADEOPS_XAI_CONFIGURATION.md), [TRADEOPS_CONNECTOR_ECOSYSTEM.md](./TRADEOPS_CONNECTOR_ECOSYSTEM.md).
