# Operations — Cohere AI Runtime

## Local run

```powershell
pnpm run db:pglite          # terminal 1
# .env has COHERE_API_KEY and AI_PROVIDER=cohere
pnpm start                  # terminal 2
```

## Smoke

```powershell
# Health of provider (no secrets)
Invoke-WebRequest http://127.0.0.1:4000/api/v1/ai/runtime -UseBasicParsing

# Chat (founder_direct session cookie via browser, or authenticated client)
# POST /api/v1/ai/chat  { "message": "Hi" }
```

## Rotate credentials

1. Create new key in Cohere dashboard  
2. Update server env / `.env`  
3. Restart API  
4. Revoke old key  

Never commit keys. Never paste keys into docs or chat in production workflows.

## Observability

Responses include `meta.latencyMs`, `meta.provider`, `meta.model`, `meta.toolsInvoked`, `meta.promptVersion`.  
Logs must use `redactSecrets` for any diagnostic payloads.
