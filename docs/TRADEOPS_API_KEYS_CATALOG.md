# API keys — paste placeholders

Use these files to paste secrets after you register with each vendor.

| File | Purpose |
|------|---------|
| [env-api-keys.paste.env](./env-api-keys.paste.env) | **Paste-ready** `KEY=` lines (all vendors) |
| [../env.vendors.template](../env.vendors.template) | Same content at repo root |
| [../.env](../.env) | Live local config (gitignored) — merge keys here |

## How to paste

1. Open `docs/env-api-keys.paste.env` (or `env.vendors.template`).
2. After you get a key from the vendor dashboard, put it **after** `=`:

```env
XAI_API_KEY=xai-your-real-key-here
STRIPE_SECRET_KEY=sk_test_your_real_key
SHOPIFY_ACCESS_TOKEN=shpat_your_real_token
SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com
```

3. Copy those lines into root `.env` (replace the empty `KEY=` lines).
4. Save and restart:

```powershell
pnpm stop
pnpm start
```

Leave unused vendors blank — TradeOps stays fixture/shadow for those.

Regenerate templates: `pnpm run env:write-key-docs`

---

## Priority block (start here)

```env
# AI — https://console.x.ai
XAI_API_KEY=

# Shopify — https://shopify.dev/docs/api/admin-graphql
SHOPIFY_SHOP_DOMAIN=
SHOPIFY_ACCESS_TOKEN=

# Stripe — https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Intelligence
SERPAPI_API_KEY=
KEEPA_API_KEY=
GOOGLE_MERCHANT_ACCESS_TOKEN=
GOOGLE_MERCHANT_ID=
OPENEXCHANGERATES_APP_ID=

# Shipping
EASYPOST_API_KEY=
SHIPSTATION_API_KEY=
SHIPSTATION_API_SECRET=
```

---

## Full variable list

| Vendor | Variable name | Get key |
|--------|---------------|---------|
| Shopify | `SHOPIFY_SHOP_DOMAIN` | https://shopify.dev/docs/api/admin-graphql |
| Shopify | `SHOPIFY_ACCESS_TOKEN` | https://shopify.dev/docs/api/admin-graphql |
| Amazon | `AMAZON_SP_CLIENT_ID` | https://developer-docs.amazon.com/sp-api/ |
| Amazon | `AMAZON_SP_CLIENT_SECRET` | https://developer-docs.amazon.com/sp-api/ |
| Amazon | `AMAZON_SP_REFRESH_TOKEN` | https://developer-docs.amazon.com/sp-api/ |
| eBay | `EBAY_ACCESS_TOKEN` | https://developer.ebay.com/develop |
| WooCommerce | `WOOCOMMERCE_URL` | https://woocommerce.github.io/woocommerce-rest-api-docs/ |
| WooCommerce | `WOOCOMMERCE_CONSUMER_KEY` | https://woocommerce.github.io/woocommerce-rest-api-docs/ |
| WooCommerce | `WOOCOMMERCE_CONSUMER_SECRET` | https://woocommerce.github.io/woocommerce-rest-api-docs/ |
| BigCommerce | `BIGCOMMERCE_STORE_HASH` | https://developer.bigcommerce.com/docs/rest-management |
| BigCommerce | `BIGCOMMERCE_ACCESS_TOKEN` | https://developer.bigcommerce.com/docs/rest-management |
| Alibaba | `ALIBABA_APP_KEY` | https://open.alibaba.com/ |
| Alibaba | `ALIBABA_APP_SECRET` | https://open.alibaba.com/ |
| AliExpress | `ALIEXPRESS_APP_KEY` | https://openservice.aliexpress.com/ |
| AliExpress | `ALIEXPRESS_APP_SECRET` | https://openservice.aliexpress.com/ |
| Inventory Source | `INVENTORY_SOURCE_API_KEY` | https://www.inventorysource.com/ |
| Stripe | `STRIPE_SECRET_KEY` | https://docs.stripe.com/api |
| PayPal | `PAYPAL_CLIENT_ID` | https://developer.paypal.com/docs/api/overview/ |
| PayPal | `PAYPAL_CLIENT_SECRET` | https://developer.paypal.com/docs/api/overview/ |
| Square | `SQUARE_ACCESS_TOKEN` | https://developer.squareup.com/docs |
| EasyPost | `EASYPOST_API_KEY` | https://docs.easypost.com/ |
| ShipStation | `SHIPSTATION_API_KEY` | https://www.shipstation.com/docs/api/ |
| ShipStation | `SHIPSTATION_API_SECRET` | https://www.shipstation.com/docs/api/ |
| UPS | `UPS_CLIENT_ID` | https://developer.ups.com/ |
| UPS | `UPS_CLIENT_SECRET` | https://developer.ups.com/ |
| FedEx | `FEDEX_CLIENT_ID` | https://developer.fedex.com/ |
| FedEx | `FEDEX_CLIENT_SECRET` | https://developer.fedex.com/ |
| DHL | `DHL_API_KEY` | https://developer.dhl.com/ |
| USPS | `USPS_CLIENT_ID` | https://developers.usps.com/ |
| USPS | `USPS_CLIENT_SECRET` | https://developers.usps.com/ |
| Canada Post | `CANADA_POST_USERNAME` | https://www.canadapost-postescanada.ca/ac/support/api/ |
| Canada Post | `CANADA_POST_PASSWORD` | https://www.canadapost-postescanada.ca/ac/support/api/ |
| Google | `GOOGLE_ADS_DEVELOPER_TOKEN` | https://developers.google.com/google-ads/api/docs/start |
| Google | `GOOGLE_ADS_REFRESH_TOKEN` | https://developers.google.com/google-ads/api/docs/start |
| Meta | `META_ACCESS_TOKEN` | https://developers.facebook.com/docs/marketing-apis/ |
| Meta | `META_AD_ACCOUNT_ID` | https://developers.facebook.com/docs/marketing-apis/ |
| TikTok | `TIKTOK_ACCESS_TOKEN` | https://business-api.tiktok.com/portal/docs |
| TikTok | `TIKTOK_ADVERTISER_ID` | https://business-api.tiktok.com/portal/docs |
| Google | `GA4_PROPERTY_ID` | https://developers.google.com/analytics/devguides/reporting/data/v1 |
| Google | `GOOGLE_APPLICATION_CREDENTIALS` | https://developers.google.com/analytics/devguides/reporting/data/v1 |
| PostHog | `POSTHOG_API_KEY` | https://posthog.com/docs/api |
| PostHog | `POSTHOG_HOST` | https://posthog.com/docs/api |
| Mixpanel | `MIXPANEL_PROJECT_TOKEN` | https://developer.mixpanel.com/reference/overview |
| Mixpanel | `MIXPANEL_API_SECRET` | https://developer.mixpanel.com/reference/overview |
| Intuit | `QUICKBOOKS_ACCESS_TOKEN` | https://developer.intuit.com/app/developer/qbo/docs/get-started |
| Intuit | `QUICKBOOKS_REALM_ID` | https://developer.intuit.com/app/developer/qbo/docs/get-started |
| Xero | `XERO_ACCESS_TOKEN` | https://developer.xero.com/documentation/ |
| Xero | `XERO_TENANT_ID` | https://developer.xero.com/documentation/ |
| Google | `GOOGLE_MERCHANT_ACCESS_TOKEN` | https://developers.google.com/merchant/api |
| Google | `GOOGLE_MERCHANT_ID` | https://developers.google.com/merchant/api |
| Keepa | `KEEPA_API_KEY` | https://keepa.com/#!discuss/t/api |
| SerpAPI | `SERPAPI_API_KEY` | https://serpapi.com/ |
| Open Exchange Rates | `OPENEXCHANGERATES_APP_ID` | https://docs.openexchangerates.org/ |
| Avalara | `AVALARA_ACCOUNT_ID` | https://developer.avalara.com/ |
| Avalara | `AVALARA_LICENSE_KEY` | https://developer.avalara.com/ |
| TaxJar | `TAXJAR_API_KEY` | https://developers.taxjar.com/api/reference/ |
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com/docs |
| Anthropic | `ANTHROPIC_API_KEY` | https://docs.anthropic.com/ |
| Google | `GOOGLE_AI_API_KEY` | https://ai.google.dev/docs |
| xAI | `XAI_API_KEY` | https://docs.x.ai/ |
| Mistral | `MISTRAL_API_KEY` | https://docs.mistral.ai/ |
| SAP | `SAP_CLIENT_ID` | https://api.sap.com/ |
| SAP | `SAP_CLIENT_SECRET` | https://api.sap.com/ |
| SAP | `SAP_BASE_URL` | https://api.sap.com/ |
| Oracle | `NETSUITE_ACCOUNT_ID` | https://docs.oracle.com/en/cloud/saas/netsuite/ |
| Oracle | `NETSUITE_CONSUMER_KEY` | https://docs.oracle.com/en/cloud/saas/netsuite/ |
| Oracle | `NETSUITE_TOKEN_ID` | https://docs.oracle.com/en/cloud/saas/netsuite/ |
| Infor | `INFOR_CLIENT_ID` | https://docs.infor.com/ |
| Infor | `INFOR_CLIENT_SECRET` | https://docs.infor.com/ |
| Infor | `INFOR_TENANT` | https://docs.infor.com/ |
| Salsify | `SALSIFY_API_KEY` | https://developers.salsify.com/ |
| Salsify | `SALSIFY_ORG_ID` | https://developers.salsify.com/ |
| Akeneo | `AKENEO_CLIENT_ID` | https://api.akeneo.com/ |
| Akeneo | `AKENEO_CLIENT_SECRET` | https://api.akeneo.com/ |
| Akeneo | `AKENEO_BASE_URL` | https://api.akeneo.com/ |
| PTC | `WINDCHILL_BASE_URL` | https://www.ptc.com/en/products/windchill |
| PTC | `WINDCHILL_USER` | https://www.ptc.com/en/products/windchill |
| PTC | `WINDCHILL_PASSWORD` | https://www.ptc.com/en/products/windchill |
| Autodesk | `AUTODESK_CLIENT_ID` | https://aps.autodesk.com/ |
| Autodesk | `AUTODESK_CLIENT_SECRET` | https://aps.autodesk.com/ |
| Manhattan Associates | `MANHATTAN_CLIENT_ID` | https://www.manh.com/ |
| Manhattan Associates | `MANHATTAN_CLIENT_SECRET` | https://www.manh.com/ |

## Security

- Keep `API_HOST=127.0.0.1` while using founder_direct (see [TRADEOPS_INTERNET_SECURITY.md](./TRADEOPS_INTERNET_SECURITY.md)).
- Never put private keys in `NEXT_PUBLIC_*` variables.
- Do not commit a filled `.env`.

