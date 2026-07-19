# Contributing to TradeOps

## Docs

- Index: [docs/README.md](docs/README.md)  
- Canonical architecture: [docs/architecture/TRADEOPS_AI_RUNTIME_BLUEPRINT.md](docs/architecture/TRADEOPS_AI_RUNTIME_BLUEPRINT.md)  
- Keep **operational** docs (FIRST_RUN, LOCAL_SETUP, stack scripts) aligned with `package.json`.  
- Access modes: [docs/TRADEOPS_ACCESS_MODES.md](docs/TRADEOPS_ACCESS_MODES.md).  
- Do not reintroduce one-off session reports at repo root; use `docs/architecture/` or update the index.  
- Historical docs: [docs/_archive/](docs/_archive/).

## Workflow

1. Work against the active milestone only (see `docs/architecture/MILESTONES.md`).
2. Keep changes compiling: `pnpm typecheck`, `pnpm test`, `pnpm build`.
3. Prefer vertical slices over horizontal stubs across unfinished modules.
4. Document irreversible decisions as ADRs under `docs/architecture/`.
5. Local run: `pnpm stack:up` → open **http://localhost:3000**  
   - Default **`TRADEOPS_ACCESS_MODE=founder_direct`**: terminal without login.  
   - Set `authenticated` to exercise `/login` · `/register`.

## Package boundaries

| Package | May depend on |
|---------|----------------|
| `domain` | `contracts` only |
| `contracts` | nothing internal |
| `database` | Prisma only (no Nest, no React) |
| `api` / `worker` | packages above + Nest/BullMQ |
| `web` | `contracts` (DTOs). Not `database`, not connectors |
| Access-mode checks | Prefer `@tradeops/config` / `access-mode.ts` — do not scatter conditionals |

## Commits

Use clear, imperative subjects:

- `feat(api): add health readiness dependencies`
- `fix(database): correct membership uniqueness`

## Security

- Never commit `.env`, tokens, or merchant credentials.
- Redact secrets from logs (logger redaction paths are a baseline, not a guarantee).
- Do not enable `founder_direct` on a public multi-user internet deployment without perimeter controls.
