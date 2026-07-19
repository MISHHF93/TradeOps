# TradeOps Artifact Storage

**Status:** Local filesystem provider operational · S3/GCS/R2 adapters planned  

## Concepts

| Concept | Role |
|---------|------|
| ArtifactStorageProvider | Abstraction (local today via `ARTIFACT_STORAGE_ROOT`) |
| ArtifactObject | Bytes at `storageKey` |
| ArtifactDerivative | e.g. `preview.svg` under same artifact id |
| ArtifactAccessPolicy | Authz via session + org scope on content endpoint |
| ArtifactLifecyclePolicy | Planned (retention / GC) |
| ArtifactPublicationReference | Channel external media IDs in `externalId` / metadata |

## Key layout

```text
organizations/{organizationId}/products/{productId}/artifacts/{artifactId}/original.{ext}
organizations/{organizationId}/products/{productId}/artifacts/{artifactId}/preview.{ext}
```

Default root: `.tradeops-storage` (cwd) or `ARTIFACT_STORAGE_ROOT`.

## Access

- **Never** expose the storage root as a public static directory.
- Content served only through `GET …/artifacts/:id/content` with session + `products:read` + org match.
- Cache-Control: `private, max-age=300`.

## Providers roadmap

| Provider | Status |
|----------|--------|
| Local filesystem | Operational (dev/local) |
| S3-compatible / R2 / GCS | Incomplete |
| Signed URLs | Incomplete (proxy first) |
