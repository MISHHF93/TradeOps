-- Product media enrichment: denormalized source images + attributes for digital twin
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "primary_image_url" VARCHAR(2000);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "gallery_image_urls_json" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "media_json" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "attributes_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "media_count" INTEGER NOT NULL DEFAULT 0;
