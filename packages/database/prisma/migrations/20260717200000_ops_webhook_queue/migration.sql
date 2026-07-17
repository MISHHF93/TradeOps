-- Connector installation ops metadata
ALTER TABLE "connector_installations" ADD COLUMN IF NOT EXISTS "metadata_json" JSONB NOT NULL DEFAULT '{}';

-- Durable webhook processing queue (Postgres-backed)
DO $$ BEGIN
  CREATE TYPE "WebhookProcessingStatus" AS ENUM ('received', 'processing', 'processed', 'failed', 'dead_letter');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "processing_status" "WebhookProcessingStatus" NOT NULL DEFAULT 'received';
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMPTZ;
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "last_error" VARCHAR(1000);
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(256);
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "normalized_json" JSONB;
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "bus_event_type" VARCHAR(128);
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "webhook_receipts_organization_id_processing_status_next_retry_at_idx"
  ON "webhook_receipts" ("organization_id", "processing_status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "webhook_receipts_organization_id_idempotency_key_idx"
  ON "webhook_receipts" ("organization_id", "idempotency_key");
