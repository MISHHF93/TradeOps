# TradeOps AI Tools

Tools are **normalized capabilities**. Cohere selects tools; TradeOps executes them.

## Read tools

- `commerce.search_products`, `commerce.get_product`, `commerce.get_orders`
- `payments.get_transactions`, `payments.get_subscription`
- `logistics.get_rates`, `logistics.track_shipment`
- `analytics.get_revenue`, `analytics.compare_periods`
- `procurement.search_suppliers`, `procurement.compare_quotes`
- `research.web_search`, `research.extract_url`, `research.search_x`, …

## Write / proposal tools

Write capabilities return `awaiting_approval` — never auto-executed from model text.

Examples: `commerce.publish_listing`, `payments.issue_refund`, `procurement.create_rfq`.

## Executor guarantees

1. Tenant context from server auth only  
2. Permission checks  
3. Input validation  
4. Timeout  
5. Provenance / evidence  
6. No connector credentials to the model  

See `packages/ai-runtime/src/capability-catalog.ts` and `capability-executor.ts`.
