-- Product watchlist for opportunity tracking (org-scoped)

CREATE TABLE IF NOT EXISTS "product_watchlist_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_watchlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_watchlist_items_organization_id_product_id_key"
  ON "product_watchlist_items"("organization_id", "product_id");
CREATE INDEX IF NOT EXISTS "product_watchlist_items_organization_id_idx"
  ON "product_watchlist_items"("organization_id");

ALTER TABLE "product_watchlist_items" DROP CONSTRAINT IF EXISTS "product_watchlist_items_organization_id_fkey";
ALTER TABLE "product_watchlist_items" ADD CONSTRAINT "product_watchlist_items_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_watchlist_items" DROP CONSTRAINT IF EXISTS "product_watchlist_items_product_id_fkey";
ALTER TABLE "product_watchlist_items" ADD CONSTRAINT "product_watchlist_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
