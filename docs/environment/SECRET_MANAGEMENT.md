# Secret management

## Rules

1. **Never commit** real secrets (`.env` is gitignored).  
2. **Never print** secrets in logs, health endpoints, or AI responses.  
3. **Never put secrets** in `NEXT_PUBLIC_*` variables.  
4. **Rotate immediately** any key that was pasted into chat, tickets, or screenshots.  
5. Production: use the platform secret manager (or host env injection), not checked-in files.

## Platform secrets (examples)

| Secret | Purpose |
|--------|---------|
| `COHERE_API_KEY` | Cohere runtime |
| `APP_SECRET` | Session signing |
| `CREDENTIALS_MASTER_KEY` | Encrypt connector vault payloads |
| `DATABASE_URL` | Postgres |
| `REDIS_URL` | Cache / queues |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | SaaS billing |
| `TAVILY_API_KEY` / `OPENAI_API_KEY` | Optional search |

## Tenant secrets

Shopify, Amazon SP, EasyPost, merchant payment tokens, logistics carriers, ads tokens, ERP/PIM credentials, etc. should be stored as **encrypted connector credentials per organization**, not as a single global `.env` in multi-tenant production.

Canonical list: `TENANT_SCOPED_CREDENTIAL_NAMES` in `packages/config/src/environment-manifest.ts` (commerce, logistics, ads, tax, accounting, enterprise PIM/ERP/PLM).

## Compromised Cohere key policy

If a Cohere key was shared in this workspace chat (or any log):

1. Revoke/rotate it in the Cohere dashboard.  
2. Put **only the new** key into gitignored `.env` as `COHERE_API_KEY=...`.  
3. Restart the API with `node scripts/start-api-with-env.mjs`.  
4. Confirm `GET /api/v1/ai/health` shows `configured=true` without echoing the key.

Local policy in this session: compromised values were cleared from `.env` (empty placeholder) so they cannot be reused accidentally.
