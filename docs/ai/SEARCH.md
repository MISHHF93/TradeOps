# Search Manager

Cohere is **not** the public internet.

```text
Objective → Intent → Policy → Provider Router
  → Internal (Cohere retrieval)
  → Internet (OpenAI web / Tavily when enabled)
  → Dedupe / Rank / Cite → AI
```

## Config

```dotenv
WEB_SEARCH_ENABLED=false
# When true, also configure:
# OPENAI_API_KEY=  (openai_web) and/or
# TAVILY_API_KEY=
SEARCH_ALLOWED_DOMAINS=
SEARCH_BLOCKED_DOMAINS=
```

## Behavior when search is off

Requests that need current public information return **blocked/partial** with an explicit warning.  
**No invented citations.**

## Code

- `packages/ai-runtime/src/search-manager.ts`
- `packages/ai-runtime/src/tavily-client.ts`
- `packages/ai-runtime/src/openai-client.ts` (`openAiWebSearch`)
