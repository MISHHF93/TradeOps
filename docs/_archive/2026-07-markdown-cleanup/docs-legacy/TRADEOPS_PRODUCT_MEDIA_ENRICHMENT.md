# Product Media Enrichment

## Goal

Whenever TradeOps fetches products from online sources or fixtures, the **digital twin** captures:

* title / naming  
* full description  
* brand & manufacturer  
* rating & review count  
* primary + gallery images  
* packaging / document / video slots  
* structured merchandising attributes (bullets, color, size, GTIN/MPN, …)

## Schema (Product)

| Field | Purpose |
|-------|---------|
| `primaryImageUrl` | Denormalized hero for lists/scanner |
| `galleryImageUrlsJson` | Source gallery URLs |
| `mediaJson` | Full media descriptors (kind, purpose, dims) |
| `attributesJson` | Structured attributes |
| `mediaCount` | Count of media assets |
| Existing | title, description, rating, reviewCount, brand, … |

Full twin remains in **`ProductArtifact`** (storage, rights, channel readiness).

## Canonical offer (`CanonicalProductOffer`)

Connectors return:

* `imageUrl`, `imageUrls[]`, `media[]`  
* `brand`, `manufacturer`, `attributes`  
* rating / reviewCount / description  

## Import path

```text
Connector searchProducts
→ Product upsert (media + attributes)
→ Artifact bootstrap (local stubs + external URL registration)
→ Optional remote binary ingest (SSRF-safe)
```

## Fixtures

Fixture supplier catalog seeds stable picsum URLs per SKU plus rich attributes so Discover and product detail always show media without live credentials.

## Online connectors (future)

Shopify GraphQL / Amazon / AliExpress adapters map product media APIs into the same `CanonicalProductOffer` shape so normalization stays one path.
