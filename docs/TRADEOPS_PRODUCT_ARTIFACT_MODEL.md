# TradeOps Product Artifact Model

**Status:** Operational foundations (local/dev)  
**Date:** 2026-07-16 (deepened)

## Purpose

`ProductArtifact` is the canonical first-class media and document model for the Product Digital Twin. Images, videos, documents, 3D assets, and structured artifacts attach to products without bloating the `Product` core schema.

## Canonical model

Prisma model: `ProductArtifact` → table `product_artifacts`.

| Field group | Fields |
|-------------|--------|
| Identity | `id`, `organizationId`, `productId`, `variantId?` |
| Classification | `artifactType`, `purpose` |
| Provenance | `sourceType`, `sourceConnectorId?`, `sourcePlatform?`, `externalId?`, `externalUrl?`, `rawSourceJson?` |
| Storage | `storageKey?`, `filename?`, `mimeType?`, `extension?`, `fileSizeBytes?` |
| Technical | `width?`, `height?`, `durationSeconds?`, `pageCount?`, `checksum?`, `perceptualHash?` |
| Editorial | `title?`, `altText?`, `description?`, `language?` |
| Governance | `rightsStatus`, `publicationStatus`, `visibility` |
| Quality | `qualityScore?`, `completenessScore?`, `confidence?` |
| Timing | `sourceCreatedAt?`, `sourceUpdatedAt?`, `collectedAt`, `validatedAt?` |
| Extensibility | `metadataJson`, `parentArtifactId?` (derivatives / lineage) |

### Enums

- **artifactType:** `image` · `video` · `external_video` · `document` · `model_3d` · `spin_set` · `structured_data` · `generated_asset` · `other`
- **purpose:** `primary` · `gallery` · `lifestyle` · `variant` · `packaging` · `dimensions` · `installation` · `demonstration` · `manual` · `specification` · `warranty` · `compliance` · `regulatory` · `marketing` · `supplier_evidence` · `other`
- **sourceType:** `connector` · `supplier` · `marketplace` · `merchant_upload` · `public_url` · `generated` · `import`
- **rightsStatus:** `unknown` · `supplier_authorized` · `merchant_owned` · `marketplace_limited` · `licensed` · `generated` · `restricted`
- **publicationStatus:** `discovered` → `pending_ingestion` → `processing` → `ready` / `validation_failed` / `restricted` / `published` / `removed` / `unavailable`
- **visibility:** `internal` · `listing_eligible` · `public` · `restricted`

## Relationships

| Link | How |
|------|-----|
| Canonical product | `productId` FK (required) |
| Variant | `variantId` optional |
| Connector | `sourceConnectorId` + `sourcePlatform` |
| Derivatives | `parentArtifactId` + storage keys under same artifact tree |
| Listing drafts | Media plan returns **artifact ID references** (no file copy) |
| AI evaluation | `metadataJson.lastAnalysis` proposal objects |

## Deduplication

- Unique index: `(organizationId, productId, checksum)` for exact duplicates.
- `perceptualHash` for near-duplicate *signals* (shown as relationships; never auto-delete uncertain matches).
- List response includes `duplicates.exact` / `duplicates.near`.

## Operation status matrix

| Operation | Status |
|-----------|--------|
| List / bootstrap / set-primary / content proxy | **operational** |
| Remote URL ingest (SSRF-safe) | **operational** |
| Local object storage | **operational** |
| Duplicate detection | **operational** |
| AI rule-based analysis proposals | **operational** |
| Listing media plan | **operational** |
| Google readiness scoring | **operational** |
| Supplier feed discovery adapter | **operational** (local) |
| Shopify GraphQL media publish | **credential_blocked** |
| eBay Media API publish | **credential_blocked** (not UploadSiteHostedPictures) |
| Amazon Catalog image retrieve | **credential_blocked** |
| Google live Merchant sync | **credential_blocked** |
| S3/GCS/R2 providers | **incomplete** |
| Multipart merchant upload | **incomplete** |
| Async video worker | **incomplete** |

## Honesty labels

- Fixture-sourced media: **TEST FIXTURE — NOT LIVE DATA**
- Generated placeholders: `sourceType=generated` or fixture supplier
- Remote URL ingest: rights remain `unknown` until verified
- AI analysis: always `proposal: true`, `humanReviewRequired: true`
