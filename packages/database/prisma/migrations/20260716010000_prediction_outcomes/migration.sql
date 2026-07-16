-- CreateTable
CREATE TABLE "prediction_outcomes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "model_version" VARCHAR(64) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "predicted_units" INTEGER NOT NULL,
    "actual_units" INTEGER NOT NULL,
    "predicted_profit_minor" INTEGER NOT NULL,
    "actual_profit_minor" INTEGER NOT NULL,
    "signal_at_prediction" VARCHAR(16),
    "signal_correct" BOOLEAN,
    "unit_absolute_error" INTEGER NOT NULL,
    "profit_absolute_error" INTEGER NOT NULL,
    "notes" VARCHAR(500),
    "evaluated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prediction_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "version" VARCHAR(64) NOT NULL,
    "family" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "metrics_json" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "model_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prediction_outcomes_organization_id_evaluated_at_idx" ON "prediction_outcomes"("organization_id", "evaluated_at");
CREATE INDEX "prediction_outcomes_organization_id_product_id_idx" ON "prediction_outcomes"("organization_id", "product_id");
CREATE UNIQUE INDEX "model_versions_organization_id_version_family_key" ON "model_versions"("organization_id", "version", "family");

ALTER TABLE "prediction_outcomes" ADD CONSTRAINT "prediction_outcomes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prediction_outcomes" ADD CONSTRAINT "prediction_outcomes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_versions" ADD CONSTRAINT "model_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
