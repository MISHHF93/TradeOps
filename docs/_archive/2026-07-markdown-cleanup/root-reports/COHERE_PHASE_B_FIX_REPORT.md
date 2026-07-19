# Cohere Phase B Fix Report

**Date:** 2026-07-19  
**Scope:** Professor-mode repair of Phase B generative briefing configuration  
**Secrets:** This document never contains API keys or secret material.

---

## 1. Error under repair

User-facing symptom:

> Generative briefing unavailable — AI generation blocked: set COHERE_API_KEY for Phase B narrative.

Requirements: no mock responses, no fixture narrative substitution, honest block when key missing.

---

## 2. Env load trace (source of truth)

```
scripts/start.mjs          loadDotEnv() → root .env (fill missing/empty)
        ↓ children inherit process.env
apps/api dist/main.js      loadEnv() from @tradeops/config
        ↓
packages/config            loadDotEnvFiles() then envSchema
        ↓
  Search order (first non-empty wins; empty process.env can be filled):
    1. monorepo root `.env`
    2. monorepo root `.env.local`
    3. `apps/api/.env`
    4. `apps/api/.env.local`
    5. cwd `.env` / `.env.local` if outside root
  apps/web `.env*` is intentionally NOT loaded into the API process.
        ↓
  Mirror COHERE_API_KEY / models onto process.env after Zod trim
        ↓
AiOperatorService.onModuleInit
  loadEnv() again (idempotent)
  bootstrapCohereProvider(process.env)
  bootstrapWebSearchProvider()
        ↓
runOperatorCycle → generateText → Cohere Chat V2 (Phase B)
```

### Root cause (historical)

1. **Empty env wins over file** — `scripts/start.mjs` only applied `.env` when `process.env[key] === undefined`, so an empty `COHERE_API_KEY=` in the shell blocked the real key from root `.env`.
2. **Adapter env snapshot** — Cohere adapter methods resolved keys from a closed-over `env` object; if registration raced before `loadEnv`, Phase B could see “missing” while deep health (reading live `process.env`) looked fine.
3. **Token budget** — Command A+ thinking tokens could exhaust low `maxTokens`, producing empty text and a generic “blocked” briefing even with a valid key (mitigated earlier with 2500 tokens + empty-response diagnostics).

---

## 3. Files changed

| File | Change |
|------|--------|
| `scripts/start.mjs` | Fill empty/whitespace `process.env` from root `.env` (parity with `loadDotEnvFiles`) |
| `packages/ai-runtime/src/cohere-adapter.ts` | `effectiveCohereEnv()` prefers live non-empty `process.env`; clearer `COHERE_KEY_MISSING` notes; empty HTTP-200 diagnostics |
| `packages/ai-runtime/src/provider-abstraction.ts` | Offline adapter note aligns with professor wording; no fixture substitution |
| `packages/ai-runtime/src/operator-cycle.ts` | Phase B `maxTokens: 2500`; schema `operator_briefing`; `briefingSource` provenance (prior + retained) |
| `apps/api/src/ai/ai-operator.service.ts` | `loadEnv()` + `bootstrapCohereProvider(process.env)` on module init |
| `.env.example` | Placeholders only: `COHERE_API_KEY`, models, `AI_PROVIDER=cohere` |
| `apps/web/...` (related) | Briefing provenance UI chips (`briefingSource`, Phase B latency) — no secrets |

**Not changed (already correct):**

- `GET /api/v1/ai/health?deep=true` → `probeCohereDeepHealth` (Chat V2 plain + JSON schema probe)
- Error codes: `COHERE_KEY_MISSING`, `COHERE_KEY_INVALID`, `COHERE_MODEL_INVALID`, `COHERE_RATE_LIMITED`, `COHERE_SCHEMA_INVALID`, `COHERE_PROVIDER_UNAVAILABLE`, `COHERE_OK`
- Chat V2 `response_format.type = "json_object"` + required fields; no `strict_tools` on Phase B synthesis
- `forceShadow` is opt-in for loop mode only; `synthesizeWithLlm: true` remains default for operator runs
- Server-only HTTP Cohere client (no browser SDK / no `NEXT_PUBLIC` key)

---

## 4. Verification results (2026-07-19)

### Unit tests

`pnpm --filter @tradeops/ai-runtime test` → **40/40 pass**

### Live API (after rebuild + restart)

| # | Test | Result |
|---|------|--------|
| 1 | Key absent | `COHERE_KEY_MISSING`, provider `none`, generate blocked, empty text, no fixture narrative |
| 2 | Invalid key deep probe | `configured=true`, `authenticated=false`, `errorCode=COHERE_KEY_INVALID` |
| 3 | Valid key Phase B | `briefingSource=cohere`, status `completed`, real narrative |
| 4 | Valid key + schema | Timeline: `provider=cohere … schema=operator_briefing`; `fixed_template=false` |
| 5 | API restart + deep health | `configured=true`, `authenticated=true`, `modelAvailable=true`, `structuredOutputHealthy=true`, `errorCode=COHERE_OK`, model `command-a-plus-05-2026` |
| 6 | Web frontend secrets | `apps/web/src` scan: **0** `process.env.COHERE` / `COHERE_API_KEY=` assignments |

Deep health sample shape (values only; no key):

```json
{
  "service": "tradeops-ai",
  "configured": true,
  "authenticated": true,
  "modelAvailable": true,
  "structuredOutputHealthy": true,
  "errorCode": "COHERE_OK",
  "model": "command-a-plus-05-2026",
  "keyPresent": true
}
```

---

## 5. Phase B contract (confirmed)

- **Provider:** Cohere only (Chat API V2 `https://api.cohere.com/v2/chat`)
- **Structured output:** `response_format: { type: "json_object", schema }` with all `required` fields
- **Schema id:** `operator_briefing` (narrative, topProductTitle, productCount, confidenceNote, nextAction, fixtureSourcesLabeled)
- **Prompt:** Explicit JSON request; tool evidence only; forbids stock templates
- **On failure:** Short honest block + recommendation cards; **never** a fixed multi-product essay
- **Key handling:** Trim; reject empty/whitespace; never log key material

---

## 6. Remaining blockers / notes

| Item | Status |
|------|--------|
| Redis | Optional; API may report `degraded` without Redis — does **not** block Phase B |
| Shopify / Stripe / live commerce | Optional; fixtures still valid for tool ranking |
| Windows process lifetime | Use detached stack starters (`stack-up-win` / logged `cmd` launchers); restart API after any `.env` change |
| Key rotation | If keys were pasted in chat, rotate in Cohere dashboard |
| Web production build | Ensure root `package.json` has no UTF-8 BOM (breaks Next resolve) |

---

## 7. Operator checklist after pull

1. Put key only in monorepo root `.env` (gitignored): `COHERE_API_KEY=…`
2. Rebuild: `pnpm --filter @tradeops/ai-runtime build && pnpm --filter @tradeops/api build`
3. Restart API (full stack preferred)
4. Probe: `GET http://127.0.0.1:4000/api/v1/ai/health?deep=true` → expect `COHERE_OK`
5. Run objective in UI or `POST /api/v1/ai/operator/run` → expect `briefingSource: "cohere"`

---

## 8. Summary

Phase B is **Cohere-only**, **server-side**, **env-driven**, and **honest on failure**. The configuration path from `start.mjs` / `loadEnv` through the Nest AI module was tightened so empty shell env vars cannot mask a filled root `.env`, and the adapter always prefers live non-empty `process.env` for key resolution. Live deep health and operator runs confirm real generative briefings with **no fixed template substitution**.
