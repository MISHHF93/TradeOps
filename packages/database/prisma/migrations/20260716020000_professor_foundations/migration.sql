-- Professor-mode foundations: loop modes, AI operator, harmonization, event fabric

CREATE TYPE "OperationLoopMode" AS ENUM ('fixture', 'development', 'shadow', 'controlled_live', 'automated_live');
CREATE TYPE "AiActionClass" AS ENUM ('read_only', 'draft', 'reversible_operational', 'financial_contractual', 'prohibited');
CREATE TYPE "OperatorRunStatus" AS ENUM ('planning', 'collecting', 'recommending', 'critic', 'auditor', 'decided', 'executing', 'awaiting_approval', 'completed', 'failed', 'blocked');
CREATE TYPE "OperatorDecision" AS ENUM ('accept', 'revise', 'downgrade', 'block', 'escalate');

CREATE TABLE "product_identifiers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID,
    "scheme" VARCHAR(32) NOT NULL,
    "value" VARCHAR(128) NOT NULL,
    "source_platform" VARCHAR(64) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_identifiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_payloads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID,
    "provider_key" VARCHAR(64) NOT NULL,
    "external_id" VARCHAR(128) NOT NULL,
    "payload_kind" VARCHAR(64) NOT NULL,
    "raw_json" JSONB NOT NULL,
    "schema_version" VARCHAR(16) NOT NULL DEFAULT '1',
    "collected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_payloads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "identity_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_product_id" UUID NOT NULL,
    "target_product_id" UUID NOT NULL,
    "match_method" VARCHAR(64) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'proposed',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "identity_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "provider_key" VARCHAR(64),
    "external_event_id" VARCHAR(128),
    "loop_mode" "OperationLoopMode" NOT NULL DEFAULT 'development',
    "is_fixture" BOOLEAN NOT NULL DEFAULT false,
    "payload_json" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "error_message" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commerce_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_receipts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider_key" VARCHAR(64) NOT NULL,
    "topic" VARCHAR(128) NOT NULL,
    "signature_valid" BOOLEAN,
    "headers_json" JSONB NOT NULL DEFAULT '{}',
    "body_json" JSONB NOT NULL,
    "commerce_event_id" UUID,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operator_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "objective" TEXT NOT NULL,
    "loop_mode" "OperationLoopMode" NOT NULL DEFAULT 'development',
    "status" "OperatorRunStatus" NOT NULL DEFAULT 'planning',
    "plan_json" JSONB NOT NULL DEFAULT '{}',
    "tool_trace_json" JSONB NOT NULL DEFAULT '[]',
    "critic_json" JSONB,
    "auditor_json" JSONB,
    "decision" "OperatorDecision",
    "decision_note" TEXT,
    "error_message" VARCHAR(500),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    CONSTRAINT "operator_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shadow_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID,
    "operator_run_id" UUID,
    "action_class" "AiActionClass" NOT NULL,
    "proposed_action" VARCHAR(128) NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "expected_outcome_json" JSONB NOT NULL,
    "would_have_executed" BOOLEAN NOT NULL DEFAULT true,
    "outcome_compared_at" TIMESTAMPTZ(3),
    "outcome_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shadow_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operator_recommendations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operator_run_id" UUID NOT NULL,
    "product_id" UUID,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "action_class" "AiActionClass" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "assumptions_json" JSONB NOT NULL,
    "missing_data_json" JSONB NOT NULL,
    "calculation_json" JSONB NOT NULL,
    "forecast_json" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "policy_risk_score" INTEGER NOT NULL DEFAULT 0,
    "approval_required" BOOLEAN NOT NULL DEFAULT true,
    "expected_outcome_json" JSONB NOT NULL,
    "critic_notes" TEXT,
    "auditor_notes" TEXT,
    "decision" "OperatorDecision",
    "approval_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operator_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connector_health_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider_key" VARCHAR(64) NOT NULL,
    "status" VARCHAR(64) NOT NULL,
    "message" VARCHAR(500),
    "latency_ms" INTEGER,
    "is_fixture" BOOLEAN NOT NULL DEFAULT false,
    "details_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connector_health_events_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_payloads" ADD CONSTRAINT "external_payloads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_payloads" ADD CONSTRAINT "external_payloads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_source_product_id_fkey" FOREIGN KEY ("source_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_links" ADD CONSTRAINT "identity_links_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commerce_events" ADD CONSTRAINT "commerce_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_receipts" ADD CONSTRAINT "webhook_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operator_runs" ADD CONSTRAINT "operator_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shadow_decisions" ADD CONSTRAINT "shadow_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shadow_decisions" ADD CONSTRAINT "shadow_decisions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shadow_decisions" ADD CONSTRAINT "shadow_decisions_operator_run_id_fkey" FOREIGN KEY ("operator_run_id") REFERENCES "operator_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operator_recommendations" ADD CONSTRAINT "operator_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operator_recommendations" ADD CONSTRAINT "operator_recommendations_operator_run_id_fkey" FOREIGN KEY ("operator_run_id") REFERENCES "operator_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operator_recommendations" ADD CONSTRAINT "operator_recommendations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connector_health_events" ADD CONSTRAINT "connector_health_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "product_identifiers_organization_id_scheme_value_source_platform_key" ON "product_identifiers"("organization_id", "scheme", "value", "source_platform");
CREATE INDEX "product_identifiers_organization_id_product_id_idx" ON "product_identifiers"("organization_id", "product_id");
CREATE INDEX "external_payloads_organization_id_provider_key_external_id_idx" ON "external_payloads"("organization_id", "provider_key", "external_id");
CREATE UNIQUE INDEX "identity_links_organization_id_source_product_id_target_product_id_key" ON "identity_links"("organization_id", "source_product_id", "target_product_id");
CREATE INDEX "identity_links_organization_id_confidence_idx" ON "identity_links"("organization_id", "confidence");
CREATE INDEX "commerce_events_organization_id_created_at_idx" ON "commerce_events"("organization_id", "created_at");
CREATE INDEX "commerce_events_organization_id_event_type_idx" ON "commerce_events"("organization_id", "event_type");
CREATE UNIQUE INDEX "commerce_events_organization_id_provider_key_external_event_id_key" ON "commerce_events"("organization_id", "provider_key", "external_event_id");
CREATE INDEX "webhook_receipts_organization_id_provider_key_received_at_idx" ON "webhook_receipts"("organization_id", "provider_key", "received_at");
CREATE INDEX "operator_runs_organization_id_started_at_idx" ON "operator_runs"("organization_id", "started_at");
CREATE INDEX "shadow_decisions_organization_id_created_at_idx" ON "shadow_decisions"("organization_id", "created_at");
CREATE INDEX "operator_recommendations_organization_id_operator_run_id_idx" ON "operator_recommendations"("organization_id", "operator_run_id");
CREATE INDEX "connector_health_events_organization_id_provider_key_created_at_idx" ON "connector_health_events"("organization_id", "provider_key", "created_at");
