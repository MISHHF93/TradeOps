# 01 — Repository inspection (Professor Mode §1)

**Date:** 2026-07-17  
**Method:** Read monorepo structure, package manifests, boot paths, and env-key scan.  
**Secrets:** None printed. Values never recorded here.

This document is the durable §1 deliverable. Configuration reconstruction (§2+) is implemented in `@tradeops/config` and documented in `ENVIRONMENT_REPORT.md`.

---

## Stack inventory

| Question | Answer (from repository) |
|----------|---------------------------|
| Application framework | NestJS API + Next.js App Router web + BullMQ worker |
| Frontend runtime | **Next.js 15.1** + React 19 (`apps/web`) |
| Backend runtime | **NestJS 10** (`apps/api`), Node ≥ 20.11 |
| Package manager | **pnpm@9.15.0** workspaces |
| Monorepo structure | `apps/*`, `packages/*`, `packages/connectors/*` |
| Deployment provider | **Docker** (`Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml`) + **GitHub Actions** CI |
| Vercel / other PaaS | **No** `vercel.json` or Vercel-specific config |
| Database and ORM | **PostgreSQL** + **Prisma 6** (`@tradeops/database`); local Prisma Dev / PGlite `:51214` |
| Authentication | Cookie sessions (`APP_SECRET`), `TRADEOPS_ACCESS_MODE`, optional `AUTH_BYPASS` (dev/founder) |
| Tenant architecture | Org-scoped data + `CREDENTIALS_MASTER_KEY` encrypted **connector vault** |
| Cohere integration | **Primary** code-first runtime (`AI_PROVIDER=cohere`, `@tradeops/ai-runtime`) |
| Other AI providers | Optional: OpenAI, Anthropic, Gemini, xAI, Mistral (adapters / search) |
| Search provider | TradeOps Search Manager (`WEB_SEARCH_ENABLED` + Tavily / OpenAI / xAI) |
| Vector database | **None** (no Pinecone/Weaviate/Qdrant packages) |
| Retrieval | Cohere **embed + rerank** + app/DB context |
| Commerce connectors | Shopify, Woo, BigCommerce, Amazon SP, eBay, Google Merchant + registry |
| Payment integrations | Platform **Stripe** SaaS; merchant PayPal / Square (vault) |
| Logistics | EasyPost, ShipStation, UPS, FedEx, DHL, USPS, Canada Post |
| Analytics | GA4, PostHog, Mixpanel (tenant optional) |
| Redis / queues / events | `REDIS_URL` · **BullMQ** worker · API ops schedulers / webhook drain |
| Object storage | Local dirs (`TRADEOPS_STORAGE_DIR`, `ARTIFACT_STORAGE_ROOT`) — not S3-first |
| Email system | **Not present** (no Resend/SendGrid/SMTP integration) |
| Telemetry | Optional `OTEL_EXPORTER_OTLP_ENDPOINT`; no Sentry DSN runtime env |
| Feature flags | In-code financial/capital gates (not LaunchDarkly) |
| Cron jobs | Worker repeat/cron jobs (e.g. Google weekend feed); API interval schedulers |
| Webhooks | Stripe webhook; connector webhook topics; drain interval env |
| Tests | package `node:test`, e2e scripts, CI typecheck/lint/test/build |
| CI/CD | `.github/workflows/ci.yml` (Postgres 16 + Redis 7 services) |

### Apps

- `apps/api` — NestJS, global prefix `api/v1`, boots with `assertSecurityBoot` + `assertProductionEnv` + `loadEnv`
- `apps/web` — Next.js 15
- `apps/worker` — BullMQ + ioredis

### Packages (selected)

- `config` — canonical env architecture  
- `ai-runtime` — Cohere agent loop  
- `database` — Prisma  
- `auth`, `commerce-engine`, `connector-core`, `workflow-engine`, `saas-entitlements`, …  
- Connectors: `live-http`, `google-merchant`, fixtures  

---

## Env key search (names only)

Regenerate anytime:

```bash
pnpm env:scan
# → docs/environment/_raw-env-scan.json
```

| Observation | Result |
|-------------|--------|
| Scan key count | ~227 (includes aliases) |
| Keys missing from manifest + aliases + vault | **0** |
| `VITE_*` | Not used (Next.js, not Vite) |
| `SENTRY_*` | Not a runtime env contract |
| Primary AI secret name | `COHERE_API_KEY` (server-only) |

Patterns found across code (via scan / manifest, not speculative):  
`process.env`, `NEXT_PUBLIC_*`, `DATABASE_URL`, `REDIS_URL`, `COHERE_*`, `OPENAI_*`, `XAI_*`, `SHOPIFY_*`, `STRIPE_*`, `AMAZON_*`, `EBAY_*`, `EASYPOST_*`, `POSTHOG_*`, webhook-related ops flags, `CLIENT_ID` / `CLIENT_SECRET` style vendor keys in connector vault list.

---

## What configuration must support

| Capability | Env / module support |
|------------|----------------------|
| Cohere code-first AI | `AI_PROVIDER`, `COHERE_*`, `ai-platform-config` |
| Structured AI responses | `AI_STRUCTURED_OUTPUT_ENABLED`, `AI_RESPONSE_MODE` |
| Tool execution | `AI_TOOL_CALLING_ENABLED`, `AI_MAX_TOOL_*`, approval gates |
| Search | `WEB_SEARCH_ENABLED`, `SEARCH_*`, Tavily/OpenAI |
| Retrieval | `COHERE_RETRIEVAL_ENABLED`, embed/rerank models |
| Multi-tenancy | `TRADEOPS_ACCESS_MODE`, vault policy |
| Authentication | `APP_SECRET`, session TTL, access mode |
| Database | `DATABASE_URL` |
| Commerce / logistics / ads / ERP | vault + live-http probes |
| Platform payments | `STRIPE_*` |
| Analytics | GA4 public ids + tenant analytics keys |
| Queues | `REDIS_URL` |
| Storage | `TRADEOPS_STORAGE_DIR` / `ARTIFACT_STORAGE_ROOT` |
| Observability | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Production | fail-closed validation + security boot + Docker/CI |

---

## Explicitly not invented

Do not add env for systems that do not exist in this repo:

- Email provider keys  
- Sentry DSN  
- Dedicated vector DB URLs  
- Vercel-specific variables  
- Third-party feature-flag SaaS  

---

## Reconstruction status

| Item | Status |
|------|--------|
| `PLATFORM_ENV_MANIFEST` | **217** typed vars |
| Tenant vault names | **76** |
| Production required | **9** (includes `COHERE_API_KEY`) |
| Zod `loadEnv` + AI config + gates | Implemented |
| Cohere in connector registry + live-http probe | Implemented |
| Env tooling Cohere-first (not xAI-primary) | Implemented |
| Templates / inventory / secret policy docs | Present |
| Compromised Cohere key policy | Local key left blank; rotate before use |

**Canonical report:** `docs/environment/ENVIRONMENT_REPORT.md`  
**Full table:** `docs/environment/ENVIRONMENT_INVENTORY.md`  
**Secrets:** `docs/environment/SECRET_MANAGEMENT.md`  

### Production required names

1. `NODE_ENV`  
2. `WEB_ORIGIN`  
3. `API_PUBLIC_URL`  
4. `DATABASE_URL`  
5. `APP_SECRET`  
6. `CREDENTIALS_MASTER_KEY`  
7. `TRADEOPS_ACCESS_MODE`  
8. `AI_PROVIDER`  
9. `COHERE_API_KEY`  

---

## Operator note

Any Cohere credential previously exposed in chat is **compromised**. Set only a **new rotated** value in gitignored `.env`. Never commit it.
