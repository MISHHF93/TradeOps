# TradeOps Test Report

**Date:** 2026-07-16  
**Scope:** Direct Founder Access + Product Media & Artifact Engine  

## Artifact engine tests (2026-07-16)

| Area | Coverage | Result |
|------|----------|--------|
| SSRF URL validation | localhost, private ranges, metadata, schemes | **14 unit checks pass** (`artifact-security.test.ts`) |
| MIME allowlist | image/pdf/video vs html/js | Pass |
| Unsafe SVG | scriptable SVG reject | Pass |
| Filename sanitization | path traversal | Pass |
| Perceptual hash stability | same buffer → same hash | Pass |
| Migration `20260717040000_product_artifacts` | Applied on PGlite :51214 | Pass |
| Bootstrap idempotent | 6 artifacts, re-bootstrap stable | Live smoke pass |
| Content stream | SVG image via controlled proxy | Live smoke pass |
| SSRF reject | `10.x` / `169.254.169.254` → 400 | Live smoke pass |
| Product Media Workspace | `/terminal/products/:id` | Live page includes workspace |
| `pnpm --filter @tradeops/api build` | TypeScript compile | Pass |
| `pnpm --filter @tradeops/web build` | Production build (63 routes) | Pass |
| Pre-existing health unit | Redis mock → degraded ≠ up | 1 fail unrelated to artifacts |

## Commands run (2026-07-16)

| Command | Result |
|---------|--------|
| `pnpm --filter @tradeops/config test` | **13/13 pass** (access mode + loadEnv + bypass) |
| `pnpm --filter @tradeops/api build` | **pass** |
| `pnpm --filter @tradeops/web build` | **pass** (63 routes) |
| Live smoke | **pass** (see table below) |

### Live smoke results (rescan #4 — full deployment)

| Check | Result |
|-------|--------|
| `node scripts/e2e-smoke.mjs` | **All smoke checks passed** |
| Includes | access-mode, auth/me, saas, watchlist, AI run, workflows, **live-examples**, **artifacts bootstrap/content**, web pages |
| `GET /` · `/login` | **307** → cockpit under founder_direct |
| Full readiness health | May be **degraded** without Redis (expected) |
| Deployment docs | `TRADEOPS_DEPLOYMENT.md` expanded; `start.mjs` Windows path quote fix |

### Commerce process consolidation (2026-07-16 / re-audit 2026-07-17)

| Check | Result |
|-------|--------|
| `commerce-lifecycle` unit tests | **9/9 pass** (infer, transition, next-action) |
| `process-tasks` unit tests | **4/4 pass** |
| `commerce-engine` suite | **28/28 pass** |
| `@tradeops/api` unit suite | **32/32 pass** |
| Migration `20260717050000_commerce_cases` | Applied |
| `GET /api/v1/commerce/process` | **5 open cases** (1 blocked) |
| `GET /api/v1/commerce/tasks` | **5 tasks, 1 blocker, 5 SOPs** |
| Product artifacts completeness | **100** on bootstrapped product |
| Web build | `/terminal/process`, `/tasks`, redirects |
| Full audit matrix | [TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md](./TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md) |

### Doc tweaks this rescan

- `CONTRIBUTING.md`, `TRADEOPS_PUBLIC_PRODUCT.md`, `SECURITY_REVIEW.md`, `PRODUCTION_AUDIT` AUD-001  
- Full `TRADEOPS_MARKDOWN_SCAN.md` rewrite (45 files)  
- `e2e-smoke.mjs` founder_direct-aware (no hard dependency on password login)

## Unit coverage (access mode)

- Default mode `founder_direct`
- Parse `authenticated` / `multi_tenant`
- `founder_direct` enables direct identity in production
- Legacy `AUTH_BYPASS` alone does not enable production bypass when mode is authenticated
- Public deployment warning when WEB_ORIGIN is non-loopback
- Deterministic founder email/slug constants

## Manual / smoke checklist

| Check | Expected |
|-------|----------|
| `GET /` | 307/308 → `/terminal/cockpit` |
| `GET /login` | redirect to workspace |
| `GET /register` | redirect to workspace |
| `GET /onboarding` | redirect to workspace |
| `GET /api/v1/public/access-mode` | `mode: founder_direct` |
| `GET /api/v1/auth/me` (no cookie) | founder user + org |
| `GET /api/v1/saas/tenant` | org-scoped tenant context |
| AI operator page | loads without login |
| Login/Register buttons | hidden in public nav |
| Logout button | not shown in founder_direct |
| Connector tokens | never in browser payloads |

## Security notes validated by design

- Permissions still evaluated for owner role  
- Queries remain organization-scoped  
- Audit retains `actorUserId` when provided  
- Mode switch restores authenticated UX without schema rebuild  

## Residual gaps

- Full Playwright e2e suite not required for this host (App Control / PGlite)  
- Infrastructure IP allowlist / basic auth is operator-owned, not in-app  
