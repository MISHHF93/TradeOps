# TradeOps Artifact Rights & Permissions

**Status:** Operational foundations  

## Rights states

| Status | Meaning | Default listing eligibility |
|--------|---------|------------------------------|
| `merchant_owned` | Merchant created or fully owns | Eligible when channel rules pass |
| `supplier_authorized` | Supplier grants reuse under contract | Eligible when channel rules pass |
| `marketplace_limited` | Marketplace catalog / restricted | **Not** freely republished |
| `licensed` | Third-party license | Channel-specific |
| `generated` | TradeOps-generated derivative | Lineage required; check parent rights |
| `unknown` | Not verified | **Not** auto listing-eligible |
| `restricted` | Do not publish | Blocked |

## Publication pre-checks

Before channel publish:

1. Source permits reuse
2. Modification allowed (if transforming)
3. Target channel supports media type
4. No prohibited branding / watermarks (AI assist; human approval)
5. Customer media authorized
6. Regulatory docs valid for region

## Honesty

- Fixture media never claimed as production merchant photography.
- Amazon catalog images must not be implied freely copyable outside SP-API app permissions.
- Remote URL ingest always starts as `rightsStatus=unknown`.
