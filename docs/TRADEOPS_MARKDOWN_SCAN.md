# Full Markdown Scan Report

**Scanned:** 2026-07-17 (rescan #5 — process consolidation doc alignment)  
**Scope:** All project `.md` files excluding `node_modules` / build output  

Companion: [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) — **execution truth**.  
Conversation checklist: [TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md](./TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md).

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **OPERATIONAL** | Runbook / truth — must match code |
| **STATUS** | Ledger / audit / test report |
| **DECISION** | ADR — frozen architecture choice |
| **VISION** | Product design; may exceed code |
| **HISTORICAL** | Snapshot; prefer EXECUTION_STATUS |
| **NOTES** | Working notes / professor paste |

---

## Complete inventory

### Root (4)

| File | Class | Accuracy vs code |
|------|-------|------------------|
| `README.md` | OPERATIONAL | **Aligned** (founder_direct + quick start) |
| `plan.md` | OPERATIONAL + VISION | **Aligned** operational table + upgrade matrix |
| `CONTRIBUTING.md` | OPERATIONAL | **Aligned** |
| `theme.md` | OPERATIONAL | Midnight Exchange tokens |
| `update.md` | NOTES / VISION | Not a completion checklist |

### `docs/` runbooks & status

| File | Class | Accuracy |
|------|-------|----------|
| `docs/README.md` | OPERATIONAL | **Aligned** (index updated for artifacts) |
| `docs/FIRST_RUN.md` | OPERATIONAL | **Aligned** (founder redirect table fixed) |
| `docs/TRADEOPS_LOCAL_SETUP.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_DIRECT_FOUNDER_ACCESS.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_ACCESS_MODES.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_SECURITY_MODEL.md` | OPERATIONAL | **Aligned** |
| `docs/WINDOWS_APP_CONTROL.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_EXECUTION_STATUS.md` | STATUS | **Master matrix** (rescan #5) |
| `docs/TRADEOPS_COMMERCE_LIFECYCLE.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_PROCESS_ARCHITECTURE.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_ROUTE_CONSOLIDATION.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_COMMERCE_CASE_MODEL.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_STAGE_TRANSITIONS.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_TASK_ENGINE.md` | OPERATIONAL | **Aligned** (derived tasks) |
| `docs/TRADEOPS_NEXT_ACTION_ENGINE.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_STANDARD_OPERATING_PROCEDURES.md` | OPERATIONAL | Templates executed; auto-runner partial |
| `docs/TRADEOPS_CONVERSATION_EXECUTION_AUDIT.md` | STATUS | Prompt vs code matrix |
| `docs/TRADEOPS_MARKDOWN_SCAN.md` | STATUS | This file |
| `docs/TRADEOPS_IMPLEMENTATION_LEDGER.md` | STATUS | **Aligned** (includes artifacts) |
| `docs/TRADEOPS_PRODUCTION_AUDIT.md` | STATUS | **Aligned** |
| `docs/TRADEOPS_TEST_REPORT.md` | STATUS | **Aligned** (artifact smoke) |
| `docs/TRADEOPS_SECURITY_REVIEW.md` | STATUS | **Aligned** |
| `docs/TRADEOPS_PUBLIC_PRODUCT.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_RELEASE_NOTES.md` | STATUS | Acceptable for 0.1.0 |
| `docs/TRADEOPS_RELEASE_RUNBOOK.md` | OPERATIONAL | Process docs |
| `docs/TRADEOPS_DEPLOYMENT.md` | OPERATIONAL | **Expanded** local full deploy + Windows start fix |
| `docs/TRADEOPS_REPOSITORY_AUDIT.md` | HISTORICAL | Prefer PRODUCTION_AUDIT |
| `docs/TRADEOPS_FRONTEND_BACKEND_MAP.md` | OPERATIONAL | **Aligned** (artifact routes) |
| `docs/TRADEOPS_LIVE_EXAMPLES.md` | OPERATIONAL | **Aligned** |
| `docs/TRADEOPS_LIVE_EXECUTION_AUDIT.md` | STATUS | Historical live-execution pass |
| `docs/TRADEOPS_LIVE_EXECUTION_TEST_REPORT.md` | STATUS | Historical |

### Product media & artifacts (new cluster)

| File | Class | Accuracy |
|------|-------|----------|
| `TRADEOPS_PRODUCT_ARTIFACT_MODEL.md` | OPERATIONAL | **Aligned** to Prisma + service |
| `TRADEOPS_MEDIA_PIPELINE.md` | OPERATIONAL | **Aligned** (sync path; workers partial) |
| `TRADEOPS_MEDIA_SECURITY.md` | OPERATIONAL | **Aligned** (SSRF unit-tested) |
| `TRADEOPS_ARTIFACT_RIGHTS.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_MULTIMODAL_AI.md` | OPERATIONAL | **Partial** (hooks/planned honest) |
| `TRADEOPS_CHANNEL_MEDIA_RULES.md` | OPERATIONAL | Readiness done; live publish blocked |
| `TRADEOPS_ARTIFACT_STORAGE.md` | OPERATIONAL | Local FS done; cloud adapters planned |
| `TRADEOPS_ARTIFACT_WORKFLOWS.md` | OPERATIONAL | **Aligned** |

### Feature docs

| File | Class | Accuracy |
|------|-------|----------|
| `TRADEOPS_AI_OPERATOR.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_AI_EVALUATION.md` | OPERATIONAL | Partial dashboards OK |
| `TRADEOPS_AI_TOOL_RUNTIME.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_APPROVAL_EXECUTION.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_OBJECTIVE_RUNTIME.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_AUTOMATION_ENGINE.md` | OPERATIONAL | Templates DONE; visual builder not |
| `TRADEOPS_WORKFLOW_TEMPLATES.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_WORKFLOW_DURABILITY.md` | VISION+PARTIAL | Not full durable DAG |
| `TRADEOPS_MULTI_TENANCY.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_GOOGLE_MERCHANT.md` | OPERATIONAL | Shadow only |
| `TRADEOPS_GOOGLE_SEARCH.md` | OPERATIONAL | robots/sitemap DONE |
| `TRADEOPS_GA4.md` | OPERATIONAL | Off by default |
| `TRADEOPS_SHOPIFY_CREDENTIALS.md` | OPERATIONAL | **BLOCKED** without creds |
| `TRADEOPS_COMMERCE_PIPELINE.md` | VISION+REAL | Partial depth |
| `TRADEOPS_CONNECTOR_STANDARD.md` | DECISION | **Aligned** (+ media caps) |
| `TRADEOPS_CONNECTOR_READINESS.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_ACCENT_SYSTEM.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_THEME.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_DATA_PROVENANCE.md` | OPERATIONAL | **Aligned** |

### Architecture / vision

| File | Class | Accuracy |
|------|-------|----------|
| `TRADEOPS_PRODUCT_SPEC.md` | VISION | Ahead of code (by design) |
| `TRADEOPS_ARCHITECTURE.md` | VISION | Ahead of code |
| `TRADEOPS_DATA_MODEL.md` | VISION+REAL | Partial twin (+ artifacts now) |
| `TRADEOPS_SIGNAL_MODEL.md` | OPERATIONAL | **Aligned** |
| `TRADEOPS_PREDICTIVE_ENGINE.md` | VISION+REAL | Baseline only |
| `TRADEOPS_RISK_POLICY.md` | OPERATIONAL | **Aligned** |

### ADRs / milestones

| File | Class | Accuracy |
|------|-------|----------|
| `architecture/MILESTONES.md` | STATUS | **Aligned** |
| `architecture/00-AUDIT.md` | HISTORICAL | Early snapshot |
| `architecture/ADR-0001…0004` | DECISION | **Aligned** |

---

## Stale claims corrected this rescan

| Location | Issue | Action |
|----------|-------|--------|
| `FIRST_RUN.md` | Listed `/` as public marketing site under founder default | **Fixed** — 307 → cockpit table |
| `TRADEOPS_DEPLOYMENT.md` | Thin notes only | **Expanded** full local/Docker/prod checklist |
| `docs/README.md` | Missing artifact + process links | **Fixed** |
| `TRADEOPS_EXECUTION_STATUS.md` | Missing process spine / outdated pipeline | **Fixed** rescan #5 |
| `TRADEOPS_COMMERCE_PIPELINE.md` | Still claimed `/terminal/pipeline` as primary UI | **Fixed** → Process board |
| `TRADEOPS_DATA_MODEL.md` | Missing ProductArtifact + CommerceCase | **Fixed** |
| `scripts/start.mjs` | Windows path quoting | **Fixed** |
| `scripts/e2e-smoke.mjs` | Missing process/tasks/listings | **Expanded** |

Historical files may still contain old phrases — **not** operational contracts.

---

## Execution summary (this rescan)

### Fully executed (operational)

- Founder direct access + access-mode resolver  
- Local boot (PGlite, migrate, seed, `pnpm start`)  
- Terminal commerce + watchlist + control tower + cockpit  
- Live examples framework  
- Product Media & Artifact Engine (local storage, SSRF ingest, workspace UI)  
- SaaS packs, quotas, meters, agency clients foundations  
- ATP, channel profit, customer intel, agentic readiness  
- AI operator + side panel + workflows (templates)  
- Google weekend shadow  
- Public platform/solutions/tools/status/legal/SEO  
- GA4 component (env-gated, default off)  
- CI + unit tests + expanded e2e smoke  

### Partial / blocked / vision

- Live marketplaces (credentials)  
- Cloud object storage for artifacts; async media workers  
- Multimodal AI evaluation depth  
- Stripe charges, email verify, visual workflow builder  
- Enterprise SSO / B2B / BYOD / neural forecast  
- Cloud staging deploy  

---

## Live verification commands

```powershell
pnpm e2e:smoke
# Expect: All smoke checks passed
```

| Check | Result (2026-07-16) |
|-------|---------------------|
| `GET /api/v1/health/live` | 200 up |
| `GET /api/v1/public/access-mode` | founder_direct |
| `GET /` · `/login` | 307 → `/terminal/cockpit` |
| Scanner + artifacts + live-examples | 200 |
| Product digital twin page | 200 + media workspace |
| Full `e2e-smoke.mjs` | **PASS** |

---

## Bottom line

Operational markdown matches code for the **founder-operated local product**, **SaaS foundations**, **live examples**, and **Product Media & Artifact Engine**. Vision docs still overshoot by design. Always prefer [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) over historical audits or `update.md`.
