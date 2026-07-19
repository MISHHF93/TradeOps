# TradeOps AI Operator

## Surfaces

- Full workspace: `/terminal/ai`
- **Side panel on every terminal page:** floating strip (`AiSidePanel`) — shadow objectives without leaving the page
- API: `POST /api/v1/ai/operator/run`, `GET /api/v1/ai/tools`

## Behavior

1. Parse objective → plan  
2. Invoke typed tools only (`@tradeops/ai-runtime`)  
3. Critic + auditor passes  
4. Decision: accept / revise / downgrade / block / escalate  
5. Queue listing approvals / shadow decisions  
6. Meter successful runs against plan AI quota  

Default loop mode: **shadow**. Never claims external success without connector confirmation.

Under **Direct Founder Access**, the operator is available immediately with founder org context — no login step.

## Tools (v1)

listConnectorCapabilities · searchConnectedProducts · calculateContributionProfit · assessPolicyRisk · scoreOpportunity · draftListing · evaluatePredictionOutcome
