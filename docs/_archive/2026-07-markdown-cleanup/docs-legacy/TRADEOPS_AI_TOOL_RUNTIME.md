# AI Tool Runtime

Tools are registered in `@tradeops/ai-runtime` via `registerBuiltinTools()`.

| Tool | Risk | Approval |
| --- | --- | --- |
| listConnectorCapabilities | read_only | no |
| searchConnectedProducts | read_only | no |
| calculateContributionProfit | read_only | no |
| assessPolicyRisk | read_only | no |
| draftListing | draft | no (publish separate) |
| evaluatePredictionOutcomes | read_only | no |

Host injects deps in `AiOperatorService.runObjective` (`searchProducts`, `draftListing`, …).

AI never calls frontend functions. Frontend POSTs objective; backend runs tools; DB stores progress; UI loads `GET /runs/:id`.
