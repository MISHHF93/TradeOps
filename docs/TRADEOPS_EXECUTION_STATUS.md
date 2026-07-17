# TradeOps Execution Status vs Markdown

**Date:** 2026-07-17 (rescan #5 — process consolidation + doc alignment)  
**Purpose:** Single source of truth for “what the docs describe” vs “what is actually built and runnable.”  
**Method:** Full markdown inventory + filesystem checks + live API/web smoke.  
**Full file inventory:** [TRADEOPS_MARKDOWN_SCAN.md](./TRADEOPS_MARKDOWN_SCAN.md)  
**Conversation audit:** [TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md](./TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md)

---

## How to read this

| Label | Meaning |
|-------|---------|
| **DONE** | Implemented, wired, verified (or intentionally fixture/shadow) |
| **PARTIAL** | Core path works; vision depth incomplete |
| **DOC ONLY** | Described in markdown; not implemented in code |
| **BLOCKED** | Code path honest; needs external credentials/accounts |
| **OUT OF SCOPE (now)** | Explicitly not required for current local product |

Vision/product-spec docs describe the **target product**. They are **not** a claim that every sentence is shipped.

Operational truth = this file + `plan.md` + `TRADEOPS_IMPLEMENTATION_LEDGER.md`.

---

## 1. Operational runbooks — execution

| Doc claim | Status | Evidence |
|------------|--------|----------|
| `pnpm setup` / monorepo build | **DONE** | `package.json` scripts; CI; local builds |
| `bootstrap:local` / PGlite | **DONE** | `scripts/prisma-dev-db.mjs`, `bootstrap-local.mjs` |
| `npm start` API+Web | **DONE** | `scripts/start.mjs` |
| Direct Founder Access default | **DONE** | `TRADEOPS_ACCESS_MODE=founder_direct` → `/` → cockpit |
| `demo:loop` fixture commerce loop | **DONE** | scripts + UI button |
| `google:weekend` shadow prepare | **DONE** | shadow; live blocked |
| `e2e:smoke` | **DONE** | `scripts/e2e-smoke.mjs` |
| CI typecheck/lint/test/build/migrate | **DONE** | `.github/workflows/ci.yml` |

---

## 2. Public website

| Claim | Status | Path |
|-------|--------|------|
| Landing `/` | **DONE** | founder_direct redirects to cockpit; marketing when authenticated |
| Platform + plans | **DONE** | `/platform`, `/platform/plans` |
| Solutions (12 slugs) | **DONE** | segments + agentic + B2B narrative |
| Free tools | **DONE** | profit/score/policy |
| Login / register | **DONE** (architecture) | Redirect in founder_direct; full UI when authenticated |
| Capability honesty board | **DONE** | `/status` |
| robots + sitemap | **DONE** | includes platform + solutions |
| Optional GA4 | **DONE foundations** | env-gated `Ga4Analytics`; off by default |

---

## 3. Auth, tenancy, security

| Claim | Status | Notes |
|-------|--------|-------|
| Session auth foundation | **DONE** | retained for multi-user restore |
| Direct Founder Access | **DONE** | idempotent founder bootstrap; org-scoped |
| RBAC + org filters | **DONE** | still enforced under founder_direct |
| AUTH_BYPASS / access mode | **DONE** | central `access-mode.ts` |
| Email verify / password reset | **DOC ONLY** | public multi-tenant launch gap |
| Credential vault UI | **DOC ONLY** | env for Google today |
| Segment onboarding | **DONE foundations** | redirected under founder_direct |
| Plans / quotas / meters | **DONE foundations** | no Stripe charges |

---

## 4. Commerce terminal & engine

| Claim | Status | Notes |
|-------|--------|-------|
| Scanner, signals, portfolio, cashflow, orders, approvals, connectors | **DONE** | fixture-backed; process-first labels |
| Commerce Process board `/terminal/process` | **DONE** | CommerceCase by lifecycle stage |
| Product Journey `/terminal/process/[caseId]` | **DONE** | history + handoff + AI link |
| Listings / Fulfillment stage views | **DONE** | filtered case views (shared records) |
| Tasks + blockers + SOP templates | **DONE foundations** | derived from cases |
| Next-action engine | **DONE** | on cases, process, tasks, handoff |
| Stage transitions (validated) | **DONE** | invalid advances rejected |
| Pipeline board (legacy) | **REDIRECT** | → `/terminal/process` |
| Control tower (legacy) | **REDIRECT** | → `/terminal/cockpit` |
| Product detail + ATP + channel profit + agentic | **DONE foundations** | + CaseHandoff + Media Workspace |
| Product Media & Artifact Engine | **DONE foundations** | ProductArtifact + local storage + SSRF + channel readiness |
| Live Examples framework | **DONE foundations** | catalog + readiness + `/terminal/live-examples` |
| Watchlist | **DONE** | saved state on shared products/cases |
| Unit economics / score / policy / baseline forecast | **DONE** | commerce-engine |
| Neural forecasting | **STUB** | transparent baseline-ma-v2 (SMA×DOW×trend); not neural |
| Billing charges | **DOC ONLY** | meters exist |

---

## 5. AI operator

| Claim | Status | Notes |
|-------|--------|-------|
| Typed tools + critic/auditor | **DONE** | `@tradeops/ai-runtime` |
| Full workspace `/terminal/ai` | **DONE** | |
| Side panel on terminal pages | **DONE** | `AiSidePanel` |
| Persist runs / shadow decisions | **DONE** | |
| Free-form LLM | **OPTIONAL** | xAI when `XAI_API_KEY` set; not required for operator tools |
| RAG engine (org train/query) | **DONE** | Artifacts + hybrid dense + CSV export + `/ai/rag/*` + rebuild |
| Artifact corpus CSV | **DONE** | `artifacts-corpus.csv` at repo root; sample committed |
| Prediction engine | **DONE foundations** | train/run/evaluate/export; DemandForecast rows; not neural |
| Contextual product assistants | **PARTIAL** | product page + global panel |
| Stage-aware AI with `commerceCaseId` | **DONE foundations** | preamble + product filter + suggested objectives |

---

## 6. Automation

| Claim | Status | Notes |
|-------|--------|-------|
| 6 workflow templates | **DONE foundations** | Discovery ranks DB opportunities; inventory shadow drafts; metered |
| Weekend Google shadow | **DONE** | live post blocked |
| Visual builder / durable DAG | **DOC ONLY / PARTIAL** | |

---

## 7–10. Connectors, events, SEO, deploy

| Claim | Status |
|-------|--------|
| Fixture connectors | **DONE** |
| Live HTTP adapters (12) | **DONE foundations** | Shopify, Stripe, FX, Woo, EasyPost, SerpAPI, BigCommerce, eBay, PayPal, ShipStation, Keepa, Square — credential-gated |
| Live Shopify/Amazon/eBay/Google | **BLOCKED** credentials | Amazon/Google post still blocked; eBay HTTP ready when token set |
| Harmonization + event fabric | **DONE foundations** |
| Docker / compose / release readiness page | **DONE** |
| Local full deploy (`pnpm start` + PGlite) | **DONE** | Windows path-quoted spawn fixed in `start.mjs` |
| Cloud staging deploy | **DOC ONLY** |

---

## SaaS plan.md upgrades 1–15

| # | Item | Status |
|---|------|--------|
| 1 | Persona workspaces | **DONE foundations** |
| 2 | Tenant architecture | **PARTIAL** |
| 3 | Capability packs | **DONE foundations** |
| 4 | Usage commercial model | **PARTIAL** (no Stripe) |
| 5 | Enterprise structure | **PARTIAL** |
| 6 | B2B workspace | **PLANNED** (page only) |
| 7 | Customer intelligence | **DONE foundations** |
| 8 | ATP | **DONE foundations** |
| 9 | Channel profitability | **DONE foundations** |
| 10 | Agentic readiness | **DONE foundations** |
| 11 | Control tower | **DONE foundations** |
| 12 | Integration hub | **PLANNED** |
| 13 | BYOD | **PLANNED** |
| 14 | AI governance depth | **PARTIAL** |
| 15 | Segment onboarding | **DONE foundations** |

---

## Still NOT executed (vision / professor / enterprise)

1. Full capital/risk onboarding wizard  
2. Email verify + password reset  
3. Stripe billing charges  
4. Visual workflow builder + compensated durable executor  
5. Live marketplace HTTP clients (needs credentials)  
6. Live Google Content API posts  
7. Consent management platform for GA4  
8. Neural demand models  
9. Cloud staging + Search Console automation  
10. Full enterprise hierarchy / SSO / B2B catalogs / BYOD  

---

## Live verification (latest rescan)

```
health/live                    → 200 (full health may be degraded without Redis)
public/access-mode             → founder_direct
/ and /login                   → 307 → /terminal/cockpit
commerce/process               → open cases by stage
commerce/tasks                 → tasks + blockers + 5 SOPs
commerce/cases/by-product/:id  → journey payload
products/:id/artifacts         → bootstrap + content stream
e2e-smoke.mjs                  → pass (process + tasks + listings + fulfillment pages)
```

---

## Bottom line

| Bucket | Status |
|--------|--------|
| Operational runbooks + founder-direct local product | **Executed** |
| Product Media & Artifact Engine (local/dev) | **Executed foundations** |
| Commerce process spine (CommerceCase) | **Executed foundations** |
| Live marketplace media/publish | **Credential-blocked** |
| Full SOP auto-executor / cloud media storage | **Not executed** |
| SaaS foundations (1–5, 7–11, 15) | **Executed at foundation depth** |
| Remaining DOC ONLY / BLOCKED / enterprise vision | **Honestly incomplete** |

**You have not executed every sentence in every markdown file.**  
You **have executed** the operational product and the buildable foundations of the SaaS upgrade program. Residual gaps above require credentials, payments, or multi-quarter enterprise work.
