# AI Self-Evaluation

## Stored artifacts

- `OperatorRun` — objective, plan, tool trace, critic, auditor, decision  
- `OperatorRecommendation` — evidence, assumptions, missing data, calculations, confidence  
- `ShadowDecision` — would-have-executed actions for later outcome comparison  
- `PredictionOutcome` — forecast vs actual samples  

## Metrics (governance)

Tracked via prediction evaluation + operator audit metadata:

- forecast MAE / MAPE  
- recommendation acceptance (approvals)  
- human override rate (reject decisions)  
- policy block outcomes  

Automatic production behavior changes **require** evaluation evidence, versioning, regression tests, and approval — not silent self-modify.
