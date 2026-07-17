import { z } from 'zod';
import { organizationSchema, permissionSchema, systemRoleSchema } from './identity';

export const organizationTypeSchema = z.enum([
  'retailer',
  'marketplace_seller',
  'distributor',
  'wholesaler',
  'manufacturer',
  'industrial_supplier',
  'procurement_organization',
  'logistics_provider',
  'enterprise_group',
  'service_provider',
]);
export type OrganizationType = z.infer<typeof organizationTypeSchema>;

export const commerceModeSchema = z.enum(['retail', 'b2b', 'industrial', 'hybrid']);
export type CommerceMode = z.infer<typeof commerceModeSchema>;

export const tenantStatusSchema = z.enum(['active', 'suspended', 'provisioning', 'closed']);
export type TenantStatus = z.infer<typeof tenantStatusSchema>;

export const subscriptionStatusSchema = z.enum([
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'incomplete',
]);
export type SubscriptionStatusDto = z.infer<typeof subscriptionStatusSchema>;

export const workspaceKindSchema = z.enum([
  'default',
  'business_unit',
  'brand',
  'region',
  'site',
  'industrial_plant',
]);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

export const tenantOrganizationSchema = organizationSchema.extend({
  publicId: z.string().uuid(),
  legalName: z.string().max(300).nullable().optional(),
  organizationType: organizationTypeSchema,
  industry: z.string().max(128).nullable().optional(),
  commerceMode: commerceModeSchema,
  region: z.string().max(64).nullable().optional(),
  country: z.string().max(2).nullable().optional(),
  defaultCurrency: z.string().length(3),
  defaultLanguage: z.string().max(16),
  timezone: z.string().max(64),
  subscriptionPlan: z.string().max(64).nullable().optional(),
  subscriptionStatus: subscriptionStatusSchema,
  tenantStatus: tenantStatusSchema,
  featureFlags: z.array(z.string()),
});
export type TenantOrganizationDto = z.infer<typeof tenantOrganizationSchema>;

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  publicId: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(64),
  kind: workspaceKindSchema,
  isDefault: z.boolean(),
  status: tenantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkspaceDto = z.infer<typeof workspaceSchema>;

export const teamSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(64),
  description: z.string().max(500).nullable().optional(),
  status: tenantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TeamDto = z.infer<typeof teamSchema>;

export const tenantContextSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
  workspaceId: z.string().uuid().optional(),
  membershipId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()),
  role: systemRoleSchema,
  permissions: z.array(permissionSchema),
  featureFlags: z.array(z.string()),
  subscriptionStatus: z.string(),
  subscriptionPlan: z.string(),
  connectedCapabilities: z.array(z.string()),
  currentObjectiveId: z.string().uuid().optional(),
});
export type TenantContextDto = z.infer<typeof tenantContextSchema>;

export const switchWorkspaceRequestSchema = z.object({
  workspaceId: z.string().uuid(),
});
export type SwitchWorkspaceRequest = z.infer<typeof switchWorkspaceRequestSchema>;

export const createWorkspaceRequestSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  kind: workspaceKindSchema.optional(),
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export const createTeamRequestSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  workspaceId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;

export const tenantMemberSchema = z.object({
  membershipId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: systemRoleSchema,
  status: z.string(),
  workspacePersona: z.string().optional(),
  roleIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
});
export type TenantMemberDto = z.infer<typeof tenantMemberSchema>;

export const assignMembershipRoleRequestSchema = z.object({
  membershipId: z.string().uuid(),
  /** System role key (owner|admin|manager|analyst|viewer|developer) or custom role id UUID */
  roleKey: z.string().min(2).max(64).optional(),
  roleId: z.string().uuid().optional(),
  /** When true, also update Membership.role primary system role if roleKey is a SystemRole */
  setPrimary: z.boolean().optional(),
});
export type AssignMembershipRoleRequest = z.infer<typeof assignMembershipRoleRequestSchema>;

export const tenantContextEnrichedSchema = tenantContextSchema.extend({
  organizationName: z.string().optional(),
  organizationSlug: z.string().optional(),
  workspaceName: z.string().optional(),
  workspaceSlug: z.string().optional(),
  commerceMode: z.string().optional(),
  organizationType: z.string().optional(),
});
export type TenantContextEnrichedDto = z.infer<typeof tenantContextEnrichedSchema>;

export const tenantSessionSchema = z.object({
  tenant: tenantContextSchema.nullable(),
  activeOrganization: organizationSchema.nullable(),
  activeWorkspace: workspaceSchema.nullable(),
});
export type TenantSessionDto = z.infer<typeof tenantSessionSchema>;
