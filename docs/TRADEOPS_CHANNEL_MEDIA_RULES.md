# TradeOps Channel Media Rules

**Status:** Readiness scoring operational · Live publish credential-gated  

## Google Merchant

| Rule | TradeOps check |
|------|----------------|
| Primary `image_link` | Primary ready image present |
| Additional images | Count of non-primary ready images |
| Resolution | min(width,height) ≥ 500 (guidance; mandatory 500×500 announced for 2027-01-31) |
| High-res recommended | ≥ 1000 on min edge |
| Rights | Not `unknown` / `restricted` / `marketplace_limited` for primary |
| Listing eligible | Primary + resolution + visibility not restricted |

## Shopify (GraphQL product media)

| Capability | Status |
|------------|--------|
| Images, hosted video, YouTube/Vimeo external, 3D models | Connector capability matrix; live GraphQL publish **credential-gated** |
| Alt text, media processing status | Mapped in model fields; live sync incomplete |
| Legacy REST image patterns | Avoid when GraphQL available |

## eBay (Media API)

| Capability | Status |
|------------|--------|
| Create image from file/URL, video, regulatory docs | Capability-declared; live **credential-gated** |
| Associate video IDs with inventory/listings | Planned with Media API |
| Legacy `UploadSiteHostedPictures` | **Do not build** — decommission announced 2026-09-30 |

## Amazon (SP-API Catalog Items)

| Capability | Status |
|------------|--------|
| Retrieve catalog image sets | Credential-gated when SP-API authorized |
| Republish / modify catalog images | **Not implied** — respect seller app permissions |

## Capability matrix (connector-core)

Connectors declare media capabilities explicitly, including:

`readProductImages`, `readProductVideos`, `readDocuments`, `readThreeDimensionalModels`,
`uploadImage`, `uploadVideo`, `attachImageToListing`, `attachVideoToListing`,
`attachRegulatoryDocument`, `deleteMedia`, `reorderMedia`, `setPrimaryImage`,
`readMediaProcessingStatus`.

Fixture supplier currently declares: `readProductImages`, `readDocuments`.
