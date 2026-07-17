-- Multi-tenant SaaS foundations: segment, plan, persona, usage meters

CREATE TYPE "CustomerSegment" AS ENUM ('individual', 'smb', 'agency', 'enterprise');
CREATE TYPE "PlanTier" AS ENUM ('starter', 'growth', 'agency', 'business', 'enterprise', 'evaluation');
CREATE TYPE "TenantDeploymentMode" AS ENUM ('pooled', 'siloed', 'bridge');
CREATE TYPE "WorkspacePersona" AS ENUM ('founder', 'operator', 'analyst', 'procurement', 'finance', 'executive', 'agency', 'auditor');

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "segment" "CustomerSegment" NOT NULL DEFAULT 'individual';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan_tier" "PlanTier" NOT NULL DEFAULT 'evaluation';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "deployment_mode" "TenantDeploymentMode" NOT NULL DEFAULT 'pooled';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "parent_organization_id" UUID;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "business_model" VARCHAR(64);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_step" VARCHAR(64) NOT NULL DEFAULT 'created';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboarding_complete" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "workspace_persona" "WorkspacePersona" NOT NULL DEFAULT 'founder';

CREATE TABLE IF NOT EXISTS "usage_meters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "metric_key" VARCHAR(64) NOT NULL,
    "period_key" VARCHAR(16) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "organizations_parent_organization_id_idx" ON "organizations"("parent_organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "usage_meters_organization_id_metric_key_period_key_key" ON "usage_meters"("organization_id", "metric_key", "period_key");
CREATE INDEX IF NOT EXISTS "usage_meters_organization_id_period_key_idx" ON "usage_meters"("organization_id", "period_key");

ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_parent_organization_id_fkey";
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_organization_id_fkey" FOREIGN KEY ("parent_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_meters" DROP CONSTRAINT IF EXISTS "usage_meters_organization_id_fkey";
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
