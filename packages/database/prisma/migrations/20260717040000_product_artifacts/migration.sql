-- Product Media & Artifact Engine

CREATE TYPE "ArtifactType" AS ENUM ('image', 'video', 'external_video', 'document', 'model_3d', 'spin_set', 'structured_data', 'generated_asset', 'other');
CREATE TYPE "ArtifactPurpose" AS ENUM ('primary', 'gallery', 'lifestyle', 'variant', 'packaging', 'dimensions', 'installation', 'demonstration', 'manual', 'specification', 'warranty', 'compliance', 'regulatory', 'marketing', 'supplier_evidence', 'other');
CREATE TYPE "ArtifactSourceType" AS ENUM ('connector', 'supplier', 'marketplace', 'merchant_upload', 'public_url', 'generated', 'import');
CREATE TYPE "ArtifactRightsStatus" AS ENUM ('unknown', 'supplier_authorized', 'merchant_owned', 'marketplace_limited', 'licensed', 'generated', 'restricted');
CREATE TYPE "ArtifactPublicationStatus" AS ENUM ('discovered', 'pending_ingestion', 'processing', 'ready', 'validation_failed', 'restricted', 'published', 'removed', 'unavailable');
CREATE TYPE "ArtifactVisibility" AS ENUM ('internal', 'listing_eligible', 'public', 'restricted');

CREATE TABLE "product_artifacts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "artifact_type" "ArtifactType" NOT NULL,
    "purpose" "ArtifactPurpose" NOT NULL DEFAULT 'other',
    "source_type" "ArtifactSourceType" NOT NULL,
    "source_connector_id" UUID,
    "source_platform" VARCHAR(64),
    "external_id" VARCHAR(128),
    "external_url" VARCHAR(2000),
    "storage_key" VARCHAR(500),
    "filename" VARCHAR(500),
    "mime_type" VARCHAR(128),
    "extension" VARCHAR(32),
    "file_size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" DOUBLE PRECISION,
    "page_count" INTEGER,
    "checksum" VARCHAR(128),
    "perceptual_hash" VARCHAR(128),
    "title" VARCHAR(500),
    "alt_text" VARCHAR(1000),
    "description" TEXT,
    "language" VARCHAR(16),
    "rights_status" "ArtifactRightsStatus" NOT NULL DEFAULT 'unknown',
    "publication_status" "ArtifactPublicationStatus" NOT NULL DEFAULT 'discovered',
    "visibility" "ArtifactVisibility" NOT NULL DEFAULT 'internal',
    "quality_score" INTEGER,
    "completeness_score" INTEGER,
    "confidence" DOUBLE PRECISION,
    "source_created_at" TIMESTAMPTZ(3),
    "source_updated_at" TIMESTAMPTZ(3),
    "collected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMPTZ(3),
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "raw_source_json" JSONB,
    "parent_artifact_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_artifacts_organization_id_product_id_checksum_key" ON "product_artifacts"("organization_id", "product_id", "checksum");
CREATE INDEX "product_artifacts_organization_id_product_id_idx" ON "product_artifacts"("organization_id", "product_id");
CREATE INDEX "product_artifacts_organization_id_publication_status_idx" ON "product_artifacts"("organization_id", "publication_status");

ALTER TABLE "product_artifacts" ADD CONSTRAINT "product_artifacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_artifacts" ADD CONSTRAINT "product_artifacts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
