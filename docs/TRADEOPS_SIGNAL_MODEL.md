# Commerce Signal Model

> Baseline signals are REAL via `@tradeops/commerce-engine` + terminal signal feed.

Signals are **operational recommendations** for physical products.

| Signal | Meaning |
|--------|---------|
| BUY | Attractive sourcing opportunity |
| SELL | Suitable to list/promote on channel(s) |
| HOLD | Keep active; do not increase exposure |
| SCALE | Increase coverage / ad / capacity |
| REDUCE | Lower exposure; margin or reliability weakening |
| EXIT | Pause/remove from active selling |
| BLOCKED | Policy, safety, IP, supplier, shipping, or data-quality gate |

## Derivation (v1)

1. Policy gate → BLOCKED if blocked.  
2. Else if opportunity score ≥ 72 and margin ≥ threshold → SELL (or BUY if not yet listed).  
3. Score 55–71 → HOLD.  
4. Score &lt; 55 with active listing → REDUCE or EXIT.  
5. High score + listed + healthy → SCALE.

Always attach explanation components.
