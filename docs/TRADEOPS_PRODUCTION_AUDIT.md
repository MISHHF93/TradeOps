# TradeOps Production Audit

**Date:** 2026-07-16  
**Auditor role:** founding CTO / production-release owner  
**Scope:** complete monorepo (`apps/*`, `packages/*`, `scripts/*`, CI, docs)  
**Method:** static inspection, package tests, production build, live HTTP smoke  

---

## Executive summary

TradeOps is a **real local-first commerce OS** with:

- dual public / private surfaces;
- session auth + multi-tenant org scoping on commerce APIs;
- AI operator with typed tools, critic/auditor, shadow defaults;
- Google weekend shadow automation;
- public free tools + capability honesty board.

It is **not** ready to claim unrestricted public multichannel live automation. Critical production blockers remain around live connectors, email verification, rate limiting (partially fixed this pass), billing, Redis/worker dependency for durable queues, and full workflow persistence depth.

| Gate | Result |
|------|--------|
| Package unit tests (auth, commerce-engine, ai-runtime, harmonization, connectors) | **PASS** |
| Production Next.js build | **PASS** (SWC native blocked on App Control hosts; WASM fallback works) |
| Public routes load | **PASS** |
| Real login session | **PASS** (`founder@tradeops.local`) |
| Live marketplace connectors | **BLOCKED BY CREDENTIALS** |
| Full E2E journey suite in CI | **PARTIAL** (smoke script added; not exhaustive) |
| Public launch “ready” | **NO** — see Critical issues |

---

## Inventory (what exists)

| Area | Location | Status |
|------|----------|--------|
| Monorepo / pnpm | `package.json`, `pnpm-workspace.yaml` | OK |
| TS base | `tsconfig.base.json` | OK (strict) |
| API NestJS | `apps/api` | OK |
| Web Next 15 | `apps/web` | OK |
| Worker BullMQ | `apps/worker` | Partial (Redis optional; health degraded) |
| Prisma schema + migrations | `packages/database/prisma` | OK after professor migrations |
| Commerce engine | `packages/commerce-engine` | OK |
| AI runtime | `packages/ai-runtime` | OK |
| Harmonization | `packages/harmonization` | OK |
| Connectors | fixtures + google-merchant | Fixture OK; live blocked |
| Live-feed registry | `packages/connector-core` | OK (honest) |
| Public capabilities | `GET /api/v1/public/capabilities` | OK |
| CI | `.github/workflows/ci.yml` | OK (typecheck/lint/test/build + migrate) |
| Docker compose | `docker-compose.yml`, `infra/docker` | Present for Postgres/Redis |
| AUTH_BYPASS | config + AuthGuard | Dev only; forced off in production |

---

## Issue register

### AUD-001 · Direct identity (AUTH_BYPASS / founder_direct) without session cookie

| Field | Value |
|-------|--------|
| **Severity** | **High** if exposed on a public multi-user internet host |
| **Files** | `packages/config/src/access-mode.ts`, `apps/api/src/identity/founder-access.service.ts`, `auth.guard.ts` |
| **User impact** | Founder-operated convenience; anyone who can reach the API acts as founder org owner |
| **Security impact** | Synthetic founder identity without login form |
| **Required fix** | Use only on private perimeter; public multi-user SaaS must set `TRADEOPS_ACCESS_MODE=authenticated` |
| **Status** | **Documented + controlled** — central access mode; public-origin warning; org RBAC still applied |
| **Evidence** | `isDirectIdentityEnabled`, FounderAccessService, `GET /public/access-mode`, SECURITY_MODEL docs |

### AUD-002 · Login/register lack brute-force rate limiting (pre-fix)

| Field | Value |
|-------|--------|
| **Severity** | **High** for public launch |
| **Files** | `apps/api/src/identity/auth.controller.ts`, `auth.service.ts` |
| **User impact** | Credential stuffing risk |
| **Security impact** | Password guessing |
| **Required fix** | In-process rate limit + audit; later Redis/IP throttle |
| **Status** | **Fixed this pass** — `AuthRateLimitService` on login/register |
| **Evidence** | See auth rate-limit module + tests via manual burst |

### AUD-003 · No email verification / password reset

| Field | Value |
|-------|--------|
| **Severity** | **High** for multi-tenant public launch |
| **Files** | auth service/schema |
| **User impact** | Account recovery incomplete; email spoof registration possible |
| **Security impact** | Unverified identities |
| **Required fix** | Tokenized email verify + reset flows + mailer |
| **Status** | **Open** — documented blocker |
| **Evidence** | No verify fields in schema |

### AUD-004 · Live connectors credential-blocked (Shopify/Amazon/eBay/AliExpress/Google live)

| Field | Value |
|-------|--------|
| **Severity** | **High** for “live commerce OS” marketing claims |
| **Files** | `packages/connector-core/src/live-feed-registry.ts`, `packages/connectors/*` |
| **User impact** | Cannot execute real external posts without credentials |
| **Security impact** | Low (honest fail) |
| **Required fix** | OAuth apps + HTTP clients; never invent success |
| **Status** | **Open / intentional** — status board marks credential_blocked |
| **Evidence** | Google connector tests; weekend prepare shadow |

### AUD-005 · Google Merchant live HTTP client not fully wired

| Field | Value |
|-------|--------|
| **Severity** | **Medium** |
| **Files** | `packages/connectors/google-merchant/src/index.ts` |
| **User impact** | Shadow feed only |
| **Security impact** | None (does not claim live) |
| **Required fix** | Content API client with OAuth scopes |
| **Status** | **Open** |
| **Evidence** | Unit test “never invent live success” |

### AUD-006 · Redis down → worker queues unavailable

| Field | Value |
|-------|--------|
| **Severity** | **Medium** |
| **Files** | `apps/worker`, `apps/api/src/redis` |
| **User impact** | Health degraded; durable async jobs limited |
| **Security impact** | Low |
| **Required fix** | Managed Redis in staging/prod; optional local |
| **Status** | **Open** — API tolerates Redis down |
| **Evidence** | Health dependency redis:down |

### AUD-007 · Workflow automation engine incomplete vs product vision

| Field | Value |
|-------|--------|
| **Severity** | **High** vs full professor automation spec |
| **Files** | automation module; no durable workflow DAG executor |
| **User impact** | Templates + AI operator only partially cover automation |
| **Security impact** | N/A |
| **Required fix** | Persist definitions/runs; executor with approvals |
| **Status** | **Partial fix this pass** — workflow-engine package + API templates/runs |
| **Evidence** | New package + endpoints |

### AUD-008 · Product schema columns lagged migrations (historical)

| Field | Value |
|-------|--------|
| **Severity** | **Critical** (was breaking product queries) |
| **Files** | `schema.prisma` vs DB |
| **User impact** | 500s on scanner/AI when brand columns missing |
| **Security impact** | Availability |
| **Required fix** | Migration `20260716030000_product_provenance_columns` |
| **Status** | **Fixed** |
| **Evidence** | migrate deploy + operator run success |

### AUD-009 · Phantom Prisma relations (historical)

| Field | Value |
|-------|--------|
| **Severity** | **Critical** (generate broken) |
| **Files** | `schema.prisma` Organization/Product |
| **User impact** | Blocked client generate |
| **Security impact** | N/A |
| **Required fix** | Remove phantoms; add real professor models |
| **Status** | **Fixed** |
| **Evidence** | `prisma generate` succeeds |

### AUD-010 · Seed credentials in UI defaults

| Field | Value |
|-------|--------|
| **Severity** | **Medium** (dev UX) / Low in production if NODE_ENV production |
| **Files** | `apps/web/src/components/auth-forms.tsx` |
| **User impact** | Convenience for local seed login |
| **Security impact** | Trains users to paste demo password; remove for prod builds |
| **Required fix** | Empty defaults when not development |
| **Status** | **Fixed this pass** — defaults only when `NODE_ENV !== 'production'` |
| **Evidence** | auth-forms.tsx |

### AUD-011 · Public site incomplete vs full marketing map (pre-fix)

| Field | Value |
|-------|--------|
| **Severity** | **Medium** |
| **Files** | `apps/web/src/app/*` |
| **User impact** | Missing solutions/legal/SEO assets |
| **Security impact** | Low |
| **Required fix** | Add remaining public pages + robots/sitemap + noindex app |
| **Status** | **Fixed this pass** |
| **Evidence** | new routes + `robots.ts` + `sitemap.ts` |

### AUD-012 · No GA4 / Search Console integration

| Field | Value |
|-------|--------|
| **Severity** | **Low** for core product; Medium for growth |
| **Files** | none pre-fix |
| **User impact** | No marketing analytics |
| **Security impact** | Privacy risk if naively added |
| **Required fix** | Privacy-safe optional GA4 via env + consent |
| **Status** | **Partial** — env-gated component + docs; no hard dependency |
| **Evidence** | `AnalyticsBeacon` + TRADEOPS_GA4.md |

### AUD-013 · Feature gating / plans not enforced

| Field | Value |
|-------|--------|
| **Severity** | **Medium** for commercial launch |
| **Files** | no plan model |
| **User impact** | All features available to any registered org |
| **Security impact** | Cost abuse on AI/workflows |
| **Required fix** | Plan entitlements table + checks |
| **Status** | **Open** — documented; free evaluation assumed |
| **Evidence** | No plan schema |

### AUD-014 · E2E journeys not fully automated in CI

| Field | Value |
|-------|--------|
| **Severity** | **Medium** |
| **Files** | CI only package tests |
| **User impact** | Regressions possible |
| **Security impact** | Low |
| **Required fix** | Smoke script + expand CI |
| **Status** | **Partial** — `scripts/e2e-smoke.mjs` + CI step |
| **Evidence** | script + ci.yml |

### AUD-015 · Encrypted connector credentials storage not fully productized

| Field | Value |
|-------|--------|
| **Severity** | **High** when storing live OAuth tokens |
| **Files** | `CREDENTIALS_MASTER_KEY` in env; no vault UI |
| **User impact** | Tokens currently via env for Google |
| **Security impact** | Env secret management required |
| **Required fix** | Envelope encryption table + UI never echoing secrets |
| **Status** | **Open** |
| **Evidence** | `.env.example` only |

### AUD-016 · Tenant isolation depends on controller requireOrg (good) but needs automated cross-tenant tests in CI

| Field | Value |
|-------|--------|
| **Severity** | **Medium** |
| **Files** | commerce/ai controllers; `tenancy.isolation.test.ts` |
| **User impact** | Risk of future regression |
| **Security impact** | Cross-tenant data leak if org filter omitted |
| **Required fix** | Expand isolation tests on all new endpoints |
| **Status** | **Partial** — existing test file; keep expanding |
| **Evidence** | `apps/api/src/identity/tenancy.isolation.test.ts` |

### AUD-017 · App Control blocks native Next SWC on some Windows hosts

| Field | Value |
|-------|--------|
| **Severity** | **Low** (dev ergonomics) |
| **Files** | Next native binary |
| **User impact** | Warnings; WASM fallback works |
| **Security impact** | None |
| **Required fix** | Document; Linux CI unaffected |
| **Status** | **Documented** |
| **Evidence** | build logs |

### AUD-018 · Visual workflow builder / persistent AI side panel missing

| Field | Value |
|-------|--------|
| **Severity** | **Medium** (product completeness) |
| **Files** | web terminal |
| **User impact** | AI only on full workspace page |
| **Security impact** | None |
| **Status** | **Open** — full AI workspace exists at `/terminal/ai` |
| **Evidence** | routes |

---

## Journey verification matrix

| Journey | Trace status | Notes |
|---------|--------------|-------|
| Product intelligence | **Partial E2E** | Fixture import → score → policy → opportunity → AI rec → critic/auditor |
| Listing | **Partial** | Draft + approval operational; external connector publish credential-blocked |
| Customer order | **Partial** | Fixture ingest → PO draft → approve → fulfill → evaluate; no live webhooks verified |
| AI workflow | **Operational (shadow)** | Operator run + tools + approvals; no unrestricted live execution |
| Weekend Google | **Shadow operational** | Prepare feed + audit; live post blocked |

---

## Production health gates (current)

| Gate | Status |
|------|--------|
| Production build | Passed |
| Public routes | Passed |
| Auth enforced when AUTH_BYPASS off | Passed (code path) |
| Migrations clean | Passed (local PGlite + CI Postgres) |
| Connector honesty | Passed |
| AI tool permissions | Passed |
| Workflow full DAG | Failed / partial |
| Secrets not in frontend | Passed (no credential keys in NEXT_PUBLIC) |
| Email verify | Failed / not built |
| Billing | Not applicable / coming soon |

---

## Immediate fix log (this session)

1. Auth rate limiting on login/register.  
2. Login form seed defaults only outside production.  
3. SEO: robots.txt, sitemap, noindex on app surfaces.  
4. Legal: privacy, terms, acceptable-use; about; solutions pages.  
5. Workflow engine package + API templates/runs.  
6. Release readiness page.  
7. E2E smoke script + CI hook.  
8. Deployment docs + Dockerfiles.  
9. Full documentation set listed in section 21 of the professor prompt.

---

## Residual launch blockers (cannot claim “public multichannel live ready”)

1. Live OAuth for at least one storefront (Shopify) + one supplier path.  
2. Email verification + password reset.  
3. Managed Postgres + Redis + secrets in a non-laptop environment.  
4. Durable workflow executor with compensation/idempotency under restart.  
5. Encrypted credential vault for multi-tenant connectors.  
6. Feature limits for free evaluation.  
7. Legal counsel review of privacy/terms (pages are boilerplate placeholders).  

**Verdict:** Safe for **controlled local / private beta** with honest messaging. **Not** ready for unrestricted public “live autonomous commerce” claims.
