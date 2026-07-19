# Local stack stability (Windows)

## Why you saw `ERR_CONNECTION_REFUSED (-102)`

The browser only fails with **-102** when **nothing is listening** on `:3000` / `:4000` (and usually the API is dead because **PGlite `:51214` died first**).

### Root causes (fixed)

| # | Failure mode | What happened | Fix |
|---|--------------|---------------|-----|
| 1 | **PGlite lock leftovers** | Killing Prisma Dev (Job Object, free-ports, IDE stop) left `server.lock` / `postmaster.pid`. Next start hung or reported “already running” but was not queryable. API then died with `Server has closed the connection`. | `prisma-dev-db.mjs` hard-resets locks, kills zombie listeners, retries once, uses a start mutex. |
| 2 | **`pnpm exec prisma` missing** | Detached Windows launchers often hit `ERR_PNPM_RECURSIVE_EXEC` / `Command "prisma" not found`, so DB never truly started. | Invoke Prisma via absolute `packages/database/node_modules/prisma/build/index.js`. |
| 3 | **TCP-only health** | Port open ≠ Postgres alive. Zombie PGlite kept `:51214` open while queries failed. | Health uses real `SELECT 1` (`dbHealthy` / `checkDatabaseHealth`). |
| 4 | **Supervisor died silently** | Single supervisor process exited; stale lock; no restarts → permanent refused. | Outer **watchdog** (`cmd` loop) restarts supervisor forever; heartbeats; exponential backoff (never permanent give-up). |
| 5 | **Job Object kills** | Agent/tool shells kill child trees when the tool ends. | `Start-Process` / `UseShellExecute=true` breakaway launch. |
| 6 | **Prisma client stuck** | After a DB blip, Nest’s Prisma client kept returning “Server has closed the connection” until full API restart. | Soft `$disconnect` + `$connect` on connection errors in health / `ensureConnected`. |

## Correct usage

```bash
# Start (safe: only starts missing/unhealthy services + watchdog)
pnpm stack:up

# Status (watchdog, supervisor, heartbeat, queryable DB)
pnpm stack:status

# Stop everything intentionally (ports + supervisor + locks)
pnpm stack:stop
```

Leave the **watchdog + supervisor** running. They restart only dead legs every ~8s.

### Force full bounce

```bash
pnpm stack:up --force
# or
node scripts/stack-up-win.mjs --force
```

### Do not

- Run multiple `stack:up` / ad-hoc kill scripts in parallel.
- Free port `51214` while working unless you intend a DB restart (supervisor will recover, but you will briefly see refused).
- Use only `free-ports` to “stop” — prefer `pnpm stack:stop` so the watchdog dies too.

## Ports

| Service | Port |
|---------|------|
| PGlite | 51214 |
| API | 4000 |
| Web | 3000 |

Open: **http://127.0.0.1:3000**

## Logs

`.stack-logs/` — `db|api|web.out/err.log`, `supervisor.log`, `supervisor.heartbeat`, `watchdog.lock`

## API “degraded” / “Database request failed… migrations”

- **Redis down** → optional locally; UI/operator still work.
- **Postgres down** → stack is actually broken; supervisor should bring PGlite back within ~30–90s. If not: `pnpm stack:up --force`.
- **`table users does not exist` / 503 migrations message** → PGlite data dir was wiped (hard reset) and schema was empty.  
  `pnpm stack:up` now runs **`prisma db push`** when the `users` table is missing. Manual fix:

  ```bash
  pnpm stack:up
  # or
  pnpm --filter @tradeops/database exec prisma db push
  pnpm db:seed
  ```

## Recovery checklist

1. `pnpm stack:status`
2. If WDG/SUP STALE or services DOWN → `pnpm stack:up`
3. If stuck zombie DB → `pnpm stack:up --force`
4. Still bad → `pnpm stack:stop` then `pnpm stack:up --force`
5. Read `.stack-logs/db.err.log` and `supervisor.log`
