import { z } from 'zod';

/** Stable permission catalog — expand in M1 with full RBAC. */
export const permissionSchema = z.enum([
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
]);
export type Permission = z.infer<typeof permissionSchema>;

export const systemRoleSchema = z.enum([
  'owner',
  'admin',
  'manager',
  'analyst',
  'viewer',
  'developer',
]);
export type SystemRole = z.infer<typeof systemRoleSchema>;

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** Optional expanded tenant fields (present when loaded from multi-tenant API) */
  publicId: z.string().uuid().optional(),
  organizationType: z.string().optional(),
  commerceMode: z.string().optional(),
  tenantStatus: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationDto = z.infer<typeof organizationSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof userSchema>;

export const membershipSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: systemRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MembershipDto = z.infer<typeof membershipSchema>;
