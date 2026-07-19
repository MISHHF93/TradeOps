# Cohere setup (platform AI)

TradeOps uses **Cohere only** for generative AI (Chat/Command, Embed, Rerank).

## Configure

Set in your local `.env` (never commit real keys):

```bash
COHERE_API_KEY=your_key_here
```

Optional model overrides:

```bash
COHERE_CHAT_MODEL=command-r-plus
COHERE_EMBED_MODEL=embed-english-v3.0
COHERE_RERANK_MODEL=rerank-english-v3.0
```

## Runtime

- Adapter: `@tradeops/ai-runtime` → `createCohereAdapter` / `bootstrapCohereProvider`
- Without a key, generation is **blocked** (honest empty result). Typed tools still run.
- Other model vendors (OpenAI, Anthropic, xAI, etc.) are **not** active.

See [docs/API_STACK.md](./docs/API_STACK.md) and [API_STACK_RECONCILIATION.md](./API_STACK_RECONCILIATION.md).
