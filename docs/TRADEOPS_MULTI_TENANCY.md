# Multi-Tenancy (Production-Grade)

## Canonical model

**Tenant = `Organization`** (table `organizations`). Hierarchy:

```
Platform
  → Organization / Tenant
    → Workspace (business unit / brand / site / plant)
      → Team
    → User (identity only — no global role)
      → Membership (org-scoped)
        → Role(s) via MembershipRole
        → Permission (via RolePermission + UserPermissionOverride)
```

### Core entities

| Entity | Purpose |
|--------|---------|
| Organization | Canonical tenant (publicId, type, commerce mode, billing, residency, feature flags) |
| Membership | User↔Tenant link; legacy `SystemRole` + status; **not** a global User role |
| Workspace | Business unit under tenant; default workspace always exists |
| WorkspaceMembership | Who may operate in a workspace |
| Team / TeamMembership | Collaboration groups under org (optional workspace) |
| Role / Permission / RolePermission | RBAC catalog (system templates + tenant-custom) |
| MembershipRole | Many roles per membership |
| UserPermissionOverride | Membership-scoped allow/deny (deny wins) |
| Session | `activeOrganizationId` + `activeWorkspaceId` (server-validated) |

Supported **organization types**: retailer, marketplace_seller, distributor, wholesaler, manufacturer, industrial_supplier, procurement_organization, logistics_provider, enterprise_group, service_provider.

Supported **commerce modes**: retail, b2b, industrial, hybrid.

## Tenant context (trusted)

Every authenticated request resolves **server-side**:

```typescript
type TenantContext = {
  userId: string;
  tenantId: string;          // = organizationId
  organizationId: string;
  workspaceId?: string;
  membershipId: string;
  roleIds: string[];
  role: SystemRole;          // primary membership-scoped system role
  permissions: string[];
  featureFlags: string[];
  subscriptionStatus: string;
  subscriptionPlan: string;
  connectedCapabilities: string[];
  currentObjectiveId?: string;
};
```

Implementation:

- `TenantContextService` — membership validation, RBAC merge, workspace check
- `AuthGuard` — attaches `AuthContext` including `tenant`
- `requireTenant` / `requireOrgId` — controller/service entry
- Frontend may **select** tenant/workspace; server **confirms** membership

Never trust `organizationId` from the client alone.

## Isolation rules

1. Business rows carry `organizationId` (see inventory).
2. Prisma queries filter with `tenantWhere(orgId)` / `organizationId: requireOrgId(auth)`.
3. Cache / RAG / queue keys use `tenantKey` / `tenantCacheKey` / `tenantStoragePath` (`@tradeops/domain`).
4. RAG index path: `.tradeops-storage/rag/{organizationId}.json`.
5. CampaignBudget denormalizes `organizationId` for direct filters.
6. Agency parent→child: **no** implicit cross-read; require membership (or future delegated grants).

## APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/tenancy/context` | Active TenantContext (+ org/workspace labels) |
| GET | `/api/v1/tenancy/members` | Tenant members (membership-scoped roles) |
| POST | `/api/v1/tenancy/members/roles` | Assign role to membership |
| GET/POST | `/api/v1/tenancy/workspaces` | List / create |
| POST | `/api/v1/tenancy/workspaces/switch` | Membership-validated |
| GET/POST | `/api/v1/tenancy/teams` | List / create |
| GET/POST | `/api/v1/organizations` | List memberships / create tenant |
| POST | `/api/v1/organizations/switch` | Switch tenant + default workspace |

Smoke (API up): `pnpm run e2e:tenancy`

## Access modes

| Mode | Behavior |
|------|----------|
| `founder_direct` | Single founder membership + default workspace (local/demo). Still tenant-bound. |
| `authenticated` | Session cookie; multi-org switch |
| `multi_tenant` | Same auth path as authenticated; SaaS multi-user |

See [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md).

## Inventory & residual risks

Full surface audit: [TRADEOPS_TENANT_ISOLATION_INVENTORY.md](./TRADEOPS_TENANT_ISOLATION_INVENTORY.md).  
Professor-mode execution map: [TRADEOPS_MULTI_TENANCY_EXECUTION.md](./TRADEOPS_MULTI_TENANCY_EXECUTION.md).

Residual (progressive depth, not missing foundations):

- Team-level ACLs on every commerce row (modeled; progressive enforcement)
- Cross-tenant automated HTTP tests on every endpoint
- Platform admin tools (disabled by default, audited)

## Code map

| Concern | Package / path |
|---------|----------------|
| TenantContext + tenantWhere + keys + job payload | `@tradeops/domain` |
| Contracts / DTOs | `@tradeops/contracts` |
| Resolver + guards | `apps/api/src/identity/tenant-context.service.ts`, `auth.guard.ts` |
| Tenancy HTTP API | `GET/POST /api/v1/tenancy/*` |
| requireOrgId | commerce, industrial, AI, saas, automation, billing, capital |
| Redis tenant cache | `RedisService.tenantGet/Set` |
| Event fabric | `EventFabricService` requires organizationId |
| Worker | Per-tenant Google weekend loop |
| Seed | Permissions + 6 system roles + default workspace |

## Migration

```
packages/database/prisma/migrations/20260717210000_production_multi_tenancy/
```

Apply via `pnpm run bootstrap:local` or `pnpm db:migrate:deploy`.
