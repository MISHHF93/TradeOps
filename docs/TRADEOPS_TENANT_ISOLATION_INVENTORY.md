# Tenant Isolation Inventory

**Date:** 2026-07-17 (updated after full execution pass)  
**Scope:** Full-platform multi-tenancy audit + implementation status.  
**Canonical tenant:** `Organization` (alias **Tenant**). Hierarchy: Platform → Tenant → Workspace → Team → User → Membership → Role → Permission.

**Execution checklist:** [TRADEOPS_MULTI_TENANCY_EXECUTION.md](./TRADEOPS_MULTI_TENANCY_EXECUTION.md)

## Legend

| Status | Meaning |
|--------|---------|
| **OK** | Scoped by `organizationId` (or membership-validated) in schema + query path |
| **PARTIAL** | Schema or helpers ready; progressive depth remaining |
| **GAP** | Missing tenant key, client-trusted, or cross-tenant risk |
| **N/A** | Platform-global by design (with care) |

---

## 1. Database models

| Model | Tenant key | Status | Notes |
|-------|------------|--------|-------|
| Organization | self | **OK** | Expanded tenant fields + enums |
| User | none | **N/A** | Identity only; **no global role** |
| Membership | organizationId | **OK** | Membership-scoped role + RBAC |
| Session | activeOrganizationId, activeWorkspaceId | **OK** | Validated on resolve |
| AuditEvent | organizationId nullable | **OK** | Set for tenant ops |
| UsageMeter / UsageMeterEvent | organizationId | **OK** | |
| ConnectorInstallation | organizationId | **OK** | |
| Supplier / SupplierOffer | organizationId | **OK** | |
| Product / ProductIdentifier / ProductWatchlistItem | organizationId | **OK** | Team ACLs progressive |
| SalesChannel / Listing | organizationId | **OK** | |
| Opportunity / CommerceSignal / DemandForecast / PolicyAssessment | organizationId | **OK** | |
| CustomerOrder / CustomerOrderLine / SPO / Fulfillment | organizationId | **OK** | |
| Approval / SimulationRun / ProfitabilitySnapshot / PredictionOutcome | organizationId | **OK** | |
| ModelVersion | organizationId nullable | **OK** | Platform models may be null |
| ExternalPayload / IdentityLink / CommerceEvent | organizationId | **OK** | |
| WebhookReceipt / ShadowDecision / OperatorRun / OperatorRecommendation | organizationId | **OK** | |
| ConnectorHealthEvent | organizationId | **OK** | |
| ProductArtifact / CommerceCase | organizationId | **OK** | |
| Billing* / CommercePayment* / Platform* / Capital* | organizationId | **OK** | |
| CampaignBudget | organizationId | **OK** | Denormalized |
| Workspace / WorkspaceMembership | organizationId | **OK** | |
| Team / TeamMembership | organizationId | **OK** | |
| Role / Permission / RolePermission / MembershipRole | org or system | **OK** | |
| UserPermissionOverride | organizationId | **OK** | |

---

## 2. Authentication & authorization

| Surface | Status | Notes |
|---------|--------|-------|
| Session cookie + token hash | **OK** | |
| AuthGuard + TenantContextService | **OK** | Membership validated server-side |
| Frontend org id alone | **OK** | Rejected without membership |
| PermissionsGuard | **OK** | Matrix + DB roles + deny overrides |
| Global role on User | **OK** | Never stored |
| founder_direct | **PARTIAL** | Single tenant demo; still membership-bound |
| Custom Role / Permission tables | **OK** | Seeded system roles |
| Workspace membership | **OK** | Enforced on switch |
| Team-level resource ACL | **PARTIAL** | Models + APIs; row filters progressive |

---

## 3. APIs & controllers

| Controller | Status |
|------------|--------|
| identity/auth, orgs, tenancy | **OK** |
| commerce / industrial | **OK** (`requireOrg` / `requireOrgId`) |
| ai (operator, RAG, prediction) | **OK** |
| automation | **OK** |
| billing / capital / network | **OK** |
| saas | **OK** |
| public tools | **N/A** |
| health | **N/A** |

---

## 4. Workflows, queues, webhooks

| Surface | Status | Notes |
|---------|--------|-------|
| WebhookReceipt / EventFabric | **OK** | `requireOrganizationId` |
| Workflow run | **OK** | organizationId required |
| Worker Google weekend job | **OK** | Per-tenant product query loop |
| TenantJobPayload helper | **OK** | `@tradeops/domain` |
| Ops webhook drain | **OK** | Rows carry organizationId |

---

## 5. AI memory, search, files, cache

| Surface | Status | Notes |
|---------|--------|-------|
| RAG index files | **OK** | Tenant path + legacy fallback |
| OperatorRun | **OK** | |
| Redis tenantGet/Set | **OK** | `tenantCacheKey` |
| Notifications keys | **OK** | `tenantNotificationChannel` |
| Analytics | **OK** | Controllers force active tenant |
| Observability | **OK** | `tenant=` / `tenant_id` dims |

---

## 6. Frontend routing

| Surface | Status |
|---------|--------|
| founder_direct terminal | **OK** (implicit single tenant) |
| Org / tenant switcher | **OK** |
| Workspace switcher | **OK** |
| Client helpers | **OK** (`apps/web/src/lib/tenancy.ts`) |

---

## 7. Billing & entitlements

| Surface | Status |
|---------|--------|
| planTier / UsageMeter | **OK** |
| billingCustomerId on tenant | **OK** |
| Entitlement packs | **OK** |

---

## 8. Residual risks (track — not foundation gaps)

1. New Prisma queries must always include `organizationId` — review + `requireTenant`.  
2. Agency parent → child needs explicit membership (no implicit read).  
3. Platform admin cross-tenant tools: disabled by default, audited.  
4. Team-level filters on commerce rows: progressive.  
5. Full HTTP cross-tenant e2e matrix: progressive.

---

## 9. Implementation map

| Work item | Location |
|-----------|----------|
| Schema + migration | `packages/database/prisma/` |
| TenantContext + keys + job payload | `packages/domain` |
| Contracts | `packages/contracts` |
| Resolver + guards + tenancy API | `apps/api/src/identity/` |
| requireOrgId on domain controllers | commerce, ai, saas, automation, billing, capital |
| Event fabric + redis + telemetry | `events/`, `redis/`, `observability/` |
| Worker multi-tenant loop | `apps/worker/src/main.ts` |
| Seed RBAC + default workspace | `packages/database/seed/seed.ts` |
| Web switchers | `apps/web/src/components/forms/` |
| Docs | this file, MULTI_TENANCY, MULTI_TENANCY_EXECUTION |
