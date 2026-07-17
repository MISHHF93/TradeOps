# TradeOps Security Model (Access + Tenancy)

## Principles

1. **Tenant isolation** — private rows filter by `organizationId` from server auth context, never from client-supplied tenant IDs alone.  
2. **Fail closed** on policy-blocked products and missing credentials for live posts.  
3. **Money as integer minor units** — no float money.  
4. **Human approval** for consequential marketplace/financial actions.  
5. **No fabricated live success** — capability honesty board.  
6. **Access mode is explicit** — `TRADEOPS_ACCESS_MODE` centralizes founder vs multi-user entry.

## Access modes

See [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md).

| Mode | Trust boundary |
|------|----------------|
| `founder_direct` | Single operator; protect network perimeter; synthetic identity is founder owner |
| `authenticated` / `multi_tenant` | Session cookie + membership; multi-user ready |

## Authentication stack (retained in all modes)

- User / Organization / Membership / Session models  
- Password hashing (`@tradeops/auth`)  
- Cookie sessions  
- RBAC `permissionsForRole`  
- Audit events with actor + organization  
- Connector installations owned by organization  

## Authorization

- Nest `AuthGuard` attaches identity (session **or** founder direct).  
- `PermissionsGuard` enforces `@RequirePermissions` against role permissions.  
- Commerce/AI/automation handlers scope queries to `activeOrganizationId`.

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
