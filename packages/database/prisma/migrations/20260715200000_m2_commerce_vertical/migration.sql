-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('not_configured', 'credentials_required', 'connected', 'authorization_expired', 'permission_limited', 'rate_limited', 'unhealthy', 'disabled');
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'pending_approval', 'active', 'paused', 'rejected');
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE "ApprovalKind" AS ENUM ('publish_listing', 'supplier_purchase_order', 'price_change', 'simulation_only');
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
CREATE TYPE "PolicyOutcome" AS ENUM ('approved', 'approved_with_conditions', 'manual_review', 'blocked');
CREATE TYPE "CommerceSignalType" AS ENUM ('BUY', 'SELL', 'HOLD', 'SCALE', 'REDUCE', 'EXIT', 'BLOCKED');

CREATE TABLE "connector_installations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider_key" VARCHAR(64) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "family" VARCHAR(32) NOT NULL,
    "is_fixture" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'not_configured',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "last_health_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "connector_installations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "source_platform" VARCHAR(64) NOT NULL,
    "external_id" VARCHAR(128) NOT NULL,
    "reliability_score" INTEGER NOT NULL DEFAULT 70,
    "data_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "collected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "source_platform" VARCHAR(64) NOT NULL,
    "external_id" VARCHAR(128) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "supplier_cost_minor" INTEGER NOT NULL,
    "shipping_cost_minor" INTEGER NOT NULL,
    "target_price_minor" INTEGER NOT NULL,
    "marketplace_fee_minor" INTEGER NOT NULL,
    "payment_fee_minor" INTEGER NOT NULL,
    "ad_allocation_minor" INTEGER NOT NULL DEFAULT 0,
    "return_reserve_minor" INTEGER NOT NULL DEFAULT 0,
    "inventory_quantity" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "data_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "data_freshness_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schema_version" VARCHAR(16) NOT NULL DEFAULT '1',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_offers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "product_id" UUID,
    "source_platform" VARCHAR(64) NOT NULL,
    "external_id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "cost_minor" INTEGER NOT NULL,
    "shipping_cost_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "inventory_quantity" INTEGER NOT NULL DEFAULT 0,
    "data_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "collected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "supplier_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_channels" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "provider_key" VARCHAR(64) NOT NULL,
    "is_fixture" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sales_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sales_channel_id" UUID NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "external_id" VARCHAR(128),
    "price_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "sku" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "formula_version" VARCHAR(64) NOT NULL,
    "components_json" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "expected_profit_minor" INTEGER NOT NULL,
    "expected_margin_bps" INTEGER NOT NULL,
    "demand_score" INTEGER NOT NULL,
    "trend_score" INTEGER NOT NULL,
    "competition_score" INTEGER NOT NULL,
    "supplier_reliability" INTEGER NOT NULL,
    "shipping_reliability" INTEGER NOT NULL,
    "review_health" INTEGER NOT NULL,
    "return_risk_score" INTEGER NOT NULL,
    "policy_risk_score" INTEGER NOT NULL,
    "forecast_confidence" DOUBLE PRECISION NOT NULL,
    "current_signal" "CommerceSignalType" NOT NULL,
    "scored_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_signals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID,
    "signal" "CommerceSignalType" NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commerce_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "demand_forecasts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "horizon_days" INTEGER NOT NULL,
    "expected_units" INTEGER NOT NULL,
    "low_units" INTEGER NOT NULL,
    "high_units" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model_version" VARCHAR(64) NOT NULL,
    "factors_json" JSONB NOT NULL,
    "missing_json" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "policy_assessments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "outcome" "PolicyOutcome" NOT NULL,
    "reasons_json" JSONB NOT NULL,
    "risk_flags_json" JSONB NOT NULL,
    "fail_closed" BOOLEAN NOT NULL,
    "assessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_platform" VARCHAR(64) NOT NULL,
    "external_id" VARCHAR(128) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "currency" VARCHAR(3) NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "placed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_order_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "sku" VARCHAR(128) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,
    CONSTRAINT "customer_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_purchase_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "customer_order_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "cost_minor" INTEGER NOT NULL,
    "shipping_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "supplier_purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_order_id" UUID NOT NULL,
    "status" VARCHAR(64) NOT NULL,
    "tracking_number" VARCHAR(128),
    "carrier" VARCHAR(64),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "listing_id" UUID,
    "supplier_purchase_order_id" UUID,
    "requested_by_user_id" UUID,
    "note" VARCHAR(500),
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "simulation_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "signal" "CommerceSignalType" NOT NULL,
    "simulated_units" INTEGER NOT NULL,
    "predicted_profit_minor" INTEGER NOT NULL,
    "actual_profit_minor" INTEGER,
    "predicted_units" INTEGER NOT NULL,
    "actual_units" INTEGER,
    "assumptions_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profitability_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "revenue_minor" INTEGER NOT NULL,
    "contribution_profit_minor" INTEGER NOT NULL,
    "net_margin_bps" INTEGER NOT NULL,
    "cash_required_minor" INTEGER NOT NULL,
    "breakdown_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profitability_snapshots_pkey" PRIMARY KEY ("id")
);

-- Indexes & FKs
CREATE UNIQUE INDEX "connector_installations_organization_id_provider_key_key" ON "connector_installations"("organization_id", "provider_key");
CREATE INDEX "connector_installations_organization_id_idx" ON "connector_installations"("organization_id");
CREATE UNIQUE INDEX "suppliers_organization_id_source_platform_external_id_key" ON "suppliers"("organization_id", "source_platform", "external_id");
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");
CREATE UNIQUE INDEX "products_organization_id_source_platform_external_id_key" ON "products"("organization_id", "source_platform", "external_id");
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");
CREATE UNIQUE INDEX "supplier_offers_organization_id_source_platform_external_id_key" ON "supplier_offers"("organization_id", "source_platform", "external_id");
CREATE INDEX "supplier_offers_organization_id_product_id_idx" ON "supplier_offers"("organization_id", "product_id");
CREATE UNIQUE INDEX "sales_channels_organization_id_provider_key_key" ON "sales_channels"("organization_id", "provider_key");
CREATE INDEX "listings_organization_id_status_idx" ON "listings"("organization_id", "status");
CREATE UNIQUE INDEX "opportunities_organization_id_product_id_key" ON "opportunities"("organization_id", "product_id");
CREATE INDEX "opportunities_organization_id_score_idx" ON "opportunities"("organization_id", "score");
CREATE INDEX "commerce_signals_organization_id_created_at_idx" ON "commerce_signals"("organization_id", "created_at");
CREATE INDEX "demand_forecasts_organization_id_product_id_idx" ON "demand_forecasts"("organization_id", "product_id");
CREATE INDEX "policy_assessments_organization_id_product_id_idx" ON "policy_assessments"("organization_id", "product_id");
CREATE UNIQUE INDEX "customer_orders_organization_id_source_platform_external_id_key" ON "customer_orders"("organization_id", "source_platform", "external_id");
CREATE INDEX "customer_orders_organization_id_idx" ON "customer_orders"("organization_id");
CREATE INDEX "customer_order_lines_order_id_idx" ON "customer_order_lines"("order_id");
CREATE INDEX "supplier_purchase_orders_organization_id_idx" ON "supplier_purchase_orders"("organization_id");
CREATE INDEX "fulfillments_organization_id_idx" ON "fulfillments"("organization_id");
CREATE INDEX "approvals_organization_id_status_idx" ON "approvals"("organization_id", "status");
CREATE INDEX "simulation_runs_organization_id_product_id_idx" ON "simulation_runs"("organization_id", "product_id");
CREATE INDEX "profitability_snapshots_organization_id_product_id_idx" ON "profitability_snapshots"("organization_id", "product_id");

ALTER TABLE "connector_installations" ADD CONSTRAINT "connector_installations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_channels" ADD CONSTRAINT "sales_channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listings" ADD CONSTRAINT "listings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listings" ADD CONSTRAINT "listings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listings" ADD CONSTRAINT "listings_sales_channel_id_fkey" FOREIGN KEY ("sales_channel_id") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_signals" ADD CONSTRAINT "commerce_signals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_signals" ADD CONSTRAINT "commerce_signals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_assessments" ADD CONSTRAINT "policy_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_assessments" ADD CONSTRAINT "policy_assessments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_order_lines" ADD CONSTRAINT "customer_order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_order_lines" ADD CONSTRAINT "customer_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_customer_order_id_fkey" FOREIGN KEY ("customer_order_id") REFERENCES "customer_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_customer_order_id_fkey" FOREIGN KEY ("customer_order_id") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_supplier_purchase_order_id_fkey" FOREIGN KEY ("supplier_purchase_order_id") REFERENCES "supplier_purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profitability_snapshots" ADD CONSTRAINT "profitability_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profitability_snapshots" ADD CONSTRAINT "profitability_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
