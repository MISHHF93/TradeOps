-- Client-owned commerce operating capital (managed commerce — not pooled fund)

CREATE TYPE "CapitalAccountStatus" AS ENUM (
  'pending_verification',
  'additional_information_required',
  'payments_enabled',
  'funding_enabled',
  'payout_disabled',
  'active',
  'restricted',
  'suspended',
  'closed'
);
CREATE TYPE "MandateStatus" AS ENUM ('draft', 'approved', 'paused', 'revoked');
CREATE TYPE "MandateRiskLevel" AS ENUM ('conservative', 'balanced', 'growth');
CREATE TYPE "AllocationStatus" AS ENUM ('proposed', 'approved', 'reserved', 'deployed', 'reconciling', 'closed', 'cancelled');
CREATE TYPE "FundingIntentStatus" AS ENUM ('created', 'provider_opened', 'pending', 'confirmed', 'failed', 'cancelled');

CREATE TABLE "commerce_capital_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_type" VARCHAR(32) NOT NULL DEFAULT 'business',
    "provider" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "provider_account_id" VARCHAR(128),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CAD',
    "status" "CapitalAccountStatus" NOT NULL DEFAULT 'pending_verification',
    "verification_json" JSONB NOT NULL DEFAULT '{}',
    "capability_json" JSONB NOT NULL DEFAULT '{}',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "commerce_capital_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commerce_capital_accounts_organization_id_currency_key" ON "commerce_capital_accounts"("organization_id", "currency");
CREATE INDEX "commerce_capital_accounts_organization_id_status_idx" ON "commerce_capital_accounts"("organization_id", "status");
ALTER TABLE "commerce_capital_accounts" ADD CONSTRAINT "commerce_capital_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "commerce_mandates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capital_account_id" UUID NOT NULL,
    "maximum_capital_minor" INTEGER NOT NULL,
    "maximum_product_exposure_minor" INTEGER NOT NULL DEFAULT 0,
    "maximum_daily_spend_minor" INTEGER NOT NULL DEFAULT 0,
    "maximum_monthly_spend_minor" INTEGER NOT NULL DEFAULT 0,
    "maximum_advertising_minor" INTEGER NOT NULL DEFAULT 0,
    "maximum_refund_exposure_minor" INTEGER NOT NULL DEFAULT 0,
    "minimum_margin_bps" INTEGER NOT NULL DEFAULT 0,
    "approval_threshold_minor" INTEGER NOT NULL DEFAULT 0,
    "maximum_delivery_days" INTEGER NOT NULL DEFAULT 30,
    "allowed_channels_json" JSONB NOT NULL DEFAULT '[]',
    "allowed_categories_json" JSONB NOT NULL DEFAULT '[]',
    "allowed_countries_json" JSONB NOT NULL DEFAULT '["CA"]',
    "risk_level" "MandateRiskLevel" NOT NULL DEFAULT 'conservative',
    "status" "MandateStatus" NOT NULL DEFAULT 'draft',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "commerce_mandates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commerce_mandates_organization_id_status_idx" ON "commerce_mandates"("organization_id", "status");
CREATE INDEX "commerce_mandates_capital_account_id_idx" ON "commerce_mandates"("capital_account_id");
ALTER TABLE "commerce_mandates" ADD CONSTRAINT "commerce_mandates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_mandates" ADD CONSTRAINT "commerce_mandates_capital_account_id_fkey" FOREIGN KEY ("capital_account_id") REFERENCES "commerce_capital_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "capital_allocations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capital_account_id" UUID NOT NULL,
    "mandate_id" UUID,
    "commerce_case_id" UUID,
    "product_id" UUID,
    "amount_reserved_minor" INTEGER NOT NULL DEFAULT 0,
    "amount_deployed_minor" INTEGER NOT NULL DEFAULT 0,
    "amount_returned_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'proposed',
    "economics_json" JSONB NOT NULL DEFAULT '{}',
    "evidence_json" JSONB NOT NULL DEFAULT '{}',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "capital_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "capital_allocations_organization_id_idempotency_key_key" ON "capital_allocations"("organization_id", "idempotency_key");
CREATE INDEX "capital_allocations_organization_id_capital_account_id_status_idx" ON "capital_allocations"("organization_id", "capital_account_id", "status");
ALTER TABLE "capital_allocations" ADD CONSTRAINT "capital_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capital_allocations" ADD CONSTRAINT "capital_allocations_capital_account_id_fkey" FOREIGN KEY ("capital_account_id") REFERENCES "commerce_capital_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capital_allocations" ADD CONSTRAINT "capital_allocations_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "commerce_mandates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "funding_intents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "capital_account_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "FundingIntentStatus" NOT NULL DEFAULT 'created',
    "provider" VARCHAR(32) NOT NULL DEFAULT 'sandbox',
    "provider_reference" VARCHAR(128),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "funding_intents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "funding_intents_organization_id_idempotency_key_key" ON "funding_intents"("organization_id", "idempotency_key");
CREATE INDEX "funding_intents_organization_id_capital_account_id_status_idx" ON "funding_intents"("organization_id", "capital_account_id", "status");
ALTER TABLE "funding_intents" ADD CONSTRAINT "funding_intents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "funding_intents" ADD CONSTRAINT "funding_intents_capital_account_id_fkey" FOREIGN KEY ("capital_account_id") REFERENCES "commerce_capital_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
