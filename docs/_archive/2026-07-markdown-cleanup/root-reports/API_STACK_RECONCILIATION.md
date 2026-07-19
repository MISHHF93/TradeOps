# API Stack Reconciliation Report

**Date:** 2026-07-18  
**Objective:** Single deliberate production stack — remove speculative multi-provider surface area.

---

## 1. Discovery summary (pre-reconciliation)

| Class | Examples found |
|-------|----------------|
| Fully implemented (HTTP) | Shopify products/orders, Stripe payouts/balance, EasyPost trackers, SerpAPI shopping (partial) |
| Fixture-only | fixture-supplier, fixture-marketplace |
| Package partial | google-merchant (shadow weekend), WooCommerce fetch |
| Registry-only / probe-only | Amazon, eBay, PayPal, Square, ShipStation, carriers, ads, Mixpanel, QBO, Xero, Avalara, Keepa, multi-AI |
| Documentation / env-only | Large `.env.example` vendor dump |

---

## 2. Approved stack retained

| Layer | Provider | Maturity |
|-------|----------|----------|
| AI | **Cohere** Chat/Embed/Rerank | operational |
| Public research | **Tavily** | operational (sole) |
| Commerce live | **Shopify** GraphQL Admin | operational |
| Commerce dev | **Fixture supplier + marketplace** | fixture |
| Payments | **Stripe Billing** | operational |
| Logistics | **EasyPost** | operational |
| Tenant analytics | **GA4** | operational (config) |
| Product analytics | **PostHog** | operational (config) |
| Errors | **Sentry** | operational (config) |
| Tracing | **OpenTelemetry** | operational (abstraction) |
| DB | PostgreSQL / PGlite + Prisma | operational |
| Queues | Redis + BullMQ | operational (optional) |

---

## 3. Disabled / removed from active surface

### AI (removed from active routing)

- OpenAI, Anthropic, xAI, Gemini, Mistral  
- Multi-provider env fallback chain  
- Silent offline “demo synthesis” text (now **blocked** empty + note)

### Web search

- SerpAPI (adapter deprecated, returns not-in-stack)  
- Brave / Bing / Google CSE (never implemented)  

### Commerce / suppliers / marketplaces → planned only

- Amazon SP-API, eBay, WooCommerce, BigCommerce  
- Alibaba, AliExpress (planned feed entries)  
- Google Merchant demoted to planned (shadow package retained in repo, not active registry)

### Payments

- PayPal, Square, Adyen, Braintree, Stripe Connect (not registered)

### Logistics

- ShipStation, UPS/FedEx/DHL/USPS/Canada Post direct (EasyPost covers multi-carrier)

### Analytics / obs

- Mixpanel, Amplitude, Datadog, New Relic (not registered)  
- Prometheus/Grafana as app dependencies (Grafana external only)

---

## 4. Abstractions retained

| Abstraction | Purpose |
|-------------|---------|
| `AiProviderAdapter` | Future adapters possible; **Cohere only registered** |
| `WebSearchProvider` | Future search adapters possible; **Tavily only** |
| Connector fabric + business capabilities | AI never calls vendor REST |
| Canonical research tools | `researchSearchPublicWeb`, `researchExtractUrl`, `researchSearchOfficialDocumentation` |

---

## 5. Environment variable classification

| Variable | Classification |
|----------|----------------|
| NODE_ENV, LOG_LEVEL, ports, URLs | **KEEP** |
| DATABASE_URL, REDIS_URL | **KEEP** |
| APP_SECRET, CREDENTIALS_MASTER_KEY, SESSION_* | **KEEP** |
| TRADEOPS_ACCESS_MODE, AUTH_BYPASS, simulation | **KEEP** |
| COHERE_API_KEY, COHERE_*_MODEL | **KEEP** |
| TAVILY_API_KEY | **KEEP** (new sole search) |
| SHOPIFY_* | **KEEP** (prefer vault multi-tenant) |
| STRIPE_* | **KEEP** |
| EASYPOST_API_KEY | **KEEP** |
| GA4_PROPERTY_ID, POSTHOG_*, SENTRY_DSN, OTEL_* | **KEEP** |
| OPENAI_*, ANTHROPIC_*, XAI_*, SERPAPI_*, AMAZON_*, EBAY_*, PAYPAL_*, SHIPSTATION_*, WOOCOMMERCE_*, etc. | **REMOVE** from examples |
| GOOGLE_MERCHANT_* | **MOVE** optional/planned only |

Tenant store tokens: **MOVE_TO_TENANT_VAULT** for multi-tenant (schema path exists via connector installations + credentials master key).

---

## 6. Code changes (primary)

| Area | Change |
|------|--------|
| `live-feed-registry.ts` | Active stack only + planned map |
| `production-connectors.ts` | Slim operational catalog + capability map |
| `live-http` | Credential map slim; Tavily replaces SerpAPI; inactive sync fails closed |
| `provider-abstraction.ts` | Cohere-only ids; blocked offline |
| `cohere-adapter.ts` | Chat/Embed/Rerank HTTP |
| `web-search-provider.ts` | Tavily sole provider |
| `builtin-tools.ts` | Research capability tools |
| `.env.example` | Approved stack only |
| AI boot | `bootstrapCohereProvider` + `bootstrapWebSearchProvider` |

---

## 7. UI

- Status page remains capability-honesty driven (API).  
- Connector ops surfaces use `listLiveFeeds()` (active only).  
- Planned providers available via `listPlannedLiveFeeds()` for optional “Planned” sections — not connected metrics.

---

## 8. Tests & build

```
pnpm --filter @tradeops/connector-core test
pnpm --filter @tradeops/ai-runtime test
pnpm --filter @tradeops/connector-live-http test
pnpm --filter @tradeops/api build
```

Stack policy tests assert:

- Cohere-only AI policy  
- Tavily sole web search  
- Planned providers not in active feeds  
- No demo search hits without key  
- LIVE_HTTP_IMPLEMENTED excludes SerpAPI/WooCommerce  

---

## 9. Remaining manual credentials (operator action)

Place in local `.env` (never commit):

- `COHERE_API_KEY`  
- `TAVILY_API_KEY`  
- `SHOPIFY_SHOP_DOMAIN` / `SHOPIFY_ACCESS_TOKEN`  
- `STRIPE_SECRET_KEY` / webhook secret  
- `EASYPOST_API_KEY`  
- Optional: GA4, PostHog, Sentry  

---

## 10. Remaining blockers

1. Shopify multi-tenant OAuth vault UI  
2. Full Shopify webhooks productization  
3. GA4 Data API client depth  
4. PostHog browser SDK wiring (optional)  
5. Sentry/OTEL wiring depth in Nest bootstrap  
6. DB cleanup of stale connector installation rows for removed providers  

---

## 11. Completion criteria checklist

| Criterion | Status |
|-----------|--------|
| Cohere sole active AI | **Done** (policy + registry) |
| One public web search (Tavily) | **Done** |
| Shopify primary live commerce | **Done** (active) |
| Fixture supplier + marketplace | **Done** |
| Stripe Billing only | **Done** (active) |
| EasyPost primary logistics | **Done** |
| GA4 vs PostHog separated | **Done** (docs + registry) |
| Sentry + OTEL observability | **Done** (registry) |
| Inactive env keys removed from example | **Done** |
| Planned cannot appear operational | **Done** (separate planned map) |
| Capabilities not vendor ops | **Done** (research tools + fabric) |
| Fixtures labeled | **Done** |
| No demo fallback for AI/search | **Done** |
| Documentation reflects stack | **Done** |
| Tests pass | **Verify on build** |

---

## 12. Counts

| Metric | Approx. |
|--------|---------|
| Operational production connectors | 9 |
| Fixture connectors | 2 |
| Planned feed entries | ~7 |
| Removed from active production catalog | 30+ |
| Live HTTP implemented | 4 |

**Final rule honored:** Keep extension interfaces. Remove speculative implementations. Active stack reflects what TradeOps intends to operate.
