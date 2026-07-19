# Future / Planned Connectors

These entries may exist as **planned** registry metadata for roadmap purposes. They are:

- **not** executable  
- **not** shown as connected  
- **not** requiring platform env credentials  
- **not** advertised with full live capabilities  

| Provider key | Domain | Status |
|--------------|--------|--------|
| amazon-sp-api | marketplace | planned |
| ebay-sell | marketplace | planned |
| woocommerce-rest | storefront | planned |
| bigcommerce-rest | storefront | planned |
| google-merchant | marketplace feed | planned (shadow package exists; not primary vertical) |
| alibaba-open | supplier | planned |
| aliexpress-dropshipping | supplier | planned |
| faire, inventory-source, etc. | supplier | not registered |
| paypal-rest, square-api | payments | not registered (Stripe Billing only) |
| shipstation, UPS/FedEx/DHL/USPS direct | logistics | not registered (EasyPost) |
| openai, anthropic, xai, gemini, mistral | AI | **removed** — Cohere only |
| serpapi, brave, bing | web search | **removed** — Tavily only |
| mixpanel, amplitude | product analytics | not registered |
| datadog, new relic | observability | not registered |

## Extension contract

New providers must:

1. Implement connector manifest + fabric metadata  
2. Register as `maturity: planned` until live HTTP + tests exist  
3. Expose only **business capabilities**, never vendor REST to the UI/AI  
4. Move to `maturity: operational` only after credential-gated sync and honesty tests pass  

See packages: `@tradeops/connector-core` (`listPlannedLiveFeeds`).
