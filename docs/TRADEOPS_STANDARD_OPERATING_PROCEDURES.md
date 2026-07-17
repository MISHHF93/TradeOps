# Standard Operating Procedures

**Status:** Operational templates (stage-bound)  
**Code:** `packages/commerce-engine/src/process-tasks.ts` → `SOP_TEMPLATES`

SOPs are executable procedure metadata tied to commerce stages — not documentation-only diagrams.

| SOP ID | Name | Stages covered |
|--------|------|----------------|
| `product-launch` | Product Launch | discover → publish |
| `customer-order` | Customer Order | sell → fulfill |
| `margin-protection` | Margin Protection | evaluate → publish → learn |
| `delivery-exception` | Delivery Exception | fulfill / source / approve |
| `reconciliation` | Reconciliation | reconcile → learn → closed |

Exposed via `GET /api/v1/commerce/tasks` → `sops[]`.

Cases advance through `CommerceCase` transitions; SOP steps map to the same stage IDs.
