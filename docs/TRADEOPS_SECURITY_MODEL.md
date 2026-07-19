# TradeOps Security Model (Access + Tenancy)

## Principles

1. **Tenant isolation** — private rows filter by `organizationId` / `tenantId` from **server-resolved** TenantContext, never from client-supplied tenant IDs alone.  
2. **Membership-scoped roles** — never a global role on `User`; roles live on Membership + MembershipRole + overrides.  
3. **Fail closed** on policy-blocked products and missing credentials for live posts.  
4. **Money as integer minor units** — no float money.  
5. **Human approval** for consequential marketplace/financial actions.  
6. **No fabricated live success** — capability honesty board.  
7. **Access mode is explicit** — `TRADEOPS_ACCESS_MODE` centralizes founder vs multi-user entry.

## Access modes

See [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md).

| Mode | Trust boundary |
|------|----------------|
| `founder_direct` | Single operator; protect network perimeter; synthetic identity is founder owner (still membership-bound) |
| `authenticated` / `multi_tenant` | Session cookie + membership; multi-org / multi-workspace |

Deep dive: [TRADEOPS_MULTI_TENANCY.md](./TRADEOPS_MULTI_TENANCY.md) · [TRADEOPS_TENANT_ISOLATION_INVENTORY.md](./TRADEOPS_TENANT_ISOLATION_INVENTORY.md)

## Authentication stack (retained in all modes)

- User / Organization (Tenant) / Membership / Workspace / Team / Session models  
- Role / Permission / MembershipRole / UserPermissionOverride  
- Password hashing (`@tradeops/auth`)  
- Cookie sessions (`activeOrganizationId` + `activeWorkspaceId`)  
- RBAC: system role matrix + DB roles + allow/deny overrides  
- Audit events with actor + organization  
- Connector installations owned by organization  

## Authorization

- Nest `AuthGuard` attaches identity (session **or** founder direct) via `TenantContextService`.  
- `PermissionsGuard` enforces `@RequirePermissions` against resolved permissions.  
- Controllers use `requireOrgId(auth)` / `requireTenant(auth)` — membership must be active.  
- Cache, RAG, queues, events, and metrics attach `tenantId` / `organizationId`.

## Connector credentials

- Stored server-side only.  
- OAuth/API keys for Shopify, Amazon, eBay, Google Merchant, etc. remain required for live operations.  
- Founder identity **owns** installations in founder_direct; tokens are never sent to the browser.

## Public surfaces

- Marketing pages, free tools, `/status` — no private merchant data.  
- Free tools are pure calculators.  
- Capability board is honesty-first.

## Production notes

- `founder_direct` **can** run with `NODE_ENV=production` for private founder deploys — show public warning if origin is non-local.  
- For public multi-user SaaS, use `authenticated` or `multi_tenant` and never enable direct identity on the open internet.  
- Email verification and password reset remain future work for authenticated mode.
