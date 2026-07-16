# Contributing to TradeOps

## Docs

- Index: [docs/README.md](docs/README.md)  
- Keep **operational** docs (FIRST_RUN, LOCAL_SETUP, README quick start) aligned with `package.json` scripts.  
- Mark vision docs clearly vs REAL implementation ([IMPLEMENTATION_LEDGER](docs/TRADEOPS_IMPLEMENTATION_LEDGER.md)).  
- Full doc ↔ code matrix: [TRADEOPS_EXECUTION_STATUS.md](docs/TRADEOPS_EXECUTION_STATUS.md).

## Workflow

1. Work against the active milestone only (see `docs/architecture/MILESTONES.md`).
2. Keep changes compiling: `pnpm typecheck`, `pnpm test`, `pnpm build`.
3. Prefer vertical slices over horizontal stubs across unfinished modules.
4. Document irreversible decisions as ADRs under `docs/architecture/`.
5. Local run: `pnpm run bootstrap:local` → `npm start` → open `/` (public) or `/terminal` (workspace). Optional: `/login` / `/register`.

## Package boundaries

| Package | May depend on |
|---------|----------------|
| `domain` | `contracts` only |
| `contracts` | nothing internal |
| `database` | Prisma only (no Nest, no React) |
| `api` / `worker` | packages above + Nest/BullMQ |
| `web` | `contracts` (DTOs). Not `database`, not connectors |

## Commits

Use clear, imperative subjects:

- `feat(api): add health readiness dependencies`
- `fix(database): correct membership uniqueness`

## Security

- Never commit `.env`, tokens, or merchant credentials.
- Redact secrets from logs (logger redaction paths are a baseline, not a guarantee).
