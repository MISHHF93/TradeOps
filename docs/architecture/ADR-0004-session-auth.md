# ADR-0004: Server-side session authentication

**Status:** Accepted (amended)  
**Date:** 2026-07-15  
**Milestone:** M1  
**Amendments:** 2026-07-16 Direct Founder Access

## Context

TradeOps is a multi-tenant B2B SaaS console. Merchants need durable login, organization switching, and RBAC before connectors or commerce data exist. The founder-operated phase also needs zero-friction local entry without deleting the multi-tenant auth foundation.

## Decision

1. **Passwords:** Node.js `scrypt` (no native bcrypt) with format `scrypt$N$r$p$salt$key`.
2. **Sessions:** Opaque random tokens in HTTP-only cookies (`tradeops_session`); only SHA-256 token hashes stored in Postgres `sessions`.
3. **Org context:** `sessions.active_organization_id` is the tenancy pivot for every authenticated request.
4. **Guards:** Global Nest `AuthGuard` + `PermissionsGuard`; routes opt out with `@Public()`.
5. **RBAC:** System roles map to a fixed permission catalog in `@tradeops/domain` (custom roles later).
6. **Audit:** Login, logout, failed login, org create/switch, and switch denials write `audit_events`.
7. **Access mode** (`TRADEOPS_ACCESS_MODE`) is the central switch — see `packages/config/src/access-mode.ts`.

## Access modes

| Mode | Identity |
|------|----------|
| `founder_direct` (default) | Server resolves deterministic founder user+org without login UX |
| `authenticated` / `multi_tenant` | Session cookie required; `/login` · `/register` available |

## Consequences

- Cookie auth works with CORS `credentials: true` between web and API on localhost.
- Revocation is immediate (row update) without JWT denylist complexity.
- Future SSO/OAuth can issue the same session row type after IdP assertion.
- Founder direct mode still attaches owner RBAC and org-scoped queries — not unrestricted global access.
- Legacy `AUTH_BYPASS=true` remains for development; prefer `TRADEOPS_ACCESS_MODE=founder_direct`.

## Supersedes

None.
