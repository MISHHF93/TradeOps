# Multi-Tenancy

## Model

- `Organization` · `Membership` · `User` · `Session.activeOrganizationId`
- Business rows carry `organizationId` (products, orders, connectors, AI runs, events, watchlist, …)
- SaaS fields: `segment`, `planTier`, `deploymentMode`, `parentOrganizationId`
- Agency: parent org → child client orgs

## Enforcement

- Nest `AuthGuard` + `PermissionsGuard`
- Controllers call `requireOrg(auth)` before commerce mutations/queries
- Prisma queries filter by `organizationId`
- Direct Founder Access still binds to one founder org (not unrestricted multi-org data)

## Access modes

See [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md) and [TRADEOPS_DIRECT_FOUNDER_ACCESS.md](./TRADEOPS_DIRECT_FOUNDER_ACCESS.md).

## Gaps for broad public launch

- Email verification  
- Cross-tenant automated tests on every new endpoint  
- Encrypted per-org connector credential vault  
- Full legal-entity / region / brand hierarchy  

See `TRADEOPS_PRODUCTION_AUDIT.md` AUD-003, AUD-015, AUD-016.
