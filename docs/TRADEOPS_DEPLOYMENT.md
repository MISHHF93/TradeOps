# Deployment

**Last verified:** 2026-07-16 (local founder_direct stack + e2e smoke)  
**Scope:** Local full stack, Docker data plane, production container notes  
**Truth:** Prefer [TRADEOPS_EXECUTION_STATUS.md](./TRADEOPS_EXECUTION_STATUS.md) for capability claims.

## Principles

- Provider-independent containers
- Local laptop is **not** the production host model
- Separate secrets per environment
- Never run `TRADEOPS_ACCESS_MODE=founder_direct` on a public multi-user internet host

## Services

| Service | Image / entry | Port (default) | Required? |
|---------|---------------|----------------|-----------|
| API | `apps/api` → `node dist/main.js` | 4000 | Yes |
| Web | `apps/web` → `next start` | 3000 | Yes |
| Worker | `apps/worker` (BullMQ) | — | Optional first UI; needs Redis |
| Postgres | managed, compose, or **PGlite** (`pnpm run db:pglite` :51214) | 5432 / 51214 | Yes |
| Redis | managed or compose | 6379 | Optional (health may be `degraded`) |

## Local full deployment (this Windows host)

### Prerequisites

- Node.js ≥ 20.11, pnpm 9.15
- **PGlite** recommended when Application Control blocks system Postgres / Docker (see [WINDOWS_APP_CONTROL.md](./WINDOWS_APP_CONTROL.md))

### Sequence

```powershell
cd C:\Users\borah\TradeOps
pnpm install
# If native addons blocked:
# pnpm install --ignore-scripts
copy .env.example .env
# Confirm founder_direct defaults in .env (already in .env.example)
pnpm setup                    # generate Prisma client + build packages/apps
pnpm run bootstrap:local      # start PGlite if needed + migrate + seed
pnpm start                    # or: npm start  → API :4000 + Web :3000
```

Optional pipeline fill:

```powershell
pnpm run demo:loop
pnpm e2e:smoke
```

### URLs (founder_direct default)

| URL | Expected |
|-----|----------|
| http://localhost:3000/ | **307** → `/terminal/cockpit` |
| http://localhost:3000/login | **307** → cockpit |
| http://localhost:3000/terminal/cockpit | Command center |
| http://localhost:3000/terminal | Scanner |
| http://localhost:3000/terminal/live-examples | Live online examples |
| http://localhost:3000/terminal/products/:id | Digital twin + **Product Media Workspace** |
| http://localhost:4000/api/v1/health/live | `{ "status": "up" }` |
| http://localhost:4000/api/v1/health | May be `degraded` if Redis down (OK for first UI) |
| http://localhost:4000/api/v1/public/access-mode | `mode: founder_direct` |

### `pnpm start` behavior

`scripts/start.mjs`:

1. Loads `.env`
2. Requires built `apps/api/dist/main.js` and `apps/web/.next`
3. Frees ports 3000/4000
4. Ensures DB (existing `DATABASE_URL` port, else auto-starts PGlite on **51214**)
5. Starts API (`NODE_ENV=development` so local auth bypass / founder path works) + Web (`next start`, production Next runtime)

**Windows note:** paths under `C:\Program Files\...` are quoted when spawning via `cmd.exe` so auto-start of PGlite does not fail with `'C:\Program' is not recognized`.

If auto-start still fails:

```powershell
pnpm run db:pglite   # leave running in a second terminal
pnpm start
```

### Stop

```powershell
pnpm stop   # frees 3000 + 4000
# Stop PGlite terminal with Ctrl+C if you started db:pglite separately
```

## Docker data plane

```powershell
docker compose up -d
# Sets Postgres + Redis from infra/docker/docker-compose.yml
# Point DATABASE_URL / REDIS_URL in .env to compose hosts
pnpm run setup:db
pnpm start
```

See root `docker-compose.yml` (includes `infra/docker/docker-compose.yml`).

## Production env checklist

| Variable | Production requirement |
|----------|------------------------|
| `NODE_ENV` | `production` |
| `TRADEOPS_ACCESS_MODE` | `authenticated` or `multi_tenant` (**not** `founder_direct` on public SaaS) |
| `AUTH_BYPASS` | `false` (ignored/forced off in production identity path) |
| `APP_SECRET` | Strong random ≥ 32 chars |
| `CREDENTIALS_MASTER_KEY` | 32-byte base64 |
| `DATABASE_URL` | Managed Postgres |
| `REDIS_URL` | Required for durable worker queues |
| `WEB_ORIGIN` | HTTPS origin of the web app |
| `API_PUBLIC_URL` / `NEXT_PUBLIC_API_PUBLIC_URL` | HTTPS API base |
| `NEXT_PUBLIC_SITE_URL` | Canonical public site URL |
| `ARTIFACT_STORAGE_ROOT` | Durable object path or future S3 mount |

## Migrations

```bash
pnpm db:migrate:deploy
```

Includes product artifacts migration `20260717040000_product_artifacts`.

## Container images

| File | Role |
|------|------|
| `Dockerfile.api` | Nest API production image |
| `Dockerfile.web` | Next.js production image |

Build (from repo root, with Docker available):

```bash
docker build -f Dockerfile.api -t tradeops-api .
docker build -f Dockerfile.web -t tradeops-web --build-arg NEXT_PUBLIC_API_PUBLIC_URL=https://api.example.com .
```

## Cloud Run notes

1. Deploy API and Web as **separate** services
2. Map custom domain + TLS
3. Mount secrets from Secret Manager (never bake into images)
4. Run migrations as a **job** before shifting traffic
5. Worker service only when Redis is provisioned
6. Artifact storage: use durable volume or S3-compatible backend (local `.tradeops-storage` is **dev only**)

## Pre-release verification

```powershell
pnpm test          # package unit tests (health mock may show 1 pre-existing degraded case)
pnpm build         # production monorepo build
pnpm e2e:smoke     # against running stack
```

Also walk [TRADEOPS_RELEASE_RUNBOOK.md](./TRADEOPS_RELEASE_RUNBOOK.md) and [TRADEOPS_PRODUCTION_AUDIT.md](./TRADEOPS_PRODUCTION_AUDIT.md).

## Honesty

| Claim | Status |
|-------|--------|
| Local founder product deploy | **Operational** |
| Docker Compose data plane | **Present** (host-dependent) |
| Cloud staging / multi-region | **Not automated** — notes only |
| Live marketplace publish | **Credential-blocked** |
| Public multi-user SaaS | **Not claimed** under founder_direct |
