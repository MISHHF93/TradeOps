# Risk & Policy Engine

> Fail-closed policy is REAL (e.g. weapon fixture → BLOCKED).

## Fail closed

If severe risk cannot be evaluated for a high-risk category keyword, outcome is **manual_review** or **blocked**, never silent approve.

## Outcomes

`approved` | `approved_with_conditions` | `manual_review` | `blocked`

## v1 screens (keyword / category heuristics)

Weapons, alcohol, nicotine, controlled substances, counterfeit indicators, hazardous batteries without cert flag, trademark/copyright risk phrases, age-restricted.

High predicted margin **never** overrides BLOCKED policy outcome.
