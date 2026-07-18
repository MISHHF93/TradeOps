# Tenant Isolation (AI)

## Trusted context (server-only)

```typescript
{
  requestId, userId, tenantId, workspaceId?,
  permissions, featureFlags, conversationId, locale
}
```

Resolved via session + `requireOrgId(auth)`.  
**Never** trust `tenantId` from the request body.

## Partitioned resources

Conversations, evidence, tool histories, retrieval docs, cache keys, usage — all tenant-scoped.

## Tool execution

`invokeCapability({ tenantId, ... })` uses the authenticated org.  
Operational tools refuse fabricated connector data without `operationalContext`.

## Tests to maintain

- Tenant A cannot retrieve Tenant B documents
- Forged tenant ID rejected at API boundary
- Cache keys include organization id

## Code

- `apps/api/src/identity/require-tenant.ts`
- `apps/api/src/ai/ai.controller.ts` (`POST /ai/chat`)
- `packages/ai-runtime/src/runtime/agent-loop.ts`
