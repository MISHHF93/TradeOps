# Fake / demo response removal — report

**Date:** 2026-07-17  
**Rule:** Never look healthy by hiding failure. Blocked is better than fabricated success.  
**Secrets:** not printed.

---

## Response Source Inventory (summary)

| Surface | Origin | Real / not | Notes |
|---------|--------|------------|-------|
| `POST /api/v1/ai/chat` | `runCohereAgentLoop` | Real Cohere when key set | Canonical path |
| `POST /api/v1/ai/gateway/run` | Now **same** Cohere loop | Real | Legacy demo fallback **removed** |
| `runAiGateway` | AI Adapter (OpenAI/xAI) | Optional legacy | No longer used by gateway/run; returns **blocked** if unconfigured |
| Operator cycle rankings | Deterministic scores on **DB products** | Real org data | Fixture products labeled; not AI demo text |
| Execution navigator packages | Built from org snapshot | Real + labeled fixtures | Not ChatGPT filler |
| Live examples | API run path | Real operator cycle | Shadow mode = no live writes |
| Capital opportunities page | Gate status API | Real blocked state | Not fake investments |
| Opportunities UI objectives | OperatorRun (sanitized) | Real | System prompts stripped earlier |

---

## Fake / demo / fallback paths found & fixed

| Path | Issue | Fix |
|------|-------|-----|
| `gateway/run` → `runAiGateway` when Cohere missing | Partial “success-shaped” path | Always `runCohereAgentLoop` (blocked if no key) |
| `failEnvelope` status=`failed` for missing key | Looked like infra failure | `blocked` + `AI_PROVIDER_NOT_CONFIGURED` + `requiredAction` |
| Missing key returned polished partial with empty recs | Soft demo feel | `dataMode=unavailable`, confidence 0, no recs |
| Schema fail returned raw model text as answer body | Unvalidated “success-ish” | Explicit synthesis failure; raw not treated as completed |
| Greeting without provider | Could soft-fail | Provider error → `failed`/`unavailable` |
| UI “OpenAI primary” copy | Misleading | Cohere canonical messaging + provenance strip |
| Simulation implicit in prod | Risk | `getSimulationPolicy` rejects prod sim without allow |
| AI response cache | Stale demo risk | `AI_RESPONSE_CACHE_ENABLED` default **false** |

Mocks remaining **only** in tests / fixtures / explicit simulation flags.

---

## Canonical API route

```text
POST /api/v1/ai/chat
→ auth + tenant (requireOrgId)
→ runCohereAgentLoop
→ Cohere AIProvider
→ tools / Search Manager
→ schema validate
→ TradeOpsCanonicalResponse { status, dataMode, provenance, ... }
```

Alias: `POST /api/v1/ai/gateway/run` (same loop).

Health: `GET /api/v1/ai/health` (permissions: `ai:read`).

---

## Cohere / runtime status

| Item | Status |
|------|--------|
| Provider | `AI_PROVIDER=cohere` |
| Models | `command-a-03-2025`, `embed-v4.0`, `rerank-v3.5` |
| Structured output | Local `validateSynthesisPayload` |
| Tool loop | Phase A select + execute; Phase B synthesis |
| Search | Optional; blocked/partial when needed and disabled |
| Simulation default | **false** |
| Response cache default | **false** |
| Local `COHERE_API_KEY` | Operator must set rotated key |

---

## Files changed (this pass)

- `packages/ai-runtime/src/runtime-provenance.ts` (+ tests)
- `packages/ai-runtime/src/schemas/base-response.ts` — `dataMode`, `provenance`
- `packages/ai-runtime/src/runtime/agent-loop.ts` — fail-closed + provenance
- `packages/ai-runtime/src/runtime/agent-loop.fail-closed.test.ts`
- `packages/ai-runtime/src/ai-gateway.ts` — blocked when unconfigured
- `apps/api/src/ai/ai.controller.ts` — canonical chat, `/ai/health`
- `apps/web/src/components/ai/ai-gateway-console.tsx` — status/mode/source UI
- `.env.example`, `environment-manifest.ts`

---

## Live test harness

| Resource | Path |
|----------|------|
| UI lab | `/terminal/ai/runtime-lab` (cases A–E against real chat) |
| Health | `GET /api/v1/ai/health` |
| Verify script | `pnpm verify:ai` → `scripts/verify-ai-runtime.mjs` |

## Manual steps remaining

1. Set rotated `COHERE_API_KEY` in gitignored `.env` / secret manager  
2. Restart API  
3. `pnpm verify:ai`  
4. Open `/terminal/ai/runtime-lab` (logged in) → Refresh health → Run Test A  
5. Expect with key: `status=completed`, `dataMode=live`  
6. Without key: `status=blocked`, `errorCode=AI_PROVIDER_NOT_CONFIGURED` (never demo)

```dotenv
ENABLE_SIMULATION_MODE=false
AI_RESPONSE_CACHE_ENABLED=false
AI_RUNTIME_ENABLED=true
AI_PROVIDER=cohere
```
