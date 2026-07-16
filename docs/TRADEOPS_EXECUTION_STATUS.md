# TradeOps Execution Status vs Markdown

**Date:** 2026-07-16 (rescanned)  
**Purpose:** Single source of truth for “what the docs describe” vs “what is actually built and runnable.”  
**Method:** Doc inventory + filesystem checks + live API/web smoke.  
**Full file inventory:** [TRADEOPS_MARKDOWN_SCAN.md](./TRADEOPS_MARKDOWN_SCAN.md) (41 markdown files).

---

## How to read this

| Label | Meaning |
|-------|---------|
| **DONE** | Implemented, wired, verified (or intentionally fixture/shadow) |
| **PARTIAL** | Core path works; vision depth incomplete |
| **DOC ONLY** | Described in markdown; not implemented in code |
| **BLOCKED** | Code path honest; needs external credentials/accounts |
| **OUT OF SCOPE (now)** | Explicitly not required for current local product |

Vision/product-spec docs (`TRADEOPS_PRODUCT_SPEC.md`, large architecture essays, professor-mode wishlists) describe the **target product**. They are **not** a claim that every sentence is shipped.

Operational truth = this file + `plan.md` + `TRADEOPS_IMPLEMENTATION_LEDGER.md`.

---

## 1. Operational runbooks — execution

| Doc claim | Status | Evidence |
|------------|--------|----------|
| `pnpm setup` / monorepo build | **DONE** | `package.json` scripts; CI; local builds |
| `bootstrap:local` / PGlite | **DONE** | `scripts/prisma-dev-db.mjs`, `bootstrap-local.mjs` |
| `npm start` API+Web | **DONE** | `scripts/start.mjs`; live `:4000` / `:3000` |
| `demo:loop` fixture commerce loop | **DONE** | `scripts/demo-commerce-loop.mjs`, UI button |
| `google:weekend` shadow prepare | **DONE** | `scripts/google-weekend-prepare.mjs`, automations UI |
| `e2e:smoke` | **DONE** | `scripts/e2e-smoke.mjs` (all checks passed last run) |
| CI typecheck/lint/test/build/migrate | **DONE** | `.github/workflows/ci.yml` |
| FIRST_RUN open URLs | **DONE** (docs updated if stale) | public + terminal + login/register |

---

## 2. Public website (TRADEOPS_PUBLIC_PRODUCT / plan)

| Claim | Status | Path |
|-------|--------|------|
| Landing `/` | **DONE** | `apps/web/src/app/page.tsx` |
| Product / how-it-works / integrations / pricing / security / docs / contact / about | **DONE** | `apps/web/src/app/*` |
| Solutions pages | **DONE** | `/solutions/*` (6 slugs) |
| Free tools | **DONE** | `/tools`, profit/score/policy |
| Login / register | **DONE** | `/login`, `/register` → real API |
| Privacy / terms / acceptable-use | **DONE** | legal pages (draft legal text) |
| Capability status board | **DONE** | `/status` + `GET /api/v1/public/capabilities` (25 entries live) |
| robots.txt + sitemap | **DONE** | `robots.ts`, `sitemap.ts` |
| noindex on `/app` + `/terminal` | **DONE** | metadata in layouts |

---

## 3. Auth, tenancy, security

| Claim | Status | Notes |
|-------|--------|-------|
| Register + login + session cookies | **DONE** | Nest auth + web forms |
| Logout + org switcher | **DONE** | `/app` |
| RBAC `@RequirePermissions` | **DONE** | Guards on commerce/AI/automation |
| Org scoping on private APIs | **DONE** | `requireOrg` + `organizationId` filters |
| AUTH_BYPASS local only | **DONE** | Forced off when `NODE_ENV=production` |
| Login/register rate limit | **DONE** | `AuthRateLimitService` |
| Email verification | **DOC ONLY / NOT BUILT** | Audit AUD-003 |
| Password reset | **DOC ONLY / NOT BUILT** | — |
| Encrypted connector credential vault UI | **DOC ONLY / NOT BUILT** | Env only for Google |
| Full onboarding wizard (business model, capital, risk limits) | **DOC ONLY / NOT BUILT** | Register creates org only |
| Service plans / feature gating | **DOC ONLY / NOT BUILT** | Free-all for registered orgs |

---

## 4. Commerce terminal & engine

| Claim | Status | Notes |
|-------|--------|-------|
| Scanner, signals, portfolio, cashflow, orders, approvals, connectors | **DONE** | Fixture-backed data path |
| Pipeline board | **DONE** | Real stage counts from DB |
| Product detail, rescore, listing draft, simulate | **DONE** | API + UI |
| Unit economics / score / policy / forecast baseline | **DONE** | `@tradeops/commerce-engine` |
| Neural forecasting | **STUB / NOT BUILT** | Baseline MA only |
| Watchlist | **DOC ONLY** | capability `coming_soon` |
| Billing | **DOC ONLY** | capability `coming_soon` |

---

## 5. AI operator (TRADEOPS_AI_*)

| Claim | Status | Notes |
|-------|--------|-------|
| Typed tool registry | **DONE** | `@tradeops/ai-runtime` |
| Critic + auditor + decision | **DONE** | operator cycle |
| Workspace `/terminal/ai` | **DONE** | UI + API |
| Persist OperatorRun / recommendations / shadow decisions | **DONE** | Prisma models |
| Prediction outcome evaluation | **DONE** | baseline evaluation API |
| Persistent side panel on every page | **DOC ONLY / NOT BUILT** | Full page only |
| Contextual product/order assistants | **DOC ONLY / NOT BUILT** | — |
| Free-form LLM (SpaceXAI/xAI) | **DOC ONLY / OPTIONAL** | Deterministic operator works without key |
| Auto retrain production models | **OUT OF SCOPE** | Correctly forbidden without approval |

---

## 6. Automation engine (TRADEOPS_AUTOMATION / WORKFLOW_TEMPLATES)

| Claim | Status | Notes |
|-------|--------|-------|
| 6 versioned templates in code | **DONE** | `@tradeops/workflow-engine` |
| List templates API | **DONE** | `GET /automation/workflows/templates` (6 live) |
| Run template dry/shadow | **DONE** | `POST /automation/workflows/run` |
| Consequential steps require approval | **DONE** | runner skips submit/apply |
| Visual workflow builder | **DOC ONLY / NOT BUILT** | — |
| Full DAG: wait, compensate, resume after restart | **PARTIAL / NOT FULL** | No durable workflow processor |
| All trigger families wired (webhooks, cost change, etc.) | **PARTIAL** | Families declared; not all event-driven |
| Weekend Google scheduler + prepare | **DONE (shadow)** | live post blocked |

---

## 7. Connectors & feeds

| Claim | Status | Notes |
|-------|--------|-------|
| Live-feed registry (Shopify, Amazon, eBay, AliExpress, Google, Trends) | **DONE** | registry entries only |
| Fixture supplier + marketplace | **DONE** | labeled FIXTURE |
| Google Merchant shadow feed | **DONE** | prepare + policy skip |
| Google Merchant live HTTP post | **BLOCKED** | needs OAuth + Content API client |
| Shopify GraphQL live | **BLOCKED** | needs merchant app |
| Amazon SP-API / eBay / AliExpress live | **BLOCKED** | needs auth |
| Unofficial Trends scraping as foundation | **OUT OF SCOPE** | Correctly avoided |

---

## 8. Harmonization & events

| Claim | Status | Notes |
|-------|--------|-------|
| Identity matching with confidence | **DONE** | `@tradeops/harmonization` |
| No title-only auto-merge | **DONE** | unit tests |
| CommerceEvent + webhook receipt storage | **DONE** | event fabric service |
| Full digital twin graph / all taxonomies | **PARTIAL** | foundations only |

---

## 9. Google Search / GA4 / Merchant docs

| Claim | Status | Notes |
|-------|--------|-------|
| SEO metadata helpers, robots, sitemap | **DONE** | code |
| Search Console submit / ranking | **DOC ONLY** | operator manual steps |
| GA4 privacy-safe integration | **DOC ONLY / NOT BUILT** | docs + env plan only — **no gtag component** |
| Merchant readiness dashboard (issues, eligibility UI) | **PARTIAL / NOT FULL** | weekend status UI only |

---

## 10. Deployment & release

| Claim | Status | Notes |
|-------|--------|-------|
| Dockerfiles for API/Web | **DONE** | root Dockerfiles |
| Compose for Postgres/Redis | **DONE** | docker-compose |
| Deploy docs + runbook | **DONE** | markdown |
| Staging/production deploy live | **DOC ONLY** | no cloud deployment performed here |
| Release readiness page | **DONE** | `/app/release-readiness` |

---

## 11. Milestone map (architecture/MILESTONES.md)

| Milestone | Doc status | Actual |
|-----------|------------|--------|
| M0 Platform | Complete | **DONE** |
| M1 Auth | Complete | **DONE** (login UI exists again) |
| M2a Fixtures | Complete | **DONE** |
| M2b Shopify | Next / blocked | **BLOCKED** credentials |
| M3 Terminal | Complete | **DONE** fixture-backed |
| M4 Profit | Partial | **PARTIAL** |
| M5 Automation | Pending in milestones file | **PARTIAL** (update milestones — templates + weekend exist) |
| M6 AI | Partial | **PARTIAL** |
| M7–M10 | Pending | **NOT BUILT** as full product |

---

## What is NOT executed (despite appearing in long vision/professor docs)

These remain **documented targets**, not shipped product:

1. Full multi-step **onboarding wizard** (region, capital, risk limits, first connector).  
2. **Email verify** + **password reset**.  
3. **Billing** + plan feature gates.  
4. **Visual** workflow builder + durable compensated executor.  
5. **AI side panel** on every terminal page.  
6. **Live** Shopify / Amazon / eBay / AliExpress HTTP clients.  
7. **Live** Google Merchant Content API posts.  
8. **GA4** gtag/consent implementation.  
9. **Neural** demand models.  
10. **Staging/production** cloud environments and Search Console property.  
11. Full **E2E journey suites** in CI for every commerce journey.  
12. **Encrypted multi-tenant credential vault** with UI.

---

## Live verification snapshot (this pass)

```
API health/live     → up
Web /status         → 200
public/capabilities → 25 entries
workflow templates  → 6 templates
Key files from docs → all present
GA4 component       → MISSING (docs only)
```

---

## Doc hygiene actions (executed alongside this file)

1. Correct `docs/README.md` and `FIRST_RUN.md` where they still said “no login UI”.  
2. Align `architecture/MILESTONES.md` M5/M6 with partial automation + AI operator.  
3. Keep vision docs as vision; point to this file for execution truth.

---

## Bottom line

| Bucket | Count (approx) |
|--------|----------------|
| Operational runbook claims | **Executed** |
| Public site + auth + terminal + AI shadow + workflow templates + SEO legal | **Executed** |
| Live external marketplaces | **Blocked on credentials** |
| Full professor-mode / product-spec wish list | **Not fully executed** (by design until credentials + multi-tenant hardening) |

**You have not “executed every sentence in every markdown file.”**  
You **have executed** the operational product described in `plan.md`, the implementation ledger, FIRST_RUN, and the production-audit **DONE/PARTIAL** rows. Vision and professor-mode documents intentionally overshoot current code; remaining work is listed above.
