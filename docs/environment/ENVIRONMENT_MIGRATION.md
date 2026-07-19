# Environment migration guide

## From older demo / multi-provider paste templates

| Old / alias | Use instead |
|-------------|-------------|
| `COHERE_MODEL` | `COHERE_CHAT_MODEL` |
| `COHERE_REQUEST_TIMEOUT_MS` | `COHERE_TIMEOUT_MS` |
| `RETRIEVAL_ENABLED` | `COHERE_RETRIEVAL_ENABLED` |
| `GROK_API_KEY` | `XAI_API_KEY` (optional only) |
| `TRADEOPS_AI_MODE` | `AI_PROVIDER` |
| `WEB_SEARCH_PROVIDER` | `SEARCH_PROVIDER_PRIMARY` |
| `WEB_SEARCH_MAX_*` | `SEARCH_MAX_*` |
| `TRADEOPS_POOLED_INVESTMENT_ENABLED` | `POOLED_INVESTMENT_ENABLED` |
| `TRADEOPS_GUARANTEED_RETURNS_ENABLED` | `GUARANTEED_RETURNS_ENABLED` |
| `TRADEOPS_INTERNAL_CUSTODY_ENABLED` | `CAPITAL_CUSTODY_ENABLED` |
| Large vendor paste dump of unused keys | Keep only keys in `PLATFORM_ENV_MANIFEST` + vault list; optional paste sheet: `env.vendors.template` |

## Primary AI is Cohere

1. Set `AI_PROVIDER=cohere`.  
2. Set `COHERE_API_KEY` (rotated, server-only).  
3. Do **not** rely on OpenAI/xAI for the main agent loop unless you intentionally change `AI_PROVIDER`.

## Search

- Default: `WEB_SEARCH_ENABLED=false` (fail closed — no invented citations).  
- To enable: `WEB_SEARCH_ENABLED=true` **and** `TAVILY_API_KEY` or `OPENAI_API_KEY`.

## Multi-tenant production

1. `TRADEOPS_ACCESS_MODE=multi_tenant` (or `authenticated`).  
2. `AUTH_BYPASS=false`.  
3. Strong `APP_SECRET` + `CREDENTIALS_MASTER_KEY`.  
4. Merchant credentials → connector vault, not global env.  
5. `assertProductionEnv` must pass on deploy.

## Local founder loop

```bash
cp .env.example .env
# fill COHERE_API_KEY with a fresh key
pnpm db:pglite
pnpm db:migrate:deploy   # or project migrate scripts
pnpm db:seed
node scripts/start-api-with-env.mjs
```
