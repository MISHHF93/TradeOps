# Environment Migration Guide

## AI provider realignment

| Before | After (canonical) |
|--------|-------------------|
| Ad-hoc multi-LLM experimentation | `AI_PROVIDER=cohere` |
| Playground-owned prompts | Repo prompts (`tradeops-system@1.0.0`) |
| xAI as default generation | Cohere generation + embed + rerank |
| OpenAI primary (prior pivot) | Optional search / generation fallback |

### Keep working systems

- Existing Stripe/SaaS billing env names preserved  
- Connector production catalog still reads platform-level keys where implemented  
- `TRADEOPS_ACCESS_MODE` and security boot unchanged  
- Database `DATABASE_URL` / Redis `REDIS_URL` unchanged  

### Aliases (compatibility)

| Alias | Canonical |
|-------|-----------|
| `GROK_API_KEY` | `XAI_API_KEY` |
| `XAI_CHAT_MODEL` | `XAI_MODEL` |
| `OPENAI_CHAT_MODEL` | `OPENAI_MODEL` |
| `COHERE_MODEL` | `COHERE_CHAT_MODEL` |
| `RETRIEVAL_ENABLED` | `COHERE_RETRIEVAL_ENABLED` (preferred) |
| `COHERE_REQUEST_TIMEOUT_MS` | `COHERE_TIMEOUT_MS` |

## Cohere key rotation (required)

Any Cohere key that was shared in chat or committed history is **compromised**.

1. Create a **new** key in the Cohere dashboard  
2. Revoke the old key  
3. Set only in local gitignored env / deployment secret manager:

```dotenv
COHERE_API_KEY=
AI_PROVIDER=cohere
```

4. Never put the key in `.env.example`, docs, or `NEXT_PUBLIC_*`  
5. Restart API after change  

## Vendor paste templates

Local `.env` may still contain empty `SHOPIFY_*`, `AMAZON_*`, etc. for developer convenience.

**Production multi-tenant:** move merchant tokens into encrypted connector installations (`CREDENTIALS_MASTER_KEY`), not shared platform env.

## Search

```dotenv
WEB_SEARCH_ENABLED=false
# Optional single path:
# WEB_SEARCH_ENABLED=true
# TAVILY_API_KEY=   and/or OPENAI_API_KEY=
```

Do not enable SerpAPI + Brave + Tavily + Bing simultaneously.

## Checklist

- [ ] Rotate Cohere key  
- [ ] `AI_PROVIDER=cohere`  
- [ ] Production: strong `APP_SECRET` + `CREDENTIALS_MASTER_KEY`  
- [ ] Production: `TRADEOPS_ACCESS_MODE=multi_tenant` or `authenticated` (not public founder)  
- [ ] No merchant tokens only in global env for multi-tenant  
- [ ] `node scripts/secret-scan.mjs` clean  
