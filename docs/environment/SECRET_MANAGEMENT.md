# Secret Management

## Rules

1. **Never commit** `.env`, `.env.local`, or backup env dumps  
2. **Never** use `NEXT_PUBLIC_` / `VITE_` / `PUBLIC_` for secrets  
3. **Never** log or return raw keys in API responses  
4. Use `redactSecrets` / `redactDeep` from `@tradeops/ai-runtime` for diagnostics  
5. Generate secrets with cryptographically strong RNG  

## Compromised Cohere key

If a Cohere API key was pasted into chat, tickets, or screenshots:

- Treat it as **compromised**  
- **Rotate** immediately in Cohere console  
- Do **not** reuse the old value  
- Confirm it does not appear in git-tracked files (`node scripts/secret-scan.mjs`)  

## Where secrets live

| Secret type | Location |
|-------------|----------|
| Platform Cohere / OpenAI / Tavily keys | Server env / secret manager |
| `APP_SECRET`, `CREDENTIALS_MASTER_KEY` | Server env / secret manager |
| Stripe platform secret + webhook | Server env |
| Merchant Shopify / Amazon / carrier tokens | **Encrypted tenant connector vault** |
| Session cookies | HTTP-only cookies (signed with `APP_SECRET`) |

## Generation helpers

```powershell
# APP_SECRET (example)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CREDENTIALS_MASTER_KEY (32-byte base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Scans

```powershell
node scripts/secret-scan.mjs
```

CI should run the same script on PRs.

## Health UI

`GET /api/v1/ai/runtime` reports `configured: true/false` only — never key material.
