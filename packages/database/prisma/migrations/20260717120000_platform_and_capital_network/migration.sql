-- Platform marketplace payments + Commerce Capital Network (legally gated domains)

CREATE TYPE "ConnectedAccountRole" AS ENUM ('merchant', 'supplier', 'service_provider', 'platform');
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('not_started', 'onboarding', 'restricted', 'enabled', 'disabled', 'rejected');
CREATE TYPE "CapitalProviderStatus" AS ENUM ('pending', 'verified', 'restricted', 'rejected');
CREATE TYPE "CampaignFundingModel" AS ENUM ('prepurchase', 'commercial_financing', 'revenue_share', 'equity', 'private_agreement', 'sandbox');
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'under_review', 'legal_review_required', 'approved', 'open', 'funding', 'funded', 'active', 'paused', 'reconciling', 'completed', 'failed', 'cancelled');
CREATE TYPE "CommitmentStatus" AS ENUM ('initiated', 'identity_verification_required', 'eligibility_review', 'documents_required', 'payment_pending', 'funded', 'cancelled', 'returned', 'distributed');
CREATE TYPE "DisbursementStatus" AS ENUM ('proposed', 'approval_required', 'approved', 'processing', 'paid', 'failed', 'reversed', 'reconciled');
CREATE TYPE "DistributionStatus" AS ENUM ('calculated', 'approved', 'paid', 'failed');

CREATE TABLE "platform_connected_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "ConnectedAccountRole" NOT NULL DEFAULT 'merchant',
    "provider" VARCHAR(32) NOT NULL DEFAULT 'stripe_connect',
    "provider_account_id" VARCHAR(128),
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'not_started',
    "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "details_submitted" BOOLEAN NOT NULL DEFAULT false,
    "verification_status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "verification_provider_ref" VARCHAR(128),
    "capabilities_json" JSONB NOT NULL DEFAULT '{}',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "platform_connected_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_connected_accounts_organization_id_role_provider_key" ON "platform_connected_accounts"("organization_id", "role", "provider");
CREATE UNIQUE INDEX "platform_connected_accounts_provider_provider_account_id_key" ON "platform_connected_accounts"("provider", "provider_account_id");
CREATE INDEX "platform_connected_accounts_organization_id_status_idx" ON "platform_connected_accounts"("organization_id", "status");
ALTER TABLE "platform_connected_accounts" ADD CONSTRAINT "platform_connected_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "from_account_id" UUID,
    "to_account_id" UUID,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "platform_fee_minor" INTEGER NOT NULL DEFAULT 0,
    "purpose" VARCHAR(64) NOT NULL,
    "provider_transfer_id" VARCHAR(128),
    "status" VARCHAR(32) NOT NULL DEFAULT 'proposed',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "platform_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_transfers_organization_id_idempotency_key_key" ON "platform_transfers"("organization_id", "idempotency_key");
CREATE INDEX "platform_transfers_organization_id_status_idx" ON "platform_transfers"("organization_id", "status");
ALTER TABLE "platform_transfers" ADD CONSTRAINT "platform_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_transfers" ADD CONSTRAINT "platform_transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "platform_connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_transfers" ADD CONSTRAINT "platform_transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "platform_connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "capital_providers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "verification_status" "CapitalProviderStatus" NOT NULL DEFAULT 'pending',
    "investor_category" VARCHAR(64),
    "jurisdiction" VARCHAR(8) NOT NULL DEFAULT 'CA',
    "verification_provider_ref" VARCHAR(128),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "capital_providers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "capital_providers_organization_id_verification_status_idx" ON "capital_providers"("organization_id", "verification_status");
ALTER TABLE "capital_providers" ADD CONSTRAINT "capital_providers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "commerce_campaigns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "merchant_org_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "capital_target_minor" INTEGER NOT NULL,
    "minimum_commitment_minor" INTEGER NOT NULL DEFAULT 0,
    "maximum_commitment_minor" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CAD',
    "funding_model" "CampaignFundingModel" NOT NULL DEFAULT 'sandbox',
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "risk_rating" VARCHAR(32) NOT NULL DEFAULT 'unrated',
    "jurisdiction" VARCHAR(8) NOT NULL DEFAULT 'CA',
    "legal_review_status" VARCHAR(32) NOT NULL DEFAULT 'required',
    "product_id" UUID,
    "supplier_id" UUID,
    "start_date" TIMESTAMPTZ(3),
    "maturity_date" TIMESTAMPTZ(3),
    "economics_json" JSONB NOT NULL DEFAULT '{}',
    "waterfall_config_json" JSONB NOT NULL DEFAULT '{}',
    "risk_disclosure_json" JSONB NOT NULL DEFAULT '{}',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "commerce_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commerce_campaigns_organization_id_status_idx" ON "commerce_campaigns"("organization_id", "status");
CREATE INDEX "commerce_campaigns_merchant_org_id_idx" ON "commerce_campaigns"("merchant_org_id");
ALTER TABLE "commerce_campaigns" ADD CONSTRAINT "commerce_campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "campaign_budgets" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "inventory_budget_minor" INTEGER NOT NULL DEFAULT 0,
    "advertising_budget_minor" INTEGER NOT NULL DEFAULT 0,
    "fulfillment_budget_minor" INTEGER NOT NULL DEFAULT 0,
    "duties_budget_minor" INTEGER NOT NULL DEFAULT 0,
    "operating_reserve_minor" INTEGER NOT NULL DEFAULT 0,
    "platform_fees_minor" INTEGER NOT NULL DEFAULT 0,
    "merchant_expense_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CAD',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "campaign_budgets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "campaign_budgets_campaign_id_key" ON "campaign_budgets"("campaign_id");
ALTER TABLE "campaign_budgets" ADD CONSTRAINT "campaign_budgets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "commerce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "capital_commitments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "capital_provider_id" UUID NOT NULL,
    "committed_amount_minor" INTEGER NOT NULL,
    "funded_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CAD',
    "status" "CommitmentStatus" NOT NULL DEFAULT 'initiated',
    "provider_payment_ref" VARCHAR(128),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "capital_commitments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "capital_commitments_organization_id_campaign_id_idx" ON "capital_commitments"("organization_id", "campaign_id");
CREATE INDEX "capital_commitments_capital_provider_id_idx" ON "capital_commitments"("capital_provider_id");
ALTER TABLE "capital_commitments" ADD CONSTRAINT "capital_commitments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capital_commitments" ADD CONSTRAINT "capital_commitments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "commerce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capital_commitments" ADD CONSTRAINT "capital_commitments_capital_provider_id_fkey" FOREIGN KEY ("capital_provider_id") REFERENCES "capital_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "capital_ledger_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID,
    "journal_id" UUID NOT NULL,
    "account_code" VARCHAR(64) NOT NULL,
    "direction" VARCHAR(8) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "memo" VARCHAR(500) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "reference_type" VARCHAR(64),
    "reference_id" UUID,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capital_ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "capital_ledger_entries_organization_id_idempotency_key_key" ON "capital_ledger_entries"("organization_id", "idempotency_key");
CREATE INDEX "capital_ledger_entries_organization_id_campaign_id_account_code_idx" ON "capital_ledger_entries"("organization_id", "campaign_id", "account_code");
CREATE INDEX "capital_ledger_entries_journal_id_idx" ON "capital_ledger_entries"("journal_id");
ALTER TABLE "capital_ledger_entries" ADD CONSTRAINT "capital_ledger_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capital_ledger_entries" ADD CONSTRAINT "capital_ledger_entries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "commerce_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "capital_disbursements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "recipient_type" VARCHAR(32) NOT NULL,
    "recipient_id" UUID,
    "budget_line" VARCHAR(64) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "purpose" VARCHAR(500) NOT NULL,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'proposed',
    "approval_id" UUID,
    "evidence_json" JSONB NOT NULL DEFAULT '{}',
    "provider_payment_ref" VARCHAR(128),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "capital_disbursements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "capital_disbursements_organization_id_idempotency_key_key" ON "capital_disbursements"("organization_id", "idempotency_key");
CREATE INDEX "capital_disbursements_organization_id_campaign_id_status_idx" ON "capital_disbursements"("organization_id", "campaign_id", "status");
ALTER TABLE "capital_disbursements" ADD CONSTRAINT "capital_disbursements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capital_disbursements" ADD CONSTRAINT "capital_disbursements_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "commerce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "campaign_distributions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "recipient_type" VARCHAR(32) NOT NULL,
    "recipient_id" UUID,
    "principal_returned_minor" INTEGER NOT NULL DEFAULT 0,
    "profit_distributed_minor" INTEGER NOT NULL DEFAULT 0,
    "loss_allocated_minor" INTEGER NOT NULL DEFAULT 0,
    "fees_deducted_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'calculated',
    "calculation_version" VARCHAR(32) NOT NULL,
    "inputs_json" JSONB NOT NULL DEFAULT '{}',
    "provider_payment_ref" VARCHAR(128),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "campaign_distributions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campaign_distributions_organization_id_campaign_id_idx" ON "campaign_distributions"("organization_id", "campaign_id");
ALTER TABLE "campaign_distributions" ADD CONSTRAINT "campaign_distributions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_distributions" ADD CONSTRAINT "campaign_distributions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "commerce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
