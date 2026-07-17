-- Dual financial domains: SaaS billing (Stripe) + commerce payments (channel)

CREATE TYPE "BillingAccountStatus" AS ENUM ('active', 'past_due', 'suspended', 'cancelled');
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'unpaid', 'cancelled', 'incomplete');
CREATE TYPE "CommercePaymentStatus" AS ENUM ('pending', 'authorized', 'captured', 'partially_refunded', 'refunded', 'failed', 'disputed', 'cancelled');
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'in_transit', 'paid', 'failed');
CREATE TYPE "ReconciliationStatus" AS ENUM ('open', 'matched', 'variance', 'closed');

CREATE TABLE "billing_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'stripe',
    "provider_customer_id" VARCHAR(128) NOT NULL,
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'active',
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_accounts_organization_id_provider_key" ON "billing_accounts"("organization_id", "provider");
CREATE UNIQUE INDEX "billing_accounts_provider_provider_customer_id_key" ON "billing_accounts"("provider", "provider_customer_id");
CREATE INDEX "billing_accounts_organization_id_idx" ON "billing_accounts"("organization_id");
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "billing_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "provider_subscription_id" VARCHAR(128) NOT NULL,
    "plan_id" VARCHAR(64) NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'incomplete',
    "period_start" TIMESTAMPTZ(3),
    "period_end" TIMESTAMPTZ(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_subscriptions_provider_subscription_id_key" ON "billing_subscriptions"("provider_subscription_id");
CREATE INDEX "billing_subscriptions_organization_id_status_idx" ON "billing_subscriptions"("organization_id", "status");
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "billing_invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "billing_account_id" UUID NOT NULL,
    "provider_invoice_id" VARCHAR(128) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amount_due_minor" INTEGER NOT NULL,
    "amount_paid_minor" INTEGER NOT NULL DEFAULT 0,
    "hosted_invoice_url" VARCHAR(1000),
    "invoice_pdf_url" VARCHAR(1000),
    "period_start" TIMESTAMPTZ(3),
    "period_end" TIMESTAMPTZ(3),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_invoices_provider_invoice_id_key" ON "billing_invoices"("provider_invoice_id");
CREATE INDEX "billing_invoices_organization_id_idx" ON "billing_invoices"("organization_id");
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "billing_webhook_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "provider" VARCHAR(32) NOT NULL,
    "external_event_id" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "payload_json" JSONB NOT NULL,
    "error_message" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_webhook_events_provider_external_event_id_key" ON "billing_webhook_events"("provider", "external_event_id");
CREATE INDEX "billing_webhook_events_provider_event_type_idx" ON "billing_webhook_events"("provider", "event_type");
ALTER TABLE "billing_webhook_events" ADD CONSTRAINT "billing_webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "usage_meter_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "metric_key" VARCHAR(64) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" VARCHAR(128),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_meter_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usage_meter_events_organization_id_idempotency_key_key" ON "usage_meter_events"("organization_id", "idempotency_key");
CREATE INDEX "usage_meter_events_organization_id_metric_key_created_at_idx" ON "usage_meter_events"("organization_id", "metric_key", "created_at");
ALTER TABLE "usage_meter_events" ADD CONSTRAINT "usage_meter_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "commerce_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_order_id" UUID NOT NULL,
    "channel" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "external_payment_id" VARCHAR(128) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "authorized_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "captured_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "refunded_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "fee_amount_minor" INTEGER,
    "net_amount_minor" INTEGER,
    "status" "CommercePaymentStatus" NOT NULL DEFAULT 'pending',
    "raw_provider_status" VARCHAR(64),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "commerce_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commerce_payments_organization_id_provider_external_payment_id_key" ON "commerce_payments"("organization_id", "provider", "external_payment_id");
CREATE INDEX "commerce_payments_organization_id_customer_order_id_idx" ON "commerce_payments"("organization_id", "customer_order_id");
CREATE INDEX "commerce_payments_organization_id_status_idx" ON "commerce_payments"("organization_id", "status");
ALTER TABLE "commerce_payments" ADD CONSTRAINT "commerce_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_payments" ADD CONSTRAINT "commerce_payments_customer_order_id_fkey" FOREIGN KEY ("customer_order_id") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "commerce_refunds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "commerce_payment_id" UUID NOT NULL,
    "customer_order_id" UUID,
    "provider" VARCHAR(64) NOT NULL,
    "external_refund_id" VARCHAR(128) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(500),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commerce_refunds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commerce_refunds_organization_id_provider_external_refund_id_key" ON "commerce_refunds"("organization_id", "provider", "external_refund_id");
CREATE INDEX "commerce_refunds_organization_id_commerce_payment_id_idx" ON "commerce_refunds"("organization_id", "commerce_payment_id");
ALTER TABLE "commerce_refunds" ADD CONSTRAINT "commerce_refunds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_refunds" ADD CONSTRAINT "commerce_refunds_commerce_payment_id_fkey" FOREIGN KEY ("commerce_payment_id") REFERENCES "commerce_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_refunds" ADD CONSTRAINT "commerce_refunds_customer_order_id_fkey" FOREIGN KEY ("customer_order_id") REFERENCES "customer_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "commerce_disputes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "commerce_payment_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "external_dispute_id" VARCHAR(128) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(500),
    "evidence_due_by" TIMESTAMPTZ(3),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "commerce_disputes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commerce_disputes_organization_id_provider_external_dispute_id_key" ON "commerce_disputes"("organization_id", "provider", "external_dispute_id");
CREATE INDEX "commerce_disputes_organization_id_idx" ON "commerce_disputes"("organization_id");
ALTER TABLE "commerce_disputes" ADD CONSTRAINT "commerce_disputes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_disputes" ADD CONSTRAINT "commerce_disputes_commerce_payment_id_fkey" FOREIGN KEY ("commerce_payment_id") REFERENCES "commerce_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "commerce_payouts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "external_payout_id" VARCHAR(128) NOT NULL,
    "gross_amount_minor" INTEGER NOT NULL,
    "fee_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "net_amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "expected_arrival" TIMESTAMPTZ(3),
    "arrived_at" TIMESTAMPTZ(3),
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "commerce_payouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commerce_payouts_organization_id_provider_external_payout_id_key" ON "commerce_payouts"("organization_id", "provider", "external_payout_id");
CREATE INDEX "commerce_payouts_organization_id_status_idx" ON "commerce_payouts"("organization_id", "status");
ALTER TABLE "commerce_payouts" ADD CONSTRAINT "commerce_payouts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_reconciliations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "commerce_payout_id" UUID,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'open',
    "expected_net_minor" INTEGER NOT NULL DEFAULT 0,
    "actual_net_minor" INTEGER NOT NULL DEFAULT 0,
    "variance_minor" INTEGER NOT NULL DEFAULT 0,
    "matched_order_count" INTEGER NOT NULL DEFAULT 0,
    "unmatched_amount_minor" INTEGER NOT NULL DEFAULT 0,
    "summary_json" JSONB NOT NULL DEFAULT '{}',
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_reconciliations_organization_id_status_idx" ON "payment_reconciliations"("organization_id", "status");
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_commerce_payout_id_fkey" FOREIGN KEY ("commerce_payout_id") REFERENCES "commerce_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
