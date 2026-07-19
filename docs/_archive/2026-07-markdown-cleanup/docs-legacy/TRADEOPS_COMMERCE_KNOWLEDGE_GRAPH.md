# Commerce Knowledge Graph

## Purpose

Connect products, suppliers, listings, inventory, orders, payments, shipments, workflows, risks, and learning outcomes into **one intelligence model** — not isolated KPI tables.

## Implementation (v1)

**Projection**, not a separate graph database:

* Nodes and edges derived from canonical Prisma models  
* Tenant-isolated by `organizationId`  
* API: `GET /api/v1/ecosystem/knowledge-graph`  
* UI: `/terminal/ecosystem`  

### Example edges

| From | Rel | To |
|------|-----|-----|
| CommerceCase | case_for_product | Product |
| Listing | lists_product | Product |
| CommercePayment | pays_for_order | CustomerOrder |
| CommerceCase | learning_outcome | Product |

## Long-term AI memory (roadmap)

Store and learn:

* supplier reliability  
* seasonal demand  
* merchant preferences  
* pricing behavior  
* fulfillment performance  
* workflow outcomes  

v1 uses existing prediction outcomes, case history, and operator runs. Expand as multi-connector volume grows.

## Rules

* Preserve raw external payloads (`ExternalPayload`) for audit  
* Graph edges never cross organizations  
* Forecast vs realized labels remain distinct  
