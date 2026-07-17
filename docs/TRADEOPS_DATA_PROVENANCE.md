# Data Provenance

## Product store fields (current)

Products carry `sourcePlatform`, costs, reviews, `dataConfidence`, `dataFreshnessAt`.  
Operator `productCard` / evidence includes:

- sourceConnector  
- isFixture  
- dataFreshnessAt  
- opportunityScore, policyOutcome  

## Labels

| Label | Meaning |
| --- | --- |
| Live | Non-fixture connector with successful auth |
| TEST FIXTURE | Fixture provider — not live marketplace |
| Estimated | Fees/shipping assumptions |
| Forecast | baseline-ma-v1 demand model |

External raw payload warehouse is partial (`ExternalPayload` model exists for some paths).
