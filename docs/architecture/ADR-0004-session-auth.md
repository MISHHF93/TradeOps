# ADR-0004: Server-side session authentication

**Status:** Accepted  
**Date:** 2026-07-15  
**Milestone:** M1

## Context

TradeOps is a multi-tenant B2B SaaS console. Merchants need durable login, organization switching, and RBAC before connectors or commerce data exist.

## Decision

1. **Passwords:** Node.js `scrypt` (no native bcrypt) with format `scrypt$N$r$p$salt$key`.
2. **Sessions:** Opaque random tokens in HTTP-only cookies (`tradeops_session`); only SHA-256 token hashes stored in Postgres `sessions`.
3. **Org context:** `sessions.active_organization_id` is the tenancy pivot for every authenticated request.
4. **Guards:** Global Nest `AuthGuard` + `PermissionsGuard`; routes opt out with `@Public()`.
5. **RBAC:** System roles map to a fixed permission catalog in `@tradeops/domain` (custom roles later).
6. **Audit:** Login, logout, failed login, org create/switch, and switch denials write `audit_events`.

## Consequences

- Cookie auth works with CORS `credentials: true` between web and API on localhost.
- Revocation is immediate (row update) without JWT denylist complexity.
- Future SSO/OAuth can issue the same session row type after IdP assertion.

## Local development amendment (2026-07-16)

- Web **login/register pages removed** for local-first product use.
- `AUTH_BYPASS=true` (non-production only) makes API guards impersonate the seeded demo owner (`founder@tradeops.local` / org `demo-commerce`) without a session cookie.
- API `POST /auth/login|register` remain available for future multi-tenant UI; not required for the local terminal.
- Bypass is forced **off** when `NODE_ENV=production` on the API process.

## Supersedes

None.
