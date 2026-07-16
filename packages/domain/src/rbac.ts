import type { Permission, SystemRole } from '@tradeops/contracts';

/**
 * Default role → permission matrix.
 * M1 will load custom roles from the database; this is the system baseline.
 */
const ROLE_PERMISSIONS: Record<SystemRole, readonly Permission[]> = {
  owner: [
    'org:read',
    'org:write',
    'members:read',
    'members:write',
    'connectors:read',
    'connectors:write',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'inventory:read',
    'inventory:write',
    'analytics:read',
    'automation:read',
    'automation:write',
    'ai:read',
    'ai:write',
    'settings:read',
    'settings:write',
    'audit:read',
    'developer:read',
    'developer:write',
  ],
  admin: [
    'org:read',
    'org:write',
    'members:read',
    'members:write',
    'connectors:read',
    'connectors:write',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'inventory:read',
    'inventory:write',
    'analytics:read',
    'automation:read',
    'automation:write',
    'ai:read',
    'ai:write',
    'settings:read',
    'settings:write',
    'audit:read',
    'developer:read',
    'developer:write',
  ],
  manager: [
    'org:read',
    'members:read',
    'connectors:read',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'inventory:read',
    'inventory:write',
    'analytics:read',
    'automation:read',
    'automation:write',
    'ai:read',
    'settings:read',
  ],
  analyst: [
    'org:read',
    'products:read',
    'orders:read',
    'inventory:read',
    'analytics:read',
    'ai:read',
    'connectors:read',
  ],
  viewer: [
    'org:read',
    'products:read',
    'orders:read',
    'inventory:read',
    'analytics:read',
    'connectors:read',
  ],
  developer: [
    'org:read',
    'connectors:read',
    'developer:read',
    'developer:write',
    'audit:read',
    'settings:read',
  ],
};

export function permissionsForRole(role: SystemRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: SystemRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
