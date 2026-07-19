# Live product projection (SSE)

## Architecture

```text
User query
→ POST /api/v1/live-search
→ queryId
→ GET /api/v1/live-search/:queryId/events  (SSE)
→ Source adapters (catalog, web search)
→ Normalize · dedupe · optional Cohere Rerank
→ item.projected events
→ Discover UI cards
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/live-search` | Start query `{ "query": "…" }` → `{ queryId }` |
| GET | `/api/v1/live-search/:queryId/events` | SSE stream of projection events |
| GET | `/api/v1/live-search/:queryId/results` | Final item buffer |
| POST | `/api/v1/live-search/:queryId/cancel` | Abort in-flight job |

## Event types

`query.started` · `source.started` · `item.discovered` · `item.normalized` · `item.projected` · `item.reranked` · `source.failed` · `source.completed` · `query.completed` · `query.failed`

## Sources (v1)

1. **internal_catalog** — org products from Postgres (always attempted).
2. **web_search** — TradeOps Search Manager when `WEB_SEARCH_ENABLED=true` + provider keys.

Credentials stay server-side. Browser never holds API keys.

## Cohere role

- **Rerank** projected candidates when `COHERE_API_KEY` is set.
- Chat/synthesis remains on `/api/v1/ai/chat` (can run in parallel later).

## Env

```dotenv
LIVE_PROJECTION_ENABLED=true
LIVE_PROJECTION_TRANSPORT=sse
LIVE_PROJECTION_MAX_SOURCES=6
LIVE_PROJECTION_MAX_ITEMS=50
LIVE_PROJECTION_TIMEOUT_MS=120000
WEB_SEARCH_ENABLED=false
TAVILY_API_KEY=
OPENAI_API_KEY=
COHERE_API_KEY=
```

## UI

Discover (`/terminal`) hosts **Live projection · SSE** panel above the static scanner table.

## Not in v1

- WebSocket transport (`LIVE_PROJECTION_TRANSPORT=websocket` reserved).
- Marketplace live HTTP fan-out beyond catalog + Search Manager.
- Redis-backed job bus (in-memory jobs; single-node).
