# ADR-0002: Connector isolation and canonical models

**Status:** Proposed  
**Date:** 2026-07-15

## Context

TradeOps must not be built around a single marketplace. Leaking provider SDKs or schemas into the dashboard or core domain recreates the classic “Shopify app with extras” trap and blocks multi-channel scale.

## Decision

1. All provider SDKs and provider-specific types live **only** in `packages/connectors/<provider>`.
2. `packages/connector-core` defines the universal capability interfaces, auth adapters, rate limiting, sync runtime, and health model.
3. Domain services consume **canonical entities** and **connector commands**, never provider payloads.
4. `ExternalIdMap` is the only bridge between internal IDs and external IDs.
5. UI capability gates read the installation’s **capability matrix**, not hard-coded provider names (except admin diagnostics).
6. Lint/CI boundary checks will fail imports of connector packages from `apps/web` and from non-connector domain packages.

## Consequences

- Adding a marketplace is a new package + registration, not a core rewrite.
- Some provider-specific features surface only when the capability exists (honest UX).
- Slight indirection cost vs calling Shopify directly — accepted.

## Supersedes

None.
