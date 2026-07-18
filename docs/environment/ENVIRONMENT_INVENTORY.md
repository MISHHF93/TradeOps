# Environment Inventory

**Source of truth:** repository code scan (`process.env` / `NEXT_PUBLIC_*`) + `packages/config` typed readers.

**Generated scan artifact:** `_raw-env-scan.json` (variable → consumer files).  
**Typed manifest:** `packages/config/src/environment-manifest.ts`

## Stack discovered

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces |
| API | NestJS (`apps/api`) |
| Web | Next.js 15 (`apps/web`) |
| DB | PostgreSQL via Prisma (+ local Prisma Dev / PGlite) |
| Cache | Redis (optional locally) |
| Config package | `@tradeops/config` (Zod `envSchema` + domain configs) |
| AI runtime | `@tradeops/ai-runtime` — Cohere primary (`AI_PROVIDER=cohere`) |
| Access | `TRADEOPS_ACCESS_MODE` (founder_direct / authenticated / multi_tenant) |

## Counts

| Category | Count |
|----------|------:|
| Unique `process.env` names referenced in packages/apps/scripts | ~67 (scan) |
| Platform manifest entries (canonical) | see `PLATFORM_ENV_MANIFEST` |
| Names in local `.env` (including vendor paste templates) | ~150+ |
| Browser-public (`NEXT_PUBLIC_*`) | few (API URL, access mode, optional GA4) |

## Principles (enforced)

1. **Platform env** = secrets + deploy URLs + model flags + feature defaults  
2. **Tenant connector vault** = Shopify/Amazon/merchant tokens (encrypted DB)  
3. **No secrets** under `NEXT_PUBLIC_*` / `VITE_*` / `PUBLIC_*`  
4. **Fail closed** in production for required keys  
5. **One canonical name** per concept (aliases documented for migration)

## AI (Cohere code-first)

| Variable | Role | Secret |
|----------|------|--------|
| `AI_PROVIDER` | `cohere` (canonical) | no |
| `COHERE_API_KEY` | Server only | **yes** |
| `COHERE_CHAT_MODEL` | Chat model id | no |
| `COHERE_EMBED_MODEL` | Embeddings | no |
| `COHERE_RERANK_MODEL` | Rerank | no |
| `COHERE_TEMPERATURE` / `COHERE_MAX_TOKENS` | Generation knobs | no |
| `WEB_SEARCH_ENABLED` | TradeOps Search Manager | no |
| `TAVILY_API_KEY` / `OPENAI_API_KEY` | Optional public search adapters | yes |

Prompts, JSON schemas, and tools live in **source code**, not env.

## Tenant-scoped (not global `.env` for multi-tenant prod)

Examples that may appear in local paste templates but should be connector vault in production:

- `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_SHOP_DOMAIN`
- `AMAZON_SP_*` refresh tokens
- Merchant logistics / GA4 property tokens

## Browser-safe public vars

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_PUBLIC_URL` | Client API base |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Client timeout |
| `NEXT_PUBLIC_TRADEOPS_ACCESS_MODE` | UI mode hint |
| `NEXT_PUBLIC_TRADEOPS_SIMULATION_MODE` | Simulation banner |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Optional public analytics |

## Local files found

| File | Tracked? | Purpose |
|------|----------|---------|
| `.env` | **No** (gitignore) | Local secrets |
| `.env.example` | Yes | Safe template |
| `.env.development.example` | Yes | Dev template |
| `.env.test.example` | Yes | Test template |
| `.env.production.example` | Yes | Prod template (names only) |
| `.env.bak-*` | No | Local backups — do not commit |

## False positives from scan

- `C` — path fragment from `ComSpec` usage in scripts (not a real app env var)
- `APPDATA` — Windows OS path helper in scripts

## Status endpoint (no secrets)

```http
GET /api/v1/ai/runtime
```

Includes `environment` manifest summary via `environmentManifestPublicStatus()` when wired.
