# Multi-Tenancy

## Model

- `Organization` · `Membership` · `User` · `Session.activeOrganizationId`
- Business rows carry `organizationId` (products, orders, connectors, AI runs, events, …)

## Enforcement

- Nest `AuthGuard` + `PermissionsGuard`
- Controllers call `requireOrg(auth)` before commerce mutations/queries
- Prisma queries filter by `organizationId`

## Gaps for broad public launch

- Email verification  
- Cross-tenant automated tests on every new endpoint  
- Encrypted per-org connector credential vault  

See `TRADEOPS_PRODUCTION_AUDIT.md` AUD-003, AUD-015, AUD-016.
