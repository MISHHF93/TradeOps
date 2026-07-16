# Local Setup

## Prerequisites

- Node ≥ 20.11, pnpm 9  
- **One** of: Docker Postgres, system Postgres, or **Prisma Dev / PGlite** (default on locked-down Windows)

Windows Application Control: if native postinstall fails:

```bash
pnpm install --ignore-scripts
pnpm db:generate
```

## Recommended path (this Windows host)

```powershell
cd C:\Users\borah\TradeOps
pnpm install
copy .env.example .env
pnpm setup                    # install deps, generate, build
pnpm run bootstrap:local      # PGlite if needed + migrate + seed
npm start                     # API :4000 + Web :3000
```

Optional after start — fill the full commerce pipeline:

```powershell
pnpm run demo:loop
# or click “Run full demo loop” in the terminal UI
```

Open **http://localhost:3000** (redirects to `/terminal`, **no login**).

| Surface | URL |
|---------|-----|
| Terminal / Scanner | http://localhost:3000/terminal |
| Pipeline | http://localhost:3000/terminal/pipeline |
| Account | http://localhost:3000/app |
| API health | http://localhost:4000/api/v1/health |
| Auth me (bypass) | http://localhost:4000/api/v1/auth/me |
| Demo loop API | `POST /api/v1/terminal/demo-loop` |

Local identity: `AUTH_BYPASS=true` → seeded `founder@tradeops.local` / org `demo-commerce`.

## Docker path (if Docker is available)

```bash
cp .env.example .env
# Set DATABASE_URL to docker Postgres (see .env.example option A)
docker compose up -d
pnpm install
pnpm setup
pnpm run setup:db
pnpm start
```

## Fixture connectors

No third-party credentials required. Seed installs **FIXTURE** supplier + marketplace connectors.

Full loop (UI button or `pnpm run demo:loop`):

simulate → listing draft → approve → ingest orders → PO approve → fulfill → evaluate

Shopify later: [TRADEOPS_SHOPIFY_CREDENTIALS.md](./TRADEOPS_SHOPIFY_CREDENTIALS.md)

## PGlite notes

- `pnpm run db:pglite` keeps the local DB process running  
- `DATABASE_URL` must include `pgbouncer=true` (prepared statements break PGlite)  
- Prefer `connection_limit=5` (serial `connection_limit=1` made pipeline ~13s)  
- `npm start` auto-starts PGlite if the configured DB port is unreachable  
- Web timeouts: `API_TIMEOUT_MS=60000` (see `.env.example`)  

## Offline / stale data

- Terminal shows last rows from Postgres when external APIs are down  
- Scanner marks **STALE** when `dataFreshnessAt` is older than 24 hours  
