# Workflow Templates

All templates are versioned in `packages/workflow-engine/src/templates.ts`.

| Key | Name | Execution |
|-----|------|-----------|
| `product_opportunity_discovery` | Product Opportunity Discovery | operational_partial |
| `margin_protection` | Margin Protection | shadow_only |
| `inventory_protection` | Inventory Protection | coming_soon |
| `supplier_routing` | Supplier Routing | operational_partial |
| `delivery_exception` | Delivery Exception | coming_soon |
| `forecast_evaluation` | Forecast Evaluation | operational_partial |

Consequential external mutations require approval and live connectors. Templates never invent external success.
