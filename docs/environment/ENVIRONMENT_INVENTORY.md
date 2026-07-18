# TradeOps Environment Inventory

**Generated from `PLATFORM_ENV_MANIFEST`** (code-derived).  
**Secrets:** names only — never store real values in this document.

_Generated: 2026-07-18T02:52:51.013Z_

## Stack (discovered)

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces |
| API | NestJS `apps/api` |
| Web | Next.js 15 `apps/web` |
| Worker | `apps/worker` |
| Database | PostgreSQL + Prisma (`@tradeops/database`); local Prisma Dev / PGlite |
| Cache / queues | Redis (optional locally) |
| Auth / tenancy | Session auth + `TRADEOPS_ACCESS_MODE` |
| AI | `@tradeops/ai-runtime` — **Cohere code-first** (`AI_PROVIDER=cohere`) |
| Config | `@tradeops/config` (Zod `loadEnv` + AI platform + financial gates + manifest) |
| Connectors | `@tradeops/connectors/live-http` probeCredentials + tenant vault |
| Deploy | Dockerfiles, `docker-compose.yml` |

## Counts

| Metric | Count |
|--------|------:|
| Canonical manifest rows | 217 |
| Required in production | 9 |
| Secret flags | 73 |
| Tenant vault credential names | 76 |
| Alias mappings | 20 |

## How to regenerate

```bash
node scripts/scan-env-keys.mjs
pnpm --filter @tradeops/config build
node scripts/write-env-inventory.mjs
```

## Canonical files

| File | Role |
|------|------|
| `packages/config/src/environment-manifest.ts` | Typed inventory + production requirements |
| `packages/config/src/env-validation.ts` | Fail-closed production validation |
| `packages/config/src/index.ts` | Zod core `loadEnv()` |
| `packages/config/src/ai-platform-config.ts` | Cohere / search / tool policy |
| `packages/config/src/financial-gates.ts` | Legal capital gates |
| `packages/config/src/security-boot.ts` | Bind + secret strength boot gates |
| `.env.example` | Full safe template |
| `env.vendors.template` | Optional vendor key paste sheet |

## Required in production

- `NODE_ENV`
- `WEB_ORIGIN`
- `API_PUBLIC_URL`
- `DATABASE_URL`
- `APP_SECRET`
- `CREDENTIALS_MASTER_KEY`
- `TRADEOPS_ACCESS_MODE`
- `AI_PROVIDER`
- `COHERE_API_KEY`

## Manifest by subsystem

### ai (32)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `AI_PROVIDER` |  | yes | platform_env | Primary LLM: cohere \| openai \| xai \| gemini \| auto |
| `AI_RUNTIME_ENABLED` |  |  | platform_env | Master switch for AI runtime |
| `COHERE_API_KEY` | yes | yes | platform_env | Cohere API key (server-only). Never NEXT_PUBLIC. Rotate if ever pasted in chat. |
| `COHERE_BASE_URL` |  |  | platform_env | Cohere API base URL |
| `COHERE_CHAT_MODEL` |  |  | platform_env | Chat / agent model id |
| `COHERE_EMBED_MODEL` |  |  | platform_env | Embedding model for retrieval |
| `COHERE_RERANK_MODEL` |  |  | platform_env | Rerank model |
| `COHERE_TEMPERATURE` |  |  | platform_env | Default generation temperature |
| `COHERE_MAX_TOKENS` |  |  | platform_env | Default max output tokens |
| `COHERE_TIMEOUT_MS` |  |  | platform_env | Provider request timeout ms |
| `COHERE_MAX_RETRIES` |  |  | platform_env | Provider retry count |
| `COHERE_RETRIEVAL_ENABLED` |  |  | platform_env | Enable Cohere embed/rerank retrieval path |
| `AI_STRUCTURED_OUTPUT_ENABLED` |  |  | platform_env | JSON-schema synthesis for agent loop |
| `AI_TOOL_CALLING_ENABLED` |  |  | platform_env | Tool selection phase in agent loop |
| `AI_STREAMING_ENABLED` |  |  | platform_env | Streaming responses (progressive) |
| `AI_TEXT_OUTPUT_ENABLED` |  |  | platform_env | Include human text in envelope |
| `AI_RESPONSE_MODE` |  |  | platform_env | json_schema \| json_object \| text |
| `AI_OUTPUT_SCHEMA_VERSION` |  |  | platform_env | Canonical envelope schema version |
| `AI_MAX_TOOL_ROUNDS` |  |  | platform_env | Agent tool-selection rounds |
| `AI_MAX_TOOL_CALLS` |  |  | platform_env | Max tools per request |
| `AI_MAX_EXECUTION_SECONDS` |  |  | platform_env | Wall-clock budget for agent loop |
| `AI_REQUIRE_APPROVAL_FOR_WRITES` |  |  | platform_env | Gate write capabilities |
| `AI_REQUIRE_APPROVAL_FOR_PAYMENTS` |  |  | platform_env | Gate payment actions |
| `AI_REQUIRE_APPROVAL_FOR_REFUNDS` |  |  | platform_env | Gate refunds |
| `AI_REQUIRE_APPROVAL_FOR_PUBLISHING` |  |  | platform_env | Gate listing publish |
| `AI_INCLUDE_TEXT_OUTPUT` |  |  | platform_env | Envelope include text |
| `AI_INCLUDE_JSON_OUTPUT` |  |  | platform_env | Envelope include JSON artifact |
| `AI_INCLUDE_EVIDENCE` |  |  | platform_env | Envelope include evidence array |
| `AI_INCLUDE_ACTIONS` |  |  | platform_env | Envelope include proposed actions |
| `AI_INCLUDE_CONFIDENCE` |  |  | platform_env | Envelope include confidence |
| `AI_PROMPT_VERSION` |  |  | platform_env | Optional prompt registry version pin |
| `AI_RESPONSE_CACHE_ENABLED` |  |  | platform_env | Cache AI responses (default off while validating live path) |

### ai_optional (14)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `XAI_API_KEY` | yes |  | platform_env | Optional xAI / Grok key |
| `XAI_MODEL` |  |  | platform_env | xAI chat model |
| `XAI_BASE_URL` |  |  | platform_env | xAI API base |
| `XAI_EMBED_MODEL` |  |  | platform_env | Optional xAI embed model |
| `XAI_WEB_SEARCH_ENABLED` |  |  | platform_env | xAI web search policy flag |
| `XAI_X_SEARCH_ENABLED` |  |  | platform_env | xAI X/Twitter search policy flag |
| `XAI_SEARCH_MAX_CALLS` |  |  | platform_env | Max xAI search tool calls |
| `GEMINI_API_KEY` | yes |  | platform_env | Optional Google Gemini key |
| `GEMINI_MODEL` |  |  | platform_env | Gemini model id |
| `TRADEOPS_AI_MODE` |  |  | platform_env | Legacy xAI mode gate _(deprecated)_ |
| `TRADEOPS_AI_DEFAULT_GENERATE` |  |  | platform_env | Legacy RAG generate default _(deprecated)_ |
| `TRADEOPS_AI_TIMEOUT_MS` |  |  | platform_env | Legacy AI timeout _(deprecated)_ |
| `ANTHROPIC_API_KEY` | yes |  | platform_env | Optional Anthropic key (adapter; not primary runtime) |
| `MISTRAL_API_KEY` | yes |  | platform_env | Optional Mistral key (adapter) |

### analytics (2)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `NEXT_PUBLIC_GA4_ENABLED` |  |  | browser_public | Enable GA4 browser tag |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` |  |  | browser_public | GA4 measurement id (public) |

### billing (10)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `STRIPE_SECRET_KEY` | yes |  | platform_env | Stripe secret for platform SaaS billing |
| `STRIPE_WEBHOOK_SECRET` | yes |  | platform_env | Stripe webhook signing secret |
| `STRIPE_PRICE_FOUNDER_MONTHLY` |  |  | platform_env | Stripe price id founder monthly |
| `STRIPE_PRICE_FOUNDER_ANNUAL` |  |  | platform_env | Stripe price id founder annual |
| `STRIPE_PRICE_PROFESSIONAL_MONTHLY` |  |  | platform_env | Stripe price id professional monthly |
| `STRIPE_PRICE_PROFESSIONAL_ANNUAL` |  |  | platform_env | Stripe price id professional annual |
| `STRIPE_PRICE_AGENCY_MONTHLY` |  |  | platform_env | Stripe price id agency monthly |
| `STRIPE_PRICE_AGENCY_ANNUAL` |  |  | platform_env | Stripe price id agency annual |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` |  |  | platform_env | Stripe price id enterprise monthly |
| `STRIPE_PRICE_ENTERPRISE_ANNUAL` |  |  | platform_env | Stripe price id enterprise annual |

### cache (1)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `REDIS_URL` | yes |  | platform_env | Redis URL for cache/queues (optional locally) |

### capital (17)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `TRADEOPS_CAPITAL_MODE` |  |  | platform_env | Capital product mode switch (UI/product layer) |
| `CAPITAL_NETWORK_ENABLED` |  |  | platform_env | Master capital network API gate (legal review) |
| `PUBLIC_CAMPAIGNS_ENABLED` |  |  | platform_env | Public campaign listings / solicitation (legal review) |
| `INVESTOR_ONBOARDING_ENABLED` |  |  | platform_env | Capital-provider KYC / accreditation onboarding |
| `PROFIT_SHARING_ENABLED` |  |  | platform_env | Profit-share funding models (legal review) |
| `EQUITY_OFFERINGS_ENABLED` |  |  | platform_env | Equity crowdfunding style offerings (legal review) |
| `POOLED_INVESTMENT_ENABLED` |  |  | platform_env | Pooled investment (disabled by default) |
| `AUTOMATED_INVESTMENT_ADVICE_ENABLED` |  |  | platform_env | Automated investment advice (must stay off without framework) |
| `CAPITAL_CUSTODY_ENABLED` |  |  | platform_env | Platform-controlled investor/campaign balances |
| `DISTRIBUTIONS_ENABLED` |  |  | platform_env | Execute capital/profit distributions |
| `MARKETPLACE_CONNECT_ENABLED` |  |  | platform_env | Stripe Connect live onboarding / platform payouts |
| `PRIVATE_AGREEMENT_LEDGER_ENABLED` |  |  | platform_env | Private agreement ledger (no public solicitation) |
| `CAPITAL_SANDBOX_ENABLED` |  |  | platform_env | Capital sandbox modeling (default ON in financial-gates code) |
| `GUARANTEED_RETURNS_ENABLED` |  |  | platform_env | Guaranteed returns (must stay off) |
| `TRADEOPS_POOLED_INVESTMENT_ENABLED` |  |  | platform_env | Legacy alias for POOLED_INVESTMENT_ENABLED _(deprecated)_ |
| `TRADEOPS_GUARANTEED_RETURNS_ENABLED` |  |  | platform_env | Legacy alias for GUARANTEED_RETURNS_ENABLED _(deprecated)_ |
| `TRADEOPS_INTERNAL_CUSTODY_ENABLED` |  |  | platform_env | Legacy alias for CAPITAL_CUSTODY_ENABLED _(deprecated)_ |

### connectors (80)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `SHOPIFY_SHOP_DOMAIN` |  |  | tenant_connector_vault | Shopify shop domain (prefer vault per tenant) |
| `SHOPIFY_ACCESS_TOKEN` | yes |  | tenant_connector_vault | Shopify Admin token (prefer vault per tenant) |
| `WOOCOMMERCE_URL` |  |  | tenant_connector_vault | WooCommerce store base URL |
| `WOOCOMMERCE_CONSUMER_KEY` | yes |  | tenant_connector_vault | WooCommerce REST consumer key |
| `WOOCOMMERCE_CONSUMER_SECRET` | yes |  | tenant_connector_vault | WooCommerce REST consumer secret |
| `BIGCOMMERCE_STORE_HASH` |  |  | tenant_connector_vault | BigCommerce store hash |
| `BIGCOMMERCE_ACCESS_TOKEN` | yes |  | tenant_connector_vault | BigCommerce access token |
| `AMAZON_SP_CLIENT_ID` | yes |  | tenant_connector_vault | Amazon SP-API client id |
| `AMAZON_SP_CLIENT_SECRET` | yes |  | tenant_connector_vault | Amazon SP-API client secret |
| `AMAZON_SP_REFRESH_TOKEN` | yes |  | tenant_connector_vault | Amazon SP-API refresh token |
| `EBAY_ACCESS_TOKEN` | yes |  | tenant_connector_vault | eBay Sell API access token |
| `GOOGLE_MERCHANT_ID` |  |  | tenant_connector_vault | Google Merchant Center account id |
| `GOOGLE_MERCHANT_ACCESS_TOKEN` | yes |  | tenant_connector_vault | Google Merchant OAuth access token |
| `GOOGLE_MERCHANT_DATA_SOURCE_ID` |  |  | tenant_connector_vault | Google Merchant data source id |
| `PAYPAL_CLIENT_ID` | yes |  | tenant_connector_vault | PayPal REST client id (merchant) |
| `PAYPAL_CLIENT_SECRET` | yes |  | tenant_connector_vault | PayPal REST client secret |
| `PAYPAL_API_BASE` |  |  | platform_env | PayPal API base (sandbox vs live) |
| `SQUARE_ACCESS_TOKEN` | yes |  | tenant_connector_vault | Square API access token |
| `SQUARE_API_BASE` |  |  | platform_env | Square API base URL |
| `EASYPOST_API_KEY` | yes |  | tenant_connector_vault | EasyPost logistics API key |
| `SHIPSTATION_API_KEY` | yes |  | tenant_connector_vault | ShipStation API key |
| `SHIPSTATION_API_SECRET` | yes |  | tenant_connector_vault | ShipStation API secret |
| `UPS_CLIENT_ID` | yes |  | tenant_connector_vault | UPS OAuth client id |
| `UPS_CLIENT_SECRET` | yes |  | tenant_connector_vault | UPS OAuth client secret |
| `FEDEX_CLIENT_ID` | yes |  | tenant_connector_vault | FedEx API client id |
| `FEDEX_CLIENT_SECRET` | yes |  | tenant_connector_vault | FedEx API client secret |
| `DHL_API_KEY` | yes |  | tenant_connector_vault | DHL API key |
| `USPS_CLIENT_ID` | yes |  | tenant_connector_vault | USPS API client id |
| `USPS_CLIENT_SECRET` | yes |  | tenant_connector_vault | USPS API client secret |
| `CANADA_POST_USERNAME` | yes |  | tenant_connector_vault | Canada Post API username |
| `CANADA_POST_PASSWORD` | yes |  | tenant_connector_vault | Canada Post API password |
| `SERPAPI_API_KEY` | yes |  | tenant_connector_vault | SerpAPI key (marketplace SERP / competitive) |
| `OPENEXCHANGERATES_APP_ID` | yes |  | tenant_connector_vault | Open Exchange Rates app id |
| `KEEPA_API_KEY` | yes |  | tenant_connector_vault | Keepa Amazon market data key |
| `ALIBABA_APP_KEY` | yes |  | tenant_connector_vault | Alibaba.com Open Platform app key |
| `ALIBABA_APP_SECRET` | yes |  | tenant_connector_vault | Alibaba.com app secret |
| `ALIEXPRESS_APP_KEY` | yes |  | tenant_connector_vault | AliExpress dropshipping app key |
| `ALIEXPRESS_APP_SECRET` | yes |  | tenant_connector_vault | AliExpress app secret |
| `INVENTORY_SOURCE_API_KEY` | yes |  | tenant_connector_vault | Inventory Source API key |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | yes |  | tenant_connector_vault | Google Ads developer token |
| `GOOGLE_ADS_REFRESH_TOKEN` | yes |  | tenant_connector_vault | Google Ads OAuth refresh token |
| `META_ACCESS_TOKEN` | yes |  | tenant_connector_vault | Meta Marketing API access token |
| `META_AD_ACCOUNT_ID` |  |  | tenant_connector_vault | Meta ad account id |
| `TIKTOK_ACCESS_TOKEN` | yes |  | tenant_connector_vault | TikTok Marketing API access token |
| `TIKTOK_ADVERTISER_ID` |  |  | tenant_connector_vault | TikTok advertiser id |
| `GA4_PROPERTY_ID` |  |  | tenant_connector_vault | GA4 property id (server reporting) |
| `GOOGLE_APPLICATION_CREDENTIALS` | yes |  | tenant_connector_vault | Path or JSON for Google service account (GA4/GCP) |
| `POSTHOG_API_KEY` | yes |  | tenant_connector_vault | PostHog project API key (tenant analytics optional) |
| `POSTHOG_HOST` |  |  | platform_env | PostHog host URL |
| `MIXPANEL_PROJECT_TOKEN` | yes |  | tenant_connector_vault | Mixpanel project token |
| `MIXPANEL_API_SECRET` | yes |  | tenant_connector_vault | Mixpanel API secret |
| `QUICKBOOKS_ACCESS_TOKEN` | yes |  | tenant_connector_vault | QuickBooks Online access token |
| `QUICKBOOKS_REALM_ID` |  |  | tenant_connector_vault | QuickBooks realm / company id |
| `XERO_ACCESS_TOKEN` | yes |  | tenant_connector_vault | Xero API access token |
| `XERO_TENANT_ID` |  |  | tenant_connector_vault | Xero tenant id |
| `AVALARA_ACCOUNT_ID` | yes |  | tenant_connector_vault | Avalara AvaTax account id |
| `AVALARA_LICENSE_KEY` | yes |  | tenant_connector_vault | Avalara license key |
| `TAXJAR_API_KEY` | yes |  | tenant_connector_vault | TaxJar API key |
| `AKENEO_CLIENT_ID` | yes |  | tenant_connector_vault | Akeneo PIM client id |
| `AKENEO_CLIENT_SECRET` | yes |  | tenant_connector_vault | Akeneo PIM client secret |
| `AKENEO_BASE_URL` |  |  | tenant_connector_vault | Akeneo instance base URL |
| `SALSIFY_API_KEY` | yes |  | tenant_connector_vault | Salsify PIM API key |
| `SALSIFY_ORG_ID` |  |  | tenant_connector_vault | Salsify organization id |
| `AUTODESK_CLIENT_ID` | yes |  | tenant_connector_vault | Autodesk Platform Services client id |
| `AUTODESK_CLIENT_SECRET` | yes |  | tenant_connector_vault | Autodesk client secret |
| `NETSUITE_ACCOUNT_ID` |  |  | tenant_connector_vault | Oracle NetSuite account id |
| `NETSUITE_CONSUMER_KEY` | yes |  | tenant_connector_vault | NetSuite consumer key |
| `NETSUITE_TOKEN_ID` | yes |  | tenant_connector_vault | NetSuite token id |
| `SAP_CLIENT_ID` | yes |  | tenant_connector_vault | SAP S/4HANA client id |
| `SAP_CLIENT_SECRET` | yes |  | tenant_connector_vault | SAP client secret |
| `SAP_BASE_URL` |  |  | tenant_connector_vault | SAP API base URL |
| `INFOR_CLIENT_ID` | yes |  | tenant_connector_vault | Infor CSI client id |
| `INFOR_CLIENT_SECRET` | yes |  | tenant_connector_vault | Infor CSI client secret |
| `INFOR_TENANT` |  |  | tenant_connector_vault | Infor tenant identifier |
| `MANHATTAN_CLIENT_ID` | yes |  | tenant_connector_vault | Manhattan WMS client id |
| `MANHATTAN_CLIENT_SECRET` | yes |  | tenant_connector_vault | Manhattan WMS client secret |
| `WINDCHILL_BASE_URL` |  |  | tenant_connector_vault | PTC Windchill base URL |
| `WINDCHILL_USER` | yes |  | tenant_connector_vault | Windchill username |
| `WINDCHILL_PASSWORD` | yes |  | tenant_connector_vault | Windchill password |
| `TRADEOPS_ALLOW_AUTHORIZED_SOURCING` |  |  | platform_env | Allow authorized sourcing tools |

### core (12)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `NODE_ENV` |  | yes | platform_env | Node environment: development \| test \| production |
| `LOG_LEVEL` |  |  | platform_env | Pino log level |
| `API_PORT` |  |  | platform_env | API listen port |
| `API_HOST` |  |  | platform_env | API bind host (prefer 127.0.0.1 locally) |
| `WEB_PORT` |  |  | platform_env | Web listen port |
| `WEB_HOST` |  |  | platform_env | Web bind host |
| `WEB_ORIGIN` |  | yes | platform_env | Browser origin for CORS and cookies |
| `API_PUBLIC_URL` |  | yes | platform_env | Public API base URL (SSR + scripts) |
| `NEXT_PUBLIC_API_PUBLIC_URL` |  |  | browser_public | Browser-visible API base URL |
| `API_TIMEOUT_MS` |  |  | platform_env | HTTP client timeout for API calls |
| `NEXT_PUBLIC_API_TIMEOUT_MS` |  |  | browser_public | Browser API timeout |
| `NEXT_PUBLIC_SITE_URL` |  |  | browser_public | Public site URL for metadata / marketing |

### database (4)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `DATABASE_URL` | yes | yes | platform_env | PostgreSQL connection string (Prisma) |
| `PRISMA_DEV_DB_PORT` |  |  | os_only | Local Prisma Dev / PGlite TCP port |
| `PRISMA_DEV_NAME` |  |  | os_only | Local Prisma Dev server name |
| `EMBEDDED_PG_PORT` |  |  | os_only | Legacy embedded Postgres port (scripts) |

### observability (1)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` |  |  | platform_env | OpenTelemetry OTLP endpoint |

### ops (10)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `ENABLE_SIMULATION_MODE` |  |  | platform_env | Explicit simulation only — never auto after provider failure |
| `TRADEOPS_SIMULATION_MODE` |  |  | platform_env | Legacy simulation flag |
| `TRADEOPS_ALLOW_PRODUCTION_SIMULATION` |  |  | platform_env | Required to allow simulation when NODE_ENV=production |
| `NEXT_PUBLIC_TRADEOPS_SIMULATION_MODE` |  |  | browser_public | UI simulation banner |
| `TRADEOPS_WEBHOOK_DRAIN_MS` |  |  | platform_env | Webhook drain interval ms |
| `TRADEOPS_CONNECTOR_PROBE_MS` |  |  | platform_env | Connector health probe interval ms |
| `TRADEOPS_LIVE_SYNC_MS` |  |  | platform_env | Live HTTP sync interval ms |
| `TRADEOPS_LIVE_SYNC_PROVIDER_COOLDOWN_MS` |  |  | platform_env | Per-provider live sync cooldown |
| `TRADEOPS_LIVE_SYNC_DISABLED` |  |  | platform_env | Disable live HTTP sync scheduler |
| `TRADEOPS_OPS_SYNC_DISABLED` |  |  | platform_env | Disable ops sync entirely |

### search (20)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `WEB_SEARCH_ENABLED` |  |  | platform_env | Master switch for public web search |
| `SEARCH_PROVIDER_PRIMARY` |  |  | platform_env | openai \| tavily \| xai |
| `SEARCH_PROVIDER_RETRIEVAL` |  |  | platform_env | Retrieval preference |
| `SEARCH_PROVIDER_INTERNAL` |  |  | platform_env | cohere \| local internal retrieval |
| `SEARCH_REQUIRE_CITATIONS` |  |  | platform_env | Require citations when search allowed |
| `SEARCH_REQUIRE_SOURCE_TIMESTAMPS` |  |  | platform_env | Prefer dated sources |
| `SEARCH_MAX_QUERIES_PER_REQUEST` |  |  | platform_env | Max search queries per agent turn |
| `SEARCH_MAX_RESULTS_PER_QUERY` |  |  | platform_env | Max results per query |
| `SEARCH_DEFAULT_CACHE_TTL_SECONDS` |  |  | platform_env | Search result cache TTL |
| `SEARCH_ALLOWED_DOMAINS` |  |  | platform_env | CSV domain allowlist |
| `SEARCH_BLOCKED_DOMAINS` |  |  | platform_env | CSV domain blocklist |
| `TAVILY_API_KEY` | yes |  | platform_env | Optional Tavily key when WEB_SEARCH_ENABLED=true |
| `TAVILY_SEARCH_ENABLED` |  |  | platform_env | Enable Tavily search adapter |
| `TAVILY_EXTRACT_ENABLED` |  |  | platform_env | Enable Tavily extract |
| `TAVILY_CRAWL_ENABLED` |  |  | platform_env | Enable Tavily crawl |
| `TAVILY_RESEARCH_ENABLED` |  |  | platform_env | Enable Tavily deep research |
| `OPENAI_API_KEY` | yes |  | platform_env | Optional OpenAI for web search / fallback generation |
| `OPENAI_MODEL` |  |  | platform_env | OpenAI chat model |
| `OPENAI_BASE_URL` |  |  | platform_env | OpenAI-compatible base URL |
| `OPENAI_WEB_SEARCH_ENABLED` |  |  | platform_env | Use OpenAI web search when key present |

### security (7)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `APP_SECRET` | yes | yes | platform_env | Session/cookie signing secret (min 16 chars; use long random in prod) |
| `CREDENTIALS_MASTER_KEY` | yes | yes | platform_env | AES master key for encrypting tenant connector credentials |
| `SESSION_TTL_HOURS` |  |  | platform_env | Session lifetime hours |
| `TRADEOPS_SECURITY_BOOT` |  |  | platform_env | Security boot mode: hard (default) \| warn |
| `TRADEOPS_ENV_VALIDATION` |  |  | platform_env | Env validation: hard (default) \| warn |
| `TRADEOPS_ALLOW_INSECURE_BIND` |  |  | platform_env | Allow non-loopback bind with weak secrets (dangerous) |
| `TRADEOPS_ALLOW_PUBLIC_FOUNDER` |  |  | platform_env | Allow founder_direct when publicly bound |

### storage (2)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `TRADEOPS_STORAGE_DIR` |  |  | platform_env | Local artifact storage root |
| `ARTIFACT_STORAGE_ROOT` |  |  | platform_env | Artifact root override |

### tenancy (5)

| Name | Secret | Prod req | Storage | Description |
|------|:------:|:--------:|---------|-------------|
| `TRADEOPS_ACCESS_MODE` |  | yes | platform_env | founder_direct \| authenticated \| multi_tenant |
| `NEXT_PUBLIC_TRADEOPS_ACCESS_MODE` |  |  | browser_public | Public access-mode hint for UI |
| `AUTH_BYPASS` |  |  | platform_env | Dev synthetic identity (never enable as production multi-tenant auth) |
| `TRADEOPS_PUBLIC_WARNING` |  |  | platform_env | Force founder-direct public deployment warning |
| `TRADEOPS_PRODUCTION_WORKSPACE` |  |  | platform_env | Mark workspace as production-class for gating |

## Tenant-scoped credential names

Merchant credentials for multi-tenant production belong in the encrypted connector vault:

- `SHOPIFY_ACCESS_TOKEN`
- `SHOPIFY_SHOP_DOMAIN`
- `WOOCOMMERCE_URL`
- `WOOCOMMERCE_CONSUMER_KEY`
- `WOOCOMMERCE_CONSUMER_SECRET`
- `BIGCOMMERCE_STORE_HASH`
- `BIGCOMMERCE_ACCESS_TOKEN`
- `AMAZON_SP_CLIENT_ID`
- `AMAZON_SP_CLIENT_SECRET`
- `AMAZON_SP_REFRESH_TOKEN`
- `EBAY_ACCESS_TOKEN`
- `GOOGLE_MERCHANT_ID`
- `GOOGLE_MERCHANT_ACCESS_TOKEN`
- `GOOGLE_MERCHANT_DATA_SOURCE_ID`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `SQUARE_ACCESS_TOKEN`
- `EASYPOST_API_KEY`
- `SHIPSTATION_API_KEY`
- `SHIPSTATION_API_SECRET`
- `UPS_CLIENT_ID`
- `UPS_CLIENT_SECRET`
- `FEDEX_CLIENT_ID`
- `FEDEX_CLIENT_SECRET`
- `DHL_API_KEY`
- `USPS_CLIENT_ID`
- `USPS_CLIENT_SECRET`
- `CANADA_POST_USERNAME`
- `CANADA_POST_PASSWORD`
- `SERPAPI_API_KEY`
- `OPENEXCHANGERATES_APP_ID`
- `KEEPA_API_KEY`
- `ALIBABA_APP_KEY`
- `ALIBABA_APP_SECRET`
- `ALIEXPRESS_APP_KEY`
- `ALIEXPRESS_APP_SECRET`
- `INVENTORY_SOURCE_API_KEY`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `TIKTOK_ACCESS_TOKEN`
- `TIKTOK_ADVERTISER_ID`
- `GA4_PROPERTY_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `POSTHOG_API_KEY`
- `MIXPANEL_PROJECT_TOKEN`
- `MIXPANEL_API_SECRET`
- `QUICKBOOKS_ACCESS_TOKEN`
- `QUICKBOOKS_REALM_ID`
- `XERO_ACCESS_TOKEN`
- `XERO_TENANT_ID`
- `AVALARA_ACCOUNT_ID`
- `AVALARA_LICENSE_KEY`
- `TAXJAR_API_KEY`
- `AKENEO_CLIENT_ID`
- `AKENEO_CLIENT_SECRET`
- `AKENEO_BASE_URL`
- `SALSIFY_API_KEY`
- `SALSIFY_ORG_ID`
- `AUTODESK_CLIENT_ID`
- `AUTODESK_CLIENT_SECRET`
- `NETSUITE_ACCOUNT_ID`
- `NETSUITE_CONSUMER_KEY`
- `NETSUITE_TOKEN_ID`
- `SAP_CLIENT_ID`
- `SAP_CLIENT_SECRET`
- `SAP_BASE_URL`
- `INFOR_CLIENT_ID`
- `INFOR_CLIENT_SECRET`
- `INFOR_TENANT`
- `MANHATTAN_CLIENT_ID`
- `MANHATTAN_CLIENT_SECRET`
- `WINDCHILL_BASE_URL`
- `WINDCHILL_USER`
- `WINDCHILL_PASSWORD`

## Aliases (legacy → canonical)

| Alias | Canonical |
|-------|-----------|
| `COHERE_MODEL` | `COHERE_CHAT_MODEL` |
| `COHERE_REQUEST_TIMEOUT_MS` | `COHERE_TIMEOUT_MS` |
| `GOOGLE_AI_API_KEY` | `GEMINI_API_KEY` |
| `GROK_API_KEY` | `XAI_API_KEY` |
| `OPENAI_CHAT_MODEL` | `OPENAI_MODEL` |
| `RETRIEVAL_ENABLED` | `COHERE_RETRIEVAL_ENABLED` |
| `TRADEOPS_AI_MODE` | `AI_PROVIDER` |
| `TRADEOPS_AI_TIMEOUT_MS` | `COHERE_TIMEOUT_MS` |
| `TRADEOPS_GUARANTEED_RETURNS_ENABLED` | `GUARANTEED_RETURNS_ENABLED` |
| `TRADEOPS_INTERNAL_CUSTODY_ENABLED` | `CAPITAL_CUSTODY_ENABLED` |
| `TRADEOPS_POOLED_INVESTMENT_ENABLED` | `POOLED_INVESTMENT_ENABLED` |
| `WEB_SEARCH_ALLOWED_DOMAINS` | `SEARCH_ALLOWED_DOMAINS` |
| `WEB_SEARCH_BLOCKED_DOMAINS` | `SEARCH_BLOCKED_DOMAINS` |
| `WEB_SEARCH_DEFAULT_CACHE_TTL_SECONDS` | `SEARCH_DEFAULT_CACHE_TTL_SECONDS` |
| `WEB_SEARCH_MAX_QUERIES_PER_REQUEST` | `SEARCH_MAX_QUERIES_PER_REQUEST` |
| `WEB_SEARCH_MAX_RESULTS_PER_QUERY` | `SEARCH_MAX_RESULTS_PER_QUERY` |
| `WEB_SEARCH_PROVIDER` | `SEARCH_PROVIDER_PRIMARY` |
| `WEB_SEARCH_REQUIRE_CITATIONS` | `SEARCH_REQUIRE_CITATIONS` |
| `WEB_SEARCH_REQUIRE_TIMESTAMPS` | `SEARCH_REQUIRE_SOURCE_TIMESTAMPS` |
| `XAI_CHAT_MODEL` | `XAI_MODEL` |

## Compromised key policy

Any API key pasted into chat, tickets, or logs is **compromised**. Rotate it; do not reuse. Leave `COHERE_API_KEY=` blank in templates.
