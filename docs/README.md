# TradeOps documentation index

**Status of the local product (2026-07-16):** vertical slice is **running** — no login UI, `AUTH_BYPASS`, fixture connectors, commerce terminal, PGlite path for locked-down Windows.

## Start here (operational — keep accurate)

| Doc | Purpose |
|-----|---------|
| [../README.md](../README.md) | Project overview + quick start |
| [FIRST_RUN.md](./FIRST_RUN.md) | First-time boot sequences |
| [TRADEOPS_LOCAL_SETUP.md](./TRADEOPS_LOCAL_SETUP.md) | Local setup (PGlite / Docker) |
| [WINDOWS_APP_CONTROL.md](./WINDOWS_APP_CONTROL.md) | Restricted Windows host |
| [TRADEOPS_IMPLEMENTATION_LEDGER.md](./TRADEOPS_IMPLEMENTATION_LEDGER.md) | What is REAL / FIXTURE / BLOCKED |
| [TRADEOPS_TEST_REPORT.md](./TRADEOPS_TEST_REPORT.md) | Last verified checks |

## Architecture (decisions)

| Doc | Purpose |
|-----|---------|
| [architecture/00-AUDIT.md](./architecture/00-AUDIT.md) | Early audit (see status note at top) |
| [architecture/MILESTONES.md](./architecture/MILESTONES.md) | Milestone status |
| [architecture/ADR-0001-stack-and-topology.md](./architecture/ADR-0001-stack-and-topology.md) | Stack ADR |
| [architecture/ADR-0002-connector-isolation.md](./architecture/ADR-0002-connector-isolation.md) | Connector isolation |
| [architecture/ADR-0003-tooling-without-native-binaries.md](./architecture/ADR-0003-tooling-without-native-binaries.md) | Windows App Control tooling |
| [architecture/ADR-0004-session-auth.md](./architecture/ADR-0004-session-auth.md) | Session auth (+ local bypass note) |

## Product design (vision — not all built)

| Doc | Purpose |
|-----|---------|
| [../plan.md](../plan.md) | Master plan / constitution |
| [TRADEOPS_PRODUCT_SPEC.md](./TRADEOPS_PRODUCT_SPEC.md) | Product spec |
| [TRADEOPS_ARCHITECTURE.md](./TRADEOPS_ARCHITECTURE.md) | Architecture summary |
| [TRADEOPS_DATA_MODEL.md](./TRADEOPS_DATA_MODEL.md) | Data model |
| [TRADEOPS_COMMERCE_PIPELINE.md](./TRADEOPS_COMMERCE_PIPELINE.md) | Pipeline stages |
| [TRADEOPS_CONNECTOR_STANDARD.md](./TRADEOPS_CONNECTOR_STANDARD.md) | Connector standard |
| [TRADEOPS_SIGNAL_MODEL.md](./TRADEOPS_SIGNAL_MODEL.md) | Signal model |
| [TRADEOPS_PREDICTIVE_ENGINE.md](./TRADEOPS_PREDICTIVE_ENGINE.md) | Forecasting approach |
| [TRADEOPS_RISK_POLICY.md](./TRADEOPS_RISK_POLICY.md) | Policy / risk |
| [TRADEOPS_SHOPIFY_CREDENTIALS.md](./TRADEOPS_SHOPIFY_CREDENTIALS.md) | Shopify runbook (BLOCKED without merchant creds) |
| [TRADEOPS_REPOSITORY_AUDIT.md](./TRADEOPS_REPOSITORY_AUDIT.md) | Repo audit snapshot |

## Working local commands (source of truth)

```powershell
pnpm setup                 # install + generate + build
pnpm run bootstrap:local   # PGlite if needed + migrate + seed
npm start                  # API :4000 + Web :3000
pnpm run demo:loop         # full commerce loop (or UI button)
```

Open **http://localhost:3000** → `/terminal` (no `/login` or `/register`).

### Env highlights (see `.env.example`)

- `AUTH_BYPASS=true` — local demo identity without cookies  
- `DATABASE_URL=...pgbouncer=true&connection_limit=5` — PGlite-friendly  
- `API_TIMEOUT_MS=60000` / `NEXT_PUBLIC_API_TIMEOUT_MS=60000` — web→API fetch timeout  
