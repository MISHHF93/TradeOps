# TradeOps Environment Configuration — Report

**Date:** 2026-07-17  
**Method:** Full monorepo inspection first; reconstruct typed config from real code paths.  
**Secrets:** None printed. Compromised/chat-pasted keys must be rotated and never reused.

---

## 1. Repository inspection (what exists)

| Area | Finding |
|------|---------|
| Package manager | **pnpm** workspaces (`pnpm@9.15.0`) |
| Monorepo | `apps/*`, `packages/*`, `packages/connectors/*` |
| Backend | **NestJS** `apps/api` — prefix `api/v1`, cookie sessions, CORS on `WEB_ORIGIN` |
| Frontend | **Next.js 15** `apps/web` |
| Worker | **BullMQ** + **ioredis** `apps/worker` (`REDIS_URL`, `DATABASE_URL`) |
| Database / ORM | **PostgreSQL** + **Prisma** (`@tradeops/database`); local **Prisma Dev / PGlite** port `51214` |
| Auth | Session cookies + `APP_SECRET`; `TRADEOPS_ACCESS_MODE` (`founder_direct` \| `authenticated` \| `multi_tenant`); `AUTH_BYPASS` legacy |
| Tenancy | Org-scoped data + **encrypted connector vault** (`CREDENTIALS_MASTER_KEY`) |
| AI primary | **Cohere code-first** via `@tradeops/ai-runtime` (`AI_PROVIDER=cohere`, `COHERE_*`) |
| AI optional | OpenAI, xAI, Gemini, Anthropic, Mistral adapters (not primary) |
| Search | **TradeOps Search Manager** (`WEB_SEARCH_ENABLED`, Tavily / OpenAI / xAI adapters) |
| Retrieval | Cohere **embed + rerank** (`COHERE_EMBED_MODEL`, `COHERE_RERANK_MODEL`, `COHERE_RETRIEVAL_ENABLED`) |
| Vector DB | **None dedicated** (no Pinecone/Weaviate/Qdrant) — retrieval is Cohere + app DB |
| Commerce connectors | Shopify, Woo, BigCommerce, Amazon SP, eBay, Google Merchant + `live-http` probes |
| Payments | Platform **Stripe** SaaS billing; merchant PayPal/Square in vault |
| Logistics | EasyPost, ShipStation, UPS, FedEx, DHL, USPS, Canada Post |
| Analytics | GA4 (public + property), PostHog, Mixpanel (tenant optional) |
| Redis / queues | `REDIS_URL`; BullMQ platform queue + in-process ops schedulers |
| Object storage | Local dirs `TRADEOPS_STORAGE_DIR` / `ARTIFACT_STORAGE_ROOT` (not S3-first today) |
| Email | **Not integrated** (no Resend/SendGrid/SMTP env in code) |
| Telemetry | **OTEL** endpoint optional; no Sentry DSN env in runtime code |
| Feature flags | Financial / capital gates (`financial-gates.ts`), not LaunchDarkly |
| Cron / webhooks | Worker repeat jobs; API webhook drain `TRADEOPS_WEBHOOK_DRAIN_MS`; Stripe webhook |
| Tests | package `node:test` + e2e scripts; CI secret-scan |
| CI/CD | `.github/workflows/ci.yml` (Postgres + Redis services) |
| Docker | `Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml` |
| Vercel | **No** `vercel.json` / Vercel-specific config |

---

## 2. Canonical configuration architecture

```text
Boot (apps/api)
  assertSecurityBoot(process.env)     # bind + weak-secret gates
  assertProductionEnv(process.env)    # fail-closed AI + core
  loadEnv()                           # Zod core bag (@tradeops/config)

Domain config (call-time, typed modules)
  getAiPlatformConfig()               # Cohere + search + tools
  isFinancialGateEnabled(key)         # capital legal gates
  getCapitalProductMode()
  environmentManifestPublicStatus()   # health without secrets
```

| File | Role |
|------|------|
| `packages/config/src/environment-manifest.ts` | **Source of truth** — 217 vars |
| `packages/config/src/index.ts` | Zod `loadEnv` core |
| `packages/config/src/ai-platform-config.ts` | AI / search policy |
| `packages/config/src/financial-gates.ts` | Legal capital gates |
| `packages/config/src/env-validation.ts` | Conditional fail-closed validation |
| `packages/config/src/security-boot.ts` | Public-bind / secret strength |
| `.env.example` | Full safe template |
| `.env.development.example` / `.production.example` / `.test.example` | Layered templates |
| `env.vendors.template` | Optional vendor paste sheet |
| `scripts/scan-env-keys.mjs` | Repo env scan → `_raw-env-scan.json` |
| `scripts/write-env-inventory.mjs` | Regenerates inventory MD |

**Storage classes**

| Storage | Use |
|---------|-----|
| `platform_env` | Deploy secrets / platform knobs |
| `tenant_connector_vault` | Merchant credentials (multi-tenant prod) |
| `browser_public` | `NEXT_PUBLIC_*` only (never secrets) |
| `os_only` | Local tooling (Prisma Dev ports) |

---

## 3. Counts (verified)

| Metric | Count |
|--------|------:|
| Live scan keys | ~227 (aliases included) |
| Scan keys not in manifest/aliases/vault | **0** (after noise filter) |
| `PLATFORM_ENV_MANIFEST` | **217** |
| Tenant vault names | **76** |
| Secret-flagged | **73** |
| Required in production | **9** |
| `@tradeops/config` tests | **49 pass** |
| Secret scan | **0 hits** |

**Production required:**  
`NODE_ENV`, `WEB_ORIGIN`, `API_PUBLIC_URL`, `DATABASE_URL`, `APP_SECRET`, `CREDENTIALS_MASTER_KEY`, `TRADEOPS_ACCESS_MODE`, `AI_PROVIDER`, `COHERE_API_KEY`

---

## 4. Capability → config mapping

| Capability | Config support |
|------------|----------------|
| Code-first Cohere runtime | `AI_PROVIDER=cohere`, `COHERE_*` |
| Structured responses | `AI_STRUCTURED_OUTPUT_ENABLED`, `AI_RESPONSE_MODE` |
| Tool execution | `AI_TOOL_CALLING_ENABLED`, `AI_MAX_TOOL_*`, approval gates |
| Search | `WEB_SEARCH_ENABLED` + Tavily/OpenAI |
| Retrieval | `COHERE_RETRIEVAL_ENABLED`, embed/rerank models |
| Multi-tenancy | `TRADEOPS_ACCESS_MODE`, vault policy |
| Authentication | `APP_SECRET`, access mode, session TTL |
| Database | `DATABASE_URL` |
| Commerce / logistics / ads / ERP | vault list + live-http probes |
| Platform payments | `STRIPE_*` |
| Queues | `REDIS_URL` (BullMQ worker) |
| Storage | `TRADEOPS_STORAGE_DIR` / `ARTIFACT_STORAGE_ROOT` |
| Observability | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Capital gates | All `FinancialGateKey` names (default OFF except sandbox) |
| Production deploy | `assertProductionEnv` + Docker/CI |

---

## 5. Gaps closed on this pass (demo → production alignment)

| Gap | Fix |
|-----|-----|
| Cohere missing from `PRODUCTION_CONNECTORS` | Added as **primary** AI connector (`COHERE_API_KEY`) |
| live-http `probeCredentials('cohere')` unknown | Registered `cohere: ['COHERE_API_KEY']` |
| `env:sync-keys` / `env:write-key-docs` treated xAI as primary | Rewritten **Cohere-first**; xAI optional only |
| Vendor paste templates | Regenerated with Cohere priority block |

## 6. Explicitly not invented

Do **not** add env vars for systems that do not exist in this repo today:

- Sentry DSN (no runtime Sentry integration)
- Email provider keys (no SMTP/Resend/SendGrid)
- Dedicated vector DB URLs
- Vercel-specific env
- LaunchDarkly / third-party feature-flag SaaS

If those land later, extend the **manifest first**, then templates and inventory.

---

## 7. Compromised Cohere key policy

1. Any key pasted into chat/logs is **compromised**.  
2. Rotate in the Cohere dashboard.  
3. Put **only the new** key in gitignored `.env` as `COHERE_API_KEY=...`.  
4. Never commit or paste the value.  
5. Local workspace policy: keep blank until operator sets a rotated key.

---

## 8. Operator checklist

```bash
cp .env.example .env
# set NEW rotated COHERE_API_KEY only in .env
pnpm db:pglite
pnpm db:migrate:deploy
pnpm db:seed
node scripts/start-api-with-env.mjs
# GET /api/v1/ai/health — configured, key not echoed
```

Regenerate inventory:

```bash
pnpm env:inventory
```

---

## 9. Related docs

- `docs/environment/ENVIRONMENT_INVENTORY.md` — full table by subsystem  
- `docs/environment/SECRET_MANAGEMENT.md`  
- `docs/environment/ENVIRONMENT_MIGRATION.md` — aliases  
- `docs/ai/CONFIGURATION.md`  
