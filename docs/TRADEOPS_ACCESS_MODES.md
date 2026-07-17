# TradeOps Access Modes

**Central switch:** `TRADEOPS_ACCESS_MODE`  
**Implementation:** `packages/config/src/access-mode.ts` (do not scatter mode checks)

## Modes

| Mode | Value | Behavior |
|------|--------|----------|
| **Direct Founder Access** | `founder_direct` | No login/signup/onboarding UX. Server resolves founder identity + org. |
| **Authenticated** | `authenticated` | Session cookie required for private APIs and terminal. |
| **Multi-tenant SaaS** | `multi_tenant` | Same session path as authenticated; ready for multi-org SaaS UX. |

## Default

```env
TRADEOPS_ACCESS_MODE=founder_direct
NEXT_PUBLIC_TRADEOPS_ACCESS_MODE=founder_direct
```

Web and API both read this (web also accepts `NEXT_PUBLIC_*` for client components).

## Boundary (architecture)

```text
Access-mode resolver  (@tradeops/config access-mode)
        ↓
Authentication provider (session cookie OR founder direct identity)
        ↓
User identity + Organization context
        ↓
Permission engine (RBAC on role; org-scoped queries)
```

Auth models, memberships, sessions, OAuth connector flows, and audit tables **remain** in all modes.

## Restoring multi-user login

```env
TRADEOPS_ACCESS_MODE=authenticated
NEXT_PUBLIC_TRADEOPS_ACCESS_MODE=authenticated
AUTH_BYPASS=false
```

Then use `/login` and `/register` again.

## Related

- [TRADEOPS_DIRECT_FOUNDER_ACCESS.md](./TRADEOPS_DIRECT_FOUNDER_ACCESS.md)
- [TRADEOPS_SECURITY_MODEL.md](./TRADEOPS_SECURITY_MODEL.md)
- [TRADEOPS_LOCAL_SETUP.md](./TRADEOPS_LOCAL_SETUP.md)
