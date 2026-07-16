# TradeOps documentation index

**Status of the local product (2026-07-16):** dual-surface app is **running** — public website + free tools + register/sign-in + merchant terminal; fixture connectors; PGlite path for locked-down Windows; live marketplaces **credential-blocked**.

**Execution truth (read this first):** [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) — maps every major doc claim to DONE / PARTIAL / DOC ONLY / BLOCKED.

## Start here (operational — keep accurate)

| Doc | Purpose |
|-----|---------|
| [../README.md](../README.md) | Project overview + quick start |
| [FIRST_RUN.md](./FIRST_RUN.md) | First-time boot sequences |
| [TRADEOPS_LOCAL_SETUP.md](./TRADEOPS_LOCAL_SETUP.md) | Local setup (PGlite / Docker) |
| [WINDOWS_APP_CONTROL.md](./WINDOWS_APP_CONTROL.md) | Restricted Windows host |
| [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) | **Doc claims vs built code** |
| [TRADEOPS_MARKDOWN_SCAN.md](./TRADEOPS_MARKDOWN_SCAN.md) | Full inventory of all 41 markdown files |
| [TRADEOPS_IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) | What is REAL / FIXTURE / BLOCKED |
| [TRADEOPS_PRODUCTION_AUDIT.md](./TRADEOPS_PRODUCTION_AUDIT.md) | Production audit issues |
| [TRADEOPS_TEST_REPORT.md](./TRADEOPS_TEST_REPORT.md) | Last verified checks |

## Public launch & ops

| Doc | Purpose |
|-----|---------|
| [TRADEOPS_PUBLIC_PRODUCT.md](./TRADEOPS_PUBLIC_PRODUCT.md) | Public messaging rules |
| [TRADEOPS_AUTOMATION_ENGINE.md](./TRADEOPS_AUTOMATION_ENGINE.md) | Workflows (partial) |
| [TRADEOPS_WORKFLOW_TEMPLATES.md](./TRADEOPS_WORKFLOW_TEMPLATES.md) | Template catalog |
| [TRADEOPS_AI_OPERATOR.md](./TRADEOPS_AI_OPERATOR.md) | AI operator |
| [TRADEOPS_AI_EVALUATION.md](./TRADEOPS_AI_EVALUATION.md) | Self-evaluation artifacts |
| [TRADEOPS_MULTI_TENANCY.md](./TRADEOPS_MULTI_TENANCY.md) | Tenancy |
| [TRADEOPS_SECURITY_REVIEW.md](./TRADEOPS_SECURITY_REVIEW.md) | Security gates |
| [TRADEOPS_GOOGLE_SEARCH.md](./TRADEOPS_GOOGLE_SEARCH.md) | SEO / Search Console steps |
| [TRADEOPS_GA4.md](./TRADEOPS_GA4.md) | Analytics policy (**docs; gtag not wired**) |
| [TRADEOPS_GOOGLE_MERCHANT.md](./TRADEOPS_GOOGLE_MERCHANT.md) | Merchant connector (shadow) |
| [TRADEOPS_DEPLOYMENT.md](./TRADEOPS_DEPLOYMENT.md) | Deploy notes |
| [TRADEOPS_RELEASE_RUNBOOK.md](./TRADEOPS_RELEASE_RUNBOOK.md) | Release process |
| [TRADEOPS_RELEASE_NOTES.md](./TRADEOPS_RELEASE_NOTES.md) | 0.1.0 notes |

## Architecture (decisions)

| Doc | Purpose |
|-----|---------|
| [architecture/00-AUDIT.md](./architecture/00-AUDIT.md) | Early audit (historical) |
| [architecture/MILESTONES.md](./architecture/MILESTONES.md) | Milestone status |
| [architecture/ADR-0001-stack-and-topology.md](./architecture/ADR-0001-stack-and-topology.md) | Stack ADR |
| [architecture/ADR-0002-connector-isolation.md](./architecture/ADR-0002-connector-isolation.md) | Connector isolation |
| [architecture/ADR-0003-tooling-without-native-binaries.md](./architecture/ADR-0003-tooling-without-native-binaries.md) | Windows App Control tooling |
| [architecture/ADR-0004-session-auth.md](./architecture/ADR-0004-session-auth.md) | Session auth (+ local bypass note) |

## Product design (vision — not all built)

| Doc | Purpose |
|-----|---------|
| [../plan.md](../plan.md) | Working plan (execution-oriented) |
| [TRADEOPS_PRODUCT_SPEC.md](./TRADEOPS_PRODUCT_SPEC.md) | Product vision |
| [TRADEOPS_ARCHITECTURE.md](./TRADEOPS_ARCHITECTURE.md) | Architecture summary |
| [TRADEOPS_DATA_MODEL.md](./TRADEOPS_DATA_MODEL.md) | Data model |
| [TRADEOPS_COMMERCE_PIPELINE.md](./TRADEOPS_COMMERCE_PIPELINE.md) | Pipeline stages |
| [TRADEOPS_CONNECTOR_STANDARD.md](./TRADEOPS_CONNECTOR_STANDARD.md) | Connector standard |
| [TRADEOPS_SIGNAL_MODEL.md](./TRADEOPS_SIGNAL_MODEL.md) | Signal model |
| [TRADEOPS_PREDICTIVE_ENGINE.md](./TRADEOPS_PREDICTIVE_ENGINE.md) | Forecasting approach |
| [TRADEOPS_RISK_POLICY.md](./TRADEOPS_RISK_POLICY.md) | Policy / risk |
| [TRADEOPS_SHOPIFY_CREDENTIALS.md](./TRADEOPS_SHOPIFY_CREDENTIALS.md) | Shopify runbook (**BLOCKED** without merchant creds) |
| [TRADEOPS_REPOSITORY_AUDIT.md](./TRADEOPS_REPOSITORY_AUDIT.md) | Earlier repo audit snapshot |

## Working local commands

```powershell
pnpm setup                 # install + generate + build
pnpm run bootstrap:local   # PGlite if needed + migrate + seed
npm start                  # API :4000 + Web :3000
pnpm run demo:loop         # fixture commerce loop
pnpm e2e:smoke             # smoke against running stack
```

Open:

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Public website |
| http://localhost:3000/login | Sign in (real session) |
| http://localhost:3000/register | Register org |
| http://localhost:3000/tools | Free tools |
| http://localhost:3000/status | Capability honesty board |
| http://localhost:3000/terminal | Merchant terminal |
| http://localhost:3000/terminal/ai | AI operator |

### Env highlights (see `.env.example`)

- `AUTH_BYPASS=true` — local demo identity without cookies (off in production)  
- `DATABASE_URL=...pgbouncer=true&connection_limit=5` — PGlite-friendly  
- `API_TIMEOUT_MS=60000` / `NEXT_PUBLIC_API_TIMEOUT_MS=60000` — web→API fetch timeout  
- Optional: `GOOGLE_MERCHANT_*` for live path (still no fabricated success without API client)
