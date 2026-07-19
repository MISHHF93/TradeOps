# Active Connectors

Only **operational** and **fixture** providers appear as active.

| Provider key | Maturity | Role | Credential env (platform) |
|--------------|----------|------|---------------------------|
| `shopify-graphql-admin` | operational | Primary live commerce | `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` |
| `fixture-supplier` | fixture | Dev supplier contract | none |
| `fixture-marketplace` | fixture | Dev marketplace contract | none |
| `stripe-api` | operational | SaaS Billing | `STRIPE_SECRET_KEY` (+ webhook secret) |
| `easypost-api` | operational | Logistics | `EASYPOST_API_KEY` |
| `tavily-search` | operational | Public web research | `TAVILY_API_KEY` |
| `cohere-ai` | operational | AI Chat/Embed/Rerank | `COHERE_API_KEY` |
| `google-analytics-4` | operational | Tenant commerce analytics | `GA4_PROPERTY_ID` |
| `posthog-api` | operational | Product analytics | `POSTHOG_API_KEY` |
| `sentry` | operational | Error tracking | `SENTRY_DSN` |
| `opentelemetry-collector` | operational | Traces/metrics | OTEL_* optional |

## Live HTTP implemented

`LIVE_HTTP_IMPLEMENTED` (network adapters in `@tradeops/connector-live-http`):

- shopify-graphql-admin  
- stripe-api  
- easypost-api  
- tavily-search  

Other operational providers are configured for health/observability and future sync; they do not fabricate data when incomplete.

## Rules

1. Fixtures implement the same interface contracts as live adapters.  
2. Fixtures never claim production/live status in UI copy.  
3. Planned providers (Amazon, eBay, Woo, …) are **not** listed here — see [FUTURE_CONNECTORS.md](./FUTURE_CONNECTORS.md).  
4. No multi-model AI routing. Cohere only.  
5. No multi-SERP web search. Tavily only.  
