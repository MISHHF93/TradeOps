import { z } from 'zod';
import { organizationSchema, permissionSchema, systemRoleSchema, userSchema } from './identity';

export const registerRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(200),
  organizationName: z.string().min(2).max(200),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const createOrganizationRequestSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const switchOrganizationRequestSchema = z.object({
  organizationId: z.string().uuid(),
});
export type SwitchOrganizationRequest = z.infer<typeof switchOrganizationRequestSchema>;

export const membershipWithOrgSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: systemRoleSchema,
  organization: organizationSchema,
});
export type MembershipWithOrgDto = z.infer<typeof membershipWithOrgSchema>;

export const sessionUserSchema = z.object({
  user: userSchema,
  activeOrganization: organizationSchema.nullable(),
  activeWorkspaceId: z.string().uuid().nullable().optional(),
  activeRole: systemRoleSchema.nullable(),
  permissions: z.array(permissionSchema),
  memberships: z.array(membershipWithOrgSchema),
  /** Server-resolved tenant context when an active org membership exists */
  tenant: z
    .object({
      userId: z.string().uuid(),
      tenantId: z.string().uuid(),
      organizationId: z.string().uuid(),
      workspaceId: z.string().uuid().optional(),
      membershipId: z.string().uuid(),
      roleIds: z.array(z.string()),
      role: systemRoleSchema,
      permissions: z.array(permissionSchema),
      featureFlags: z.array(z.string()),
      subscriptionStatus: z.string(),
      subscriptionPlan: z.string(),
      connectedCapabilities: z.array(z.string()),
      currentObjectiveId: z.string().uuid().optional(),
    })
    .nullable()
    .optional(),
});
export type SessionUserDto = z.infer<typeof sessionUserSchema>;

export const authResponseSchema = sessionUserSchema;
export type AuthResponse = z.infer<typeof authResponseSchema>;
