import type { Permission, SystemRole } from '@tradeops/contracts';
import type { TenantContext } from '@tradeops/domain';

export type AuthContext = {
  userId: string;
  sessionId: string;
  /** Active tenant (= Organization.id). Never trust client-supplied alone. */
  activeOrganizationId: string | null;
  activeWorkspaceId: string | null;
  membershipId: string | null;
  role: SystemRole | null;
  roleIds: string[];
  permissions: readonly Permission[];
  featureFlags: string[];
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
  connectedCapabilities: string[];
  email: string;
  displayName: string;
  /** Fully validated tenant context when membership is active */
  tenant: TenantContext | null;
};

export type { TenantContext };
