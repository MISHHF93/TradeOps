# API / Provider Removal Ledger

Record of consolidations from the multi-provider registry era → approved stack.

| Item | Prior state | Decision | Notes |
|------|-------------|----------|-------|
| OpenAI live-feed + production catalog | registry-only | **REMOVE** from active | Cohere sole AI |
| Anthropic | registry-only | **REMOVE** | |
| xAI / Gemini / Mistral | registry-only | **REMOVE** | |
| SerpAPI live HTTP | partial probe/search | **REMOVE** | Replaced by Tavily |
| Amazon SP-API | registry + env probe | **DEPRECATE** → planned | No full implementation |
| eBay Sell | registry-only | **DEPRECATE** → planned | |
| WooCommerce live HTTP | partial | **DEPRECATE** → planned | Removed from LIVE_HTTP_IMPLEMENTED |
| BigCommerce | registry-only | **DEPRECATE** → planned | |
| PayPal / Square | registry-only | **REMOVE** from active | Stripe Billing only |
| ShipStation + direct carriers | registry-only | **REMOVE** from active | EasyPost only |
| Mixpanel | registry-only | **REMOVE** | PostHog retained |
| QuickBooks / Xero | registry-only | **REMOVE** from active | Accounting deferred |
| Avalara / TaxJar / Keepa / FX | registry-only | **REMOVE** from active | |
| Google Ads / Meta / TikTok | registry-only | **REMOVE** from active | Marketing deferred |
| Multi-provider AI env routing | env fallback chain | **REMOVE** | Cohere or blocked |
| `.env.example` vendor dump | dozens of blank keys | **MERGE** | Approved stack only |
| Google Merchant | package + shadow weekend | **DEPRECATE** → planned | Not primary vertical |

## Migrations

No Prisma tables dropped. No destructive schema changes. Connector installations for removed providers remain as DB rows but will not appear as active registry feeds; reconcile via ops ensure-registry / admin cleanup if needed.

## Environment variables removed from examples

All inactive vendor keys (AMAZON_*, EBAY_*, OPENAI_*, SERPAPI_*, PAYPAL_*, SHIPSTATION_*, etc.) removed from `.env.example`. See `API_STACK_RECONCILIATION.md` for full KEEP/REMOVE classification.
