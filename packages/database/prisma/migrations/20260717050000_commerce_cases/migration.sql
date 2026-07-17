-- Canonical commerce lifecycle spine (CommerceCase)

CREATE TYPE "CommerceStage" AS ENUM (
  'discover', 'evaluate', 'qualify', 'prepare', 'approve', 'publish',
  'sell', 'source', 'fulfill', 'reconcile', 'learn', 'closed'
);

CREATE TYPE "CommerceStageStatus" AS ENUM (
  'not_started', 'ready', 'in_progress', 'waiting', 'blocked', 'completed', 'failed'
);

CREATE TABLE "commerce_cases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "selected_supplier_offer_id" UUID,
    "selected_channel_id" UUID,
    "listing_draft_id" UUID,
    "published_listing_id" UUID,
    "current_stage" "CommerceStage" NOT NULL DEFAULT 'discover',
    "stage_status" "CommerceStageStatus" NOT NULL DEFAULT 'not_started',
    "recommendation" VARCHAR(64),
    "opportunity_score" INTEGER,
    "confidence" DOUBLE PRECISION,
    "expected_profit_minor" INTEGER,
    "realized_profit_minor" INTEGER,
    "next_action_code" VARCHAR(64),
    "next_action_label" VARCHAR(500),
    "blocker_code" VARCHAR(64),
    "blocker_message" VARCHAR(1000),
    "owner_user_id" UUID,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "stage_history_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commerce_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commerce_cases_organization_id_product_id_key" ON "commerce_cases"("organization_id", "product_id");
CREATE INDEX "commerce_cases_organization_id_current_stage_idx" ON "commerce_cases"("organization_id", "current_stage");
CREATE INDEX "commerce_cases_organization_id_stage_status_idx" ON "commerce_cases"("organization_id", "stage_status");

ALTER TABLE "commerce_cases" ADD CONSTRAINT "commerce_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_cases" ADD CONSTRAINT "commerce_cases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
