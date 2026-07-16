# Windows Application Control & TradeOps

This machine blocks many native binaries (WDAC / AppLocker-style **Application Control**).

## What works without whitelisting

| Component | Status |
|-----------|--------|
| `pnpm install --ignore-scripts` | Works |
| TypeScript compile (`tsc`) | Works |
| Nest API + Next.js (WASM SWC fallback) | Works |
| Unit tests (`node:test`) | Works |
| **Prisma Dev / PGlite** (`pnpm run db:pglite`) | Works — preferred local DB |
| `pnpm run bootstrap:local` | Works — PGlite + migrate + seed |
| `npm start` (API :4000 + Web :3000) | Works |
| Commerce terminal (no login) | Works with seed + `AUTH_BYPASS` |

## What is blocked here

| Binary | Symptom |
|--------|---------|
| PostgreSQL `psql` / `pg_ctl` | `Application Control policy has blocked this file` |
| Embedded Postgres (`pnpm run db:local`) | `spawn UNKNOWN` |
| Turbo / esbuild / Vitest native | install/runtime failures |
| Docker | Often not installed |

EnterpriseDB installer may place files under `C:\Program Files\PostgreSQL\16` **without** a working Windows service if policy blocks service registration.

## Recommended path (no IT ticket)

```powershell
cd C:\Users\borah\TradeOps
pnpm install --ignore-scripts
pnpm db:generate
pnpm setup
pnpm run bootstrap:local
npm start
```

Open **http://localhost:3000** → `/terminal` (no login).

Optional full pipeline:

```powershell
pnpm run demo:loop
```

### PGlite notes

- Wire URL (default): port **51214**  
- `DATABASE_URL` must include `pgbouncer=true` (disables prepared statements)  
- Use `connection_limit=5` (not 1) so pipeline counts do not serialize forever  
- Keep `pnpm run db:pglite` running, or let `npm start` / `bootstrap:local` start it  

## Unblock paths (optional)

### 1) IT whitelist

Ask IT to allow:

- `C:\Program Files\PostgreSQL\16\bin\*.exe`
- Docker Desktop (optional)
- Or Node native modules under the project `node_modules`

Then start the service and create the database (see elevated `scripts/register-postgres-service.ps1`).

### 2) Docker Desktop (if allowed)

```powershell
docker compose up -d
# Point DATABASE_URL at compose Postgres (see .env.example option A)
pnpm run setup:db
npm start
```

### 3) Hosted Postgres (internet)

```env
DATABASE_URL=postgresql://USER:PASS@HOST/DB?sslmode=require&schema=public&connect_timeout=10
```

```powershell
pnpm run setup:db
npm start
```

## Confirm apps

```powershell
npm run stop
npm start
```

| Check | Expected |
|-------|----------|
| http://localhost:3000 | Redirects to `/terminal` |
| http://localhost:4000/api/v1/health/live | `{"status":"up"}` |
| http://localhost:4000/api/v1/auth/me | Demo user JSON when DB seeded + `AUTH_BYPASS` |
| `/login` or `/register` | **404** (removed) |

Terminal data requires a working `DATABASE_URL` (PGlite is enough). Redis is optional for the first UI.
