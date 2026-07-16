-- Product provenance / identity columns used by harmonization and AI evidence
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" VARCHAR(200);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer" VARCHAR(200);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "condition" VARCHAR(64);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "country_of_origin" VARCHAR(2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hs_code" VARCHAR(16);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_provenance" VARCHAR(128);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "raw_payload_ref" VARCHAR(128);
