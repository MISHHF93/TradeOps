/**
 * Client helpers for multi-tenancy.
 * Tenant identity is always confirmed by the server; these only present UI state.
 */

export type ClientTenantContext = {
  userId: string;
  tenantId: string;
  organizationId: string;
  workspaceId?: string;
  membershipId: string;
  roleIds: string[];
  role: string;
  permissions: string[];
  featureFlags: string[];
  subscriptionStatus: string;
  subscriptionPlan: string;
  connectedCapabilities: string[];
  currentObjectiveId?: string;
};

export type WorkspaceSummary = {
  id: string;
  organizationId: string;
  publicId: string;
  name: string;
  slug: string;
  kind: string;
  isDefault: boolean;
  status: string;
};

/** Route helper — never encode secrets; public slug/id for display only */
export function tenantWorkspacePath(workspaceSlug?: string): string {
  if (workspaceSlug) return `/terminal/workspace?ws=${encodeURIComponent(workspaceSlug)}`;
  return '/terminal/workspace';
}
