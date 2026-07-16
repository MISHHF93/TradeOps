import type { Permission, SystemRole } from '@tradeops/contracts';

export type AuthContext = {
  userId: string;
  sessionId: string;
  activeOrganizationId: string | null;
  role: SystemRole | null;
  permissions: readonly Permission[];
  email: string;
  displayName: string;
};
