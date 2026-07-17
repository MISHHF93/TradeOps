# TradeOps milestones

Binding rule: **complete, green verify, documented exit criteria** before advancing.

| ID | Name | Primary outcome | Status |
|----|------|-----------------|--------|
| M0 | Platform foundation | Monorepo boots; DB schema; health; CI | **Complete** |
| M1 | Auth, orgs, RBAC | Multi-tenant identity secure | **Complete** (session foundation + Direct Founder Access default; login UI when authenticated) |
| M2a | Connector framework + fixtures | Capability contracts + fixture supplier/marketplace | **Complete** (local vertical slice) |
| M2b | Shopify (real) | First real external sync | **Next** — blocked on merchant credentials |
| M3 | Commerce domain + terminal | Scanner, pipeline, portfolio, cash | **Complete** (fixture-backed + watchlist + control tower) |
| M4 | Profit + cash flow + pricing | Financial intelligence foundations | **Partial** — unit economics + channel profit + ATP + public tools |
| M5 | Automation engine | Durable configurable workflows | **Partial** — weekend Google shadow + workflow templates + meters; full DAG pending |
| M6 | AI intelligence | Jobs, artifacts, ranked insights | **Partial** — AI operator + side panel + critic/auditor + evaluation; neural STUB |
| M7 | Second connector + marketplace manager | Independence proven | Pending |
| M8 | Suppliers, shipping, payments depth | Supply & logistics breadth | Pending |
| M9 | Developer platform | API keys, SDK, outbound webhooks | Pending |
| M10 | Production hardening | SLOs, security, runbooks | **Partial** — audit + runbooks + rate limits; cloud deploy not done |

See [00-AUDIT.md](./00-AUDIT.md) for architecture.  
Auth design: [ADR-0004-session-auth.md](./ADR-0004-session-auth.md)

## M0 exit criteria

- [x] Monorepo toolchain (pnpm, TypeScript strict)
- [x] `apps/api`, `apps/web`, `apps/worker` present
- [x] Postgres schema: organizations, users, memberships, audit_events
- [x] Health endpoints with dependency checks
- [x] Docker Compose for Postgres + Redis
- [x] CI workflow
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
- [x] Lockfile committed (`pnpm-lock.yaml`)
- [x] README + architecture docs accurate
- [x] ADR-0003 for restricted Windows tooling

## M1 exit criteria

- [x] Register / login with scrypt password hashing (`@tradeops/auth`)
- [x] Server-side sessions (HTTP-only cookie + hashed token in DB)
- [x] Create org / switch active org on session
- [x] Nest global AuthGuard + PermissionsGuard (`@RequirePermissions`)
- [x] Audit events for register, login, logout, failures, org create/switch
- [x] Tenant isolation helpers + contract tests
- [x] Web: register, login, protected `/app` console, org switcher, logout (local AUTH_BYPASS still available in development)
- [x] ADR-0004 session authentication

## M2a exit criteria (fixtures — done)

- [x] `packages/connector-core` capability contracts
- [x] Fixture supplier + marketplace connectors (DEV labeled)
- [x] Canonical commerce tables + seed
- [x] Import boundary: no connector imports from web/domain
- [x] Local demo loop (`POST /terminal/demo-loop` / `pnpm run demo:loop`)

## M2b exit criteria (Shopify — preview)

- [ ] Credential vault (encrypted at rest)
- [ ] Shopify connector (OAuth, webhooks, product/order/inventory pull)
- [ ] Live “Connected” only after successful auth probe
