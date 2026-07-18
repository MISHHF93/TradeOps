# Testing the Cohere Runtime

## Unit

```powershell
pnpm --filter @tradeops/config build
pnpm --filter @tradeops/ai-runtime test
```

Covers: provider resolve, redaction, synthesis validation, search intent, retrieval fallback, capability executor.

## Secret scan

```powershell
node scripts/secret-scan.mjs
```

## Behavioral acceptance (manual / smoke)

| Input | Expect |
|-------|--------|
| `Hi` | `completed`, `no_search`, short text, empty actions |
| Public trends with `WEB_SEARCH_ENABLED=false` | `partial`/`blocked`, no invented sources |
| Revenue last 30 days | Operational tools path; no public search unless needed |
| Mass price publish | Proposals with `requiresApproval=true` |

```powershell
# With founder session cookie via browser, or Invoke-WebRequest -WebSession
# POST http://127.0.0.1:4000/api/v1/ai/chat
# { "message": "Hi" }
```

## Health

```http
GET /api/v1/ai/runtime
```

Returns configured/missing + health — never credential values.
