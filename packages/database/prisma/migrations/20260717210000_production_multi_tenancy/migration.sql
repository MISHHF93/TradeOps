-- Production-grade multi-tenancy: tenant fields, workspace/team hierarchy, RBAC tables

-- Enums
CREATE TYPE "OrganizationType" AS ENUM (
  'retailer',
  'marketplace_seller',
  'distributor',
  'wholesaler',
  'manufacturer',
  'industrial_supplier',
  'procurement_organization',
  'logistics_provider',
  'enterprise_group',
  'service_provider'
);

CREATE TYPE "CommerceMode" AS ENUM ('retail', 'b2b', 'industrial', 'hybrid');
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'provisioning', 'closed');
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'incomplete');
CREATE TYPE "WorkspaceKind" AS ENUM ('default', 'business_unit', 'brand', 'region', 'site', 'industrial_plant');
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'suspended');
CREATE TYPE "PermissionEffect" AS ENUM ('allow', 'deny');

-- Expand organizations (canonical Tenant)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "public_id" UUID;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "legal_name" VARCHAR(300);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "organization_type" "OrganizationType" NOT NULL DEFAULT 'retailer';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "industry" VARCHAR(128);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "commerce_mode" "CommerceMode" NOT NULL DEFAULT 'retail';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "region" VARCHAR(64);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" VARCHAR(2);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "default_language" VARCHAR(16) NOT NULL DEFAULT 'en';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_plan" VARCHAR(64);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_customer_id" VARCHAR(128);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "tenant_status" "TenantStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_status" VARCHAR(64) NOT NULL DEFAULT 'created';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "data_residency_region" VARCHAR(32);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "retention_policy" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "feature_flags" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';

-- Use existing primary key as public id for backfill (stable, works on PGlite)
UPDATE "organizations" SET "public_id" = "id" WHERE "public_id" IS NULL;

ALTER TABLE "organizations" ALTER COLUMN "public_id" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_public_id_key" ON "organizations"("public_id");
CREATE INDEX IF NOT EXISTS "organizations_tenant_status_idx" ON "organizations"("tenant_status");
CREATE INDEX IF NOT EXISTS "organizations_organization_type_idx" ON "organizations"("organization_type");
CREATE INDEX IF NOT EXISTS "organizations_commerce_mode_idx" ON "organizations"("commerce_mode");

-- Membership status
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "status" "MembershipStatus" NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS "memberships_organization_id_status_idx" ON "memberships"("organization_id", "status");

-- Session workspace
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "active_workspace_id" UUID;
CREATE INDEX IF NOT EXISTS "sessions_active_workspace_id_idx" ON "sessions"("active_workspace_id");

-- Campaign budget denormalized tenant key
ALTER TABLE "campaign_budgets" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
UPDATE "campaign_budgets" cb
SET "organization_id" = c."organization_id"
FROM "commerce_campaigns" c
WHERE cb."campaign_id" = c."id" AND cb."organization_id" IS NULL;
-- Any orphan rows: leave null temporarily then set NOT NULL only if all filled
-- For empty table, use a dummy; if rows remain null, delete orphans
DELETE FROM "campaign_budgets" WHERE "organization_id" IS NULL;
ALTER TABLE "campaign_budgets" ALTER COLUMN "organization_id" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "campaign_budgets_organization_id_idx" ON "campaign_budgets"("organization_id");

-- Workspaces
CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "public_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "kind" "WorkspaceKind" NOT NULL DEFAULT 'default',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_public_id_key" ON "workspaces"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_organization_id_slug_key" ON "workspaces"("organization_id", "slug");
CREATE INDEX IF NOT EXISTS "workspaces_organization_id_is_default_idx" ON "workspaces"("organization_id", "is_default");

CREATE TABLE IF NOT EXISTS "workspace_memberships" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "SystemRole",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_memberships_workspace_id_user_id_key" ON "workspace_memberships"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "workspace_memberships_organization_id_user_id_idx" ON "workspace_memberships"("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "workspace_memberships_membership_id_idx" ON "workspace_memberships"("membership_id");

CREATE TABLE IF NOT EXISTS "teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "description" VARCHAR(500),
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");
CREATE INDEX IF NOT EXISTS "teams_organization_id_idx" ON "teams"("organization_id");
CREATE INDEX IF NOT EXISTS "teams_workspace_id_idx" ON "teams"("workspace_id");

CREATE TABLE IF NOT EXISTS "team_memberships" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "SystemRole" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_memberships_team_id_user_id_key" ON "team_memberships"("team_id", "user_id");
CREATE INDEX IF NOT EXISTS "team_memberships_organization_id_user_id_idx" ON "team_memberships"("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "team_memberships_membership_id_idx" ON "team_memberships"("membership_id");

CREATE TABLE IF NOT EXISTS "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(500),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_organization_id_key_key" ON "roles"("organization_id", "key");
CREATE INDEX IF NOT EXISTS "roles_organization_id_idx" ON "roles"("organization_id");

CREATE TABLE IF NOT EXISTS "permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(500),
    "category" VARCHAR(64) NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_key" ON "permissions"("key");

CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

CREATE TABLE IF NOT EXISTS "membership_roles" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "membership_roles_membership_id_role_id_key" ON "membership_roles"("membership_id", "role_id");
CREATE INDEX IF NOT EXISTS "membership_roles_role_id_idx" ON "membership_roles"("role_id");

CREATE TABLE IF NOT EXISTS "user_permission_overrides" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_permission_overrides_membership_id_permission_id_key" ON "user_permission_overrides"("membership_id", "permission_id");
CREATE INDEX IF NOT EXISTS "user_permission_overrides_organization_id_user_id_idx" ON "user_permission_overrides"("organization_id", "user_id");

-- Foreign keys
ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "workspaces_organization_id_fkey";
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_memberships" DROP CONSTRAINT IF EXISTS "workspace_memberships_workspace_id_fkey";
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships" DROP CONSTRAINT IF EXISTS "workspace_memberships_membership_id_fkey";
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_organization_id_fkey";
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_workspace_id_fkey";
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "team_memberships" DROP CONSTRAINT IF EXISTS "team_memberships_team_id_fkey";
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_memberships" DROP CONSTRAINT IF EXISTS "team_memberships_membership_id_fkey";
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_organization_id_fkey";
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_role_id_fkey";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permission_id_fkey";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_roles" DROP CONSTRAINT IF EXISTS "membership_roles_membership_id_fkey";
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_roles" DROP CONSTRAINT IF EXISTS "membership_roles_role_id_fkey";
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permission_overrides" DROP CONSTRAINT IF EXISTS "user_permission_overrides_organization_id_fkey";
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" DROP CONSTRAINT IF EXISTS "user_permission_overrides_membership_id_fkey";
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" DROP CONSTRAINT IF EXISTS "user_permission_overrides_permission_id_fkey";
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_active_workspace_id_fkey";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_workspace_id_fkey" FOREIGN KEY ("active_workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "campaign_budgets" DROP CONSTRAINT IF EXISTS "campaign_budgets_organization_id_fkey";
ALTER TABLE "campaign_budgets" ADD CONSTRAINT "campaign_budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
