# TradeOps Media & Artifact Pipeline

**Status:** Operational foundations (sync path) · Async worker path planned  

## Pipeline

```text
External product record
→ discover artifact references
→ validate source (SSRF / allowlist)
→ inspect permissions / rights
→ fetch metadata
→ enqueue or sync ingest
→ download / stream (size-limited sync)
→ scan + MIME verify
→ checksum + perceptual hash
→ detect duplicates
→ store under tenant object key
→ generate derivatives (preview stubs today)
→ attach ProductArtifact to Digital Twin
→ evaluate completeness + channel readiness
→ visible in Product Media Workspace
```

## API (organization-scoped)

| Method | Path | Permission | Behavior |
|--------|------|------------|----------|
| GET | `/api/v1/products/:productId/artifacts` | `products:read` | List + completeness + channel readiness |
| POST | `/api/v1/products/:productId/artifacts/bootstrap` | `products:write` | Discover/materialize from product sources (idempotent) |
| POST | `/api/v1/products/:productId/artifacts/ingest-url` | `products:write` | Authorized remote URL ingest |
| POST | `/api/v1/products/:productId/artifacts/:id/set-primary` | `products:write` | Promote image to primary |
| GET | `/api/v1/products/:productId/artifacts/:id/content` | `products:read` | Controlled content stream (no public bucket) |

## Bootstrap behavior

Creates (when missing by checksum):

1. Primary image (generated SVG placeholder, dimensions recorded)
2. Gallery image
3. Packaging image
4. Specification document
5. User manual stub
6. External video *slot* (`discovered`, awaiting authorized URL)

Fixture products → `rightsStatus=supplier_authorized` for supplier-like images; manuals may remain `unknown`.

## Processing (current vs planned)

| Step | Images | Video | PDF/docs | 3D |
|------|--------|-------|----------|-----|
| MIME / signature | Sync allowlist | Sync allowlist | Sync allowlist | MIME allowlist |
| Dimensions / duration | Recorded on generate | Slot only | pageCount=1 stub | — |
| Thumb / preview | preview.svg key | Planned | Planned | Planned poster |
| Worker queue | Planned for >8MB | Required | Large PDFs | Large GLB |

Sync max: **8MB** (`ARTIFACT_SYNC_MAX_BYTES`). Larger files must use workers (not blocking UI requests).

## Sources supported

| Source | Status |
|--------|--------|
| Bootstrap from product record | Operational |
| Authorized remote URL | Operational (SSRF-safe) |
| Merchant upload multipart | Incomplete |
| Connector live media APIs | Capability-declared; credential-gated |
| Arbitrary scrape | **Blocked / not supported** |
