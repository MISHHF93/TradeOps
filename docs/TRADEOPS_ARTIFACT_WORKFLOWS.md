# TradeOps Artifact Workflows

**Status:** Interactive product workflows operational · Background workers partial  

## Operator workflows (UI)

| Action | API | Result | Downstream |
|--------|-----|--------|------------|
| Discover / bootstrap | `POST …/artifacts/bootstrap` | ProductArtifact rows + files | Completeness, readiness |
| Refresh list | `GET …/artifacts` | DTO + scores | Media workspace |
| Ingest authorized URL | `POST …/artifacts/ingest-url` | New or deduped artifact | Rights unknown |
| Set primary image | `POST …/set-primary` | Purpose swap primary/gallery | Google readiness |
| Open document | `GET …/content` | Stream | Operator review |
| Save channel selection | Planned | ListingArtifact | Listing validation |
| Retry processing | Planned | ArtifactJob | Media worker |

## Rules

- No dead media buttons: only wire controls with real handlers.
- Bootstrap is idempotent (checksum).
- Unknown rights never silently flip to merchant-owned.
- Channel publish remains approval- and credential-gated.

## Audit

- `product.artifacts.bootstrap`
- `product.artifact.ingested`
