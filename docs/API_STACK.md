# TradeOps Active API Stack

**Authority:** Implementation registries + env schema.  
**Related:** [ACTIVE_CONNECTORS.md](./ACTIVE_CONNECTORS.md) · [FUTURE_CONNECTORS.md](./FUTURE_CONNECTORS.md) · [../API_STACK_RECONCILIATION.md](../API_STACK_RECONCILIATION.md)

## Canonical production stack

```text
Frontend          → Next.js (apps/web)
Backend           → NestJS (apps/api)
Database          → PostgreSQL + Prisma (PGlite local)
AI                → Cohere Chat + Embed + Rerank only
Public research   → Tavily (research.* capabilities)
Commerce live     → Shopify Admin GraphQL
Commerce dev      → Fixture Supplier + Fixture Marketplace
Payments          → Stripe Billing (SaaS subscriptions)
Logistics         → EasyPost
Tenant analytics  → Google Analytics 4
Product analytics → PostHog
Errors            → Sentry
Tracing           → OpenTelemetry
Queues            → Redis + BullMQ (optional for first UI)
```

## Provider-independent interfaces

| Interface | Package | Active adapter |
|-----------|---------|----------------|
| `AiProviderAdapter` | `@tradeops/ai-runtime` | Cohere |
| `WebSearchProvider` | `@tradeops/ai-runtime` | Tavily |
| Connector manifests / fabric | `@tradeops/connector-core` | Shopify, Stripe, EasyPost, fixtures, … |

Business code and AI tools must call **capabilities**, not vendor SDKs.

### Research capabilities

- `research.search_public_web` → tool `researchSearchPublicWeb`
- `research.extract_url` → tool `researchExtractUrl`
- `research.search_official_documentation` → tool `researchSearchOfficialDocumentation`

### Commerce / payments / logistics (via tools + connectors)

Resolved through connector fabric + capability maps — not direct vendor imports from workflows.

## Environment variables (platform)

See root `.env.example`. Only approved-stack keys are documented there.

Tenant-scoped OAuth tokens should live in encrypted connector vault records for multi-tenant deployments; platform env is acceptable for founder_direct local single-tenant.

## Failure policy

- Missing Cohere key → **blocked** generation (empty text, honest note). Typed tools still work.
- Missing Tavily key → **blocked** web search (zero hits). No SerpAPI/demo fallback.
- Missing Shopify/Stripe/EasyPost → credentials_required; no fabricated live data.

## Honesty

Fixtures are always labeled `isFixture` / TEST FIXTURE. Planned providers are not in the active registry and cannot appear connected.
