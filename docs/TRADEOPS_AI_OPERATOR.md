# TradeOps AI Operator

## Surfaces

- Full workspace: `/terminal/ai`
- API: `POST /api/v1/ai/operator/run`, `GET /api/v1/ai/tools`

## Behavior

1. Parse objective → plan  
2. Invoke typed tools only (`@tradeops/ai-runtime`)  
3. Critic + auditor passes  
4. Decision: accept / revise / downgrade / block / escalate  
5. Queue listing approvals / shadow decisions  

Default loop mode: **shadow**. Never claims external success without connector confirmation.

## Tools (v1)

listConnectorCapabilities · searchConnectedProducts · calculateContributionProfit · assessPolicyRisk · scoreOpportunity · draftListing · evaluatePredictionOutcome
