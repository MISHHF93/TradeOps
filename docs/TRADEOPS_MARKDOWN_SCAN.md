# Full Markdown Scan Report

**Scanned:** 2026-07-16  
**Scope:** All project `.md` files excluding `node_modules` / build output  
**Count:** **41** markdown files  

Companion: [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md)

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **OPERATIONAL** | Runbook / truth — must match code |
| **STATUS** | Ledger / audit / test report of what is built |
| **DECISION** | ADR — frozen architecture choice |
| **VISION** | Product design; may exceed code |
| **HISTORICAL** | Snapshot from earlier phase; may be stale |
| **NOTES** | Working notes / paste (not product contract) |

---

## Complete inventory (41 files)

### Root (4)

| File | Lines | Class | Accuracy vs code | Notes |
|------|------:|-------|------------------|-------|
| `README.md` | ~127 | OPERATIONAL | **Aligned** (login UI note fixed this scan) | Quick start + dual surface |
| `plan.md` | ~132 | OPERATIONAL | **Aligned** | Working plan; live connectors BLOCKED |
| `CONTRIBUTING.md` | ~26 | OPERATIONAL | **Aligned** (login note fixed this scan) | Points to execution matrix |
| `update.md` | ~939 | NOTES / VISION | N/A | Professor-mode paste; **not** a completion checklist |

### `docs/` index & runbooks (6)

| File | Lines | Class | Accuracy | Notes |
|------|------:|-------|----------|-------|
| `docs/README.md` | ~76 | OPERATIONAL | **Aligned** | Doc index + execution pointer |
| `docs/FIRST_RUN.md` | ~110 | OPERATIONAL | **Aligned** | Boot sequences; login/register listed |
| `docs/TRADEOPS_LOCAL_SETUP.md` | ~57 | OPERATIONAL | **Aligned** | PGlite/Docker paths |
| `docs/WINDOWS_APP_CONTROL.md` | ~74 | OPERATIONAL | **Aligned** | App Control constraints |
| `docs/TRADEOPS_EXECUTION_STATUS.md` | ~180 | STATUS | **Aligned** | Master claim→code matrix |
| `docs/TRADEOPS_MARKDOWN_SCAN.md` | (this) | STATUS | — | Full scan report |

### Status / audit / release (9)

| File | Lines | Class | Accuracy | Notes |
|------|------:|-------|----------|-------|
| `docs/TRADEOPS_IMPLEMENTATION_LEDGER.md` | ~18 | STATUS | **Aligned** | REAL / partial / blocked table |
| `docs/TRADEOPS_PRODUCTION_AUDIT.md` | ~267 | STATUS | **Aligned** | AUD-001… issues |
| `docs/TRADEOPS_TEST_REPORT.md` | ~25 | STATUS | **Aligned** | Last package + smoke results |
| `docs/TRADEOPS_REPOSITORY_AUDIT.md` | ~54 | HISTORICAL | **Stale snapshot** | Earlier phase; prefer PRODUCTION_AUDIT |
| `docs/TRADEOPS_SECURITY_REVIEW.md` | ~18 | STATUS | **Aligned** | Gaps called out (email verify, etc.) |
| `docs/TRADEOPS_RELEASE_NOTES.md` | ~24 | STATUS | **Aligned** | 0.1.0 private beta |
| `docs/TRADEOPS_RELEASE_RUNBOOK.md` | ~21 | OPERATIONAL | **Aligned** | Process not fully run in cloud |
| `docs/TRADEOPS_DEPLOYMENT.md` | ~27 | OPERATIONAL | **Aligned** | Docs + Dockerfiles exist; no cloud deploy |
| `docs/TRADEOPS_PUBLIC_PRODUCT.md` | ~13 | OPERATIONAL | **Aligned** | Messaging rules |

### Product features (11)

| File | Lines | Class | Accuracy | Notes |
|------|------:|-------|----------|-------|
| `docs/TRADEOPS_AI_OPERATOR.md` | ~13 | OPERATIONAL | **Aligned** | Workspace + tools DONE; side panel not |
| `docs/TRADEOPS_AI_EVALUATION.md` | ~13 | OPERATIONAL | **Aligned** | Artifacts exist; full dashboards partial |
| `docs/TRADEOPS_AUTOMATION_ENGINE.md` | ~17 | OPERATIONAL | **Aligned** | Templates DONE; visual builder not |
| `docs/TRADEOPS_WORKFLOW_TEMPLATES.md` | ~11 | OPERATIONAL | **Aligned** | 6 templates |
| `docs/TRADEOPS_MULTI_TENANCY.md` | ~13 | OPERATIONAL | **Aligned** | Gaps listed |
| `docs/TRADEOPS_GOOGLE_MERCHANT.md` | ~17 | OPERATIONAL | **Aligned** | Shadow only |
| `docs/TRADEOPS_GOOGLE_SEARCH.md` | ~15 | OPERATIONAL | **Aligned** | robots/sitemap in code; Console manual |
| `docs/TRADEOPS_GA4.md` | ~12 | OPERATIONAL | **DOC ONLY for code** | Policy only; **no gtag component** |
| `docs/TRADEOPS_SHOPIFY_CREDENTIALS.md` | ~19 | OPERATIONAL | **BLOCKED** | Runbook until merchant creds |
| `docs/TRADEOPS_COMMERCE_PIPELINE.md` | ~50 | VISION+REAL | **Partial** | Stages match terminal pipeline |
| `docs/TRADEOPS_CONNECTOR_STANDARD.md` | ~11 | DECISION | **Aligned** | Isolation rule enforced |

### Architecture / vision (7)

| File | Lines | Class | Accuracy | Notes |
|------|------:|-------|----------|-------|
| `docs/TRADEOPS_PRODUCT_SPEC.md` | ~31 | VISION | **Ahead of code** | Full OS vision |
| `docs/TRADEOPS_ARCHITECTURE.md` | ~31 | VISION | **Ahead of code** | Target topology |
| `docs/TRADEOPS_DATA_MODEL.md` | ~27 | VISION+REAL | **Partial** | Core models real; full twin not |
| `docs/TRADEOPS_SIGNAL_MODEL.md` | ~19 | OPERATIONAL | **Aligned** | BUY/SELL/HOLD etc. in engine |
| `docs/TRADEOPS_PREDICTIVE_ENGINE.md` | ~20 | VISION+REAL | **Partial** | Baseline MA; neural STUB |
| `docs/TRADEOPS_RISK_POLICY.md` | ~9 | OPERATIONAL | **Aligned** | Fail-closed policy in code |

### Architecture ADRs / milestones (6)

| File | Lines | Class | Accuracy | Notes |
|------|------:|-------|----------|-------|
| `docs/architecture/MILESTONES.md` | ~48 | STATUS | **Aligned** (updated) | M5/M6 partial |
| `docs/architecture/00-AUDIT.md` | ~168 | HISTORICAL | **Early snapshot** | Prefer EXECUTION_STATUS |
| `docs/architecture/ADR-0001-stack-and-topology.md` | ~33 | DECISION | **Aligned** | Nest/Next/Prisma stack |
| `docs/architecture/ADR-0002-connector-isolation.md` | ~18 | DECISION | **Aligned** | Still binding |
| `docs/architecture/ADR-0003-tooling-without-native-binaries.md` | ~18 | DECISION | **Aligned** | App Control |
| `docs/architecture/ADR-0004-session-auth.md` | ~24 | DECISION | **Aligned** | Sessions + bypass note |

---

## Stale claims found this scan (and action)

| Location | Stale claim | Action |
|----------|-------------|--------|
| `README.md` | “no login UI” / “no `/login`” | **Fixed** — login/register present |
| `CONTRIBUTING.md` | “open `/terminal` (no login)” | **Fixed** |
| `docs/FIRST_RUN.md` / `docs/README.md` | previously “no login” | **Fixed earlier** |
| `docs/TRADEOPS_REPOSITORY_AUDIT.md` | older repo snapshot | Left as HISTORICAL; not deleted |
| `docs/architecture/00-AUDIT.md` | early architecture | Left as HISTORICAL |
| `update.md` | mega professor prompt | NOTES; not execution truth |

---

## Execution summary across all docs

### Fully executed (operational claims)

- Local boot: install, PGlite, migrate, seed, `npm start`  
- Dual public / private surfaces  
- Free tools API + UI  
- Register / login / session / rate limit  
- Terminal commerce loop (fixture-backed)  
- AI operator (typed tools, critic, auditor, shadow)  
- Workflow templates (6) list/run  
- Google weekend **shadow**  
- Harmonization identity scores  
- SEO robots + sitemap + legal draft pages  
- Capability honesty board  
- CI + unit tests + e2e smoke script  
- Dockerfiles + deploy/runbook docs  

### Partial

- Automation engine (no visual builder / full durable DAG)  
- AI (no side panel on every page; no LLM required)  
- Predictive (baseline only)  
- Google Merchant (no live post)  
- Production hardening (no cloud staging deploy done)  
- Data model / digital twin depth  

### Documented only or credential-blocked

- Live Shopify / Amazon / eBay / AliExpress  
- Live Google Content API post  
- GA4 gtag implementation  
- Email verify / password reset  
- Billing / feature gates  
- Full onboarding wizard  
- Search Console property live  
- Staging/production environments  

### Intentionally not “executed from markdown”

- Entire `update.md` professor-mode wish list  
- Full product-spec paragraphs that describe future multi-year platform  

---

## Live stack at scan time

| Check | Result |
|-------|--------|
| API `/api/v1/health/live` | **up** |
| Web `:3000` | **down** at scan moment (start with `npm start` if needed) |
| Public capabilities | **25** entries (API reachable) |

---

## Recommendation

1. Treat **`docs/TRADEOPS_EXECUTION_STATUS.md`** + **this scan** as authority.  
2. Treat **VISION** and **`update.md`** as backlog, not “done” criteria.  
3. Prefer deleting or archiving HISTORICAL audits only after team agreement (kept for now).  
4. Next implement-from-docs candidates if desired: GA4 env-gated component, email verify, Shopify live when credentials exist.
