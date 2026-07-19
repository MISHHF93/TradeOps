# Local stack stability (Windows)

## Why the app “shuts off”

`ERR_CONNECTION_REFUSED` almost always means **nothing is listening** on `:3000` / `:4000` / `:51214` — not a Cohere bug.

Common causes:

1. **No supervisor** — a process exits and stays dead.
2. **Aggressive restarts** — `free-ports` / `taskkill` kills a healthy PGlite, then API cannot reach the DB.
3. **Racing stack-ups** — two start scripts free the same ports and kill each other.

## Correct usage

```bash
# Start (safe: only starts missing services; starts supervisor)
pnpm stack:up

# Status (includes supervisor)
pnpm stack:status

# Stop everything intentionally
pnpm stack:stop
```

Leave the **supervisor** running in the background. It restarts only dead legs every ~10s.

### Force full bounce

```bash
node scripts/stack-up-win.mjs --force
```

### Do not

- Run multiple `stack:up` / ad-hoc kill scripts in parallel.
- Free port `51214` while the API is running (unless you mean to stop the stack).

## Ports

| Service | Port |
|---------|------|
| PGlite | 51214 |
| API | 4000 |
| Web | 3000 |

Open: **http://127.0.0.1:3000**

## Logs

`.stack-logs/` — `db|api|web.out/err.log`, `supervisor.log`

## API “degraded”

Usually **Redis down** (optional). Operator + UI still work.
