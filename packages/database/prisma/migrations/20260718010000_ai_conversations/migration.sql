-- Durable AI chat conversations (Cohere runtime turns)
CREATE TABLE IF NOT EXISTS "ai_conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "title" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "status" VARCHAR(32),
    "data_mode" VARCHAR(32),
    "intent_category" VARCHAR(64),
    "information_mode" VARCHAR(64),
    "provider" VARCHAR(32),
    "model" VARCHAR(128),
    "request_id" VARCHAR(64),
    "error_code" VARCHAR(64),
    "response_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_conversations_organization_id_updated_at_idx"
  ON "ai_conversations"("organization_id", "updated_at");

CREATE INDEX IF NOT EXISTS "ai_messages_organization_id_conversation_id_created_at_idx"
  ON "ai_messages"("organization_id", "conversation_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "ai_conversations"
    ADD CONSTRAINT "ai_conversations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_messages"
    ADD CONSTRAINT "ai_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
