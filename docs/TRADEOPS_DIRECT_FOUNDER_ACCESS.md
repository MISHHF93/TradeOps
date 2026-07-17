# Direct Founder Access Mode

## What it does

When `TRADEOPS_ACCESS_MODE=founder_direct`:

1. API bootstraps (idempotent) founder user + organization + owner membership.
2. Requests without a session cookie receive the founder `AuthContext` server-side.
3. Web root `/` redirects to `/terminal/cockpit`.
4. `/login`, `/register`, `/signup`, `/onboarding`, `/verify-email`, `/forgot-password` redirect to the workspace.
5. Login/register buttons are hidden; founder menu is shown instead.
6. RBAC and `organizationId` scoping still apply (founder is **owner** of one org).
7. External connector OAuth/API credentials remain required for live marketplaces.

## Founder identity (deterministic)

| Field | Value |
|-------|--------|
| Email | `founder@tradeops.local` |
| Display name | TradeOps Founder |
| Org slug (preferred) | `demo-commerce` (preserves seed/fixture data) |
| Org name | TradeOps Founder Workspace |
| Role | `owner` |
| Workspace persona | `founder` |

If `demo-commerce` does not exist, the service creates it (or reuses an existing owner membership). **No destructive reseed.**

## Where it is safe

- Local development  
- Private founder laptop/server  
- Controlled private deployment (VPN, IP allowlist, tunnel ACLs, basic auth at edge)  

**Not** for public multi-user SaaS on the open internet without additional guards.

When `WEB_ORIGIN` is non-loopback (or `TRADEOPS_PUBLIC_WARNING=true`), the UI and API expose:

> Direct Founder Access is enabled. This deployment should not be treated as a public multi-user environment.

## How to enable

```env
TRADEOPS_ACCESS_MODE=founder_direct
NEXT_PUBLIC_TRADEOPS_ACCESS_MODE=founder_direct
```

Legacy `AUTH_BYPASS=true` still works in development but **prefer** `TRADEOPS_ACCESS_MODE`.

## How to disable

```env
TRADEOPS_ACCESS_MODE=authenticated
NEXT_PUBLIC_TRADEOPS_ACCESS_MODE=authenticated
AUTH_BYPASS=false
```

## Code map

| Concern | Location |
|---------|----------|
| Mode resolution | `packages/config/src/access-mode.ts` |
| Founder bootstrap | `apps/api/src/identity/founder-access.service.ts` |
| Request identity | `apps/api/src/identity/auth.guard.ts` |
| Public mode API | `GET /api/v1/public/access-mode` |
| Web routing | `apps/web/src/lib/access-mode.ts`, root + auth pages |
| Founder UI | `FounderMenu`, `PublicSiteNav`, terminal layout |

## Security limitations

- Anyone who can reach the private API can act as the founder while mode is active.  
- Protect the deployment with network/infrastructure controls.  
- Connector secrets stay server-side; never return tokens to the browser.  
- Do not confuse founder_direct with “permissions disabled” — owner RBAC is still evaluated.
