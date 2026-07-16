# ADR-0003: Tooling that survives restricted Windows hosts

**Status:** Accepted  
**Date:** 2026-07-15

## Context

On some developer machines, Windows Application Control blocks unsigned native addons (e.g. Turbo, Rollup, esbuild, SWC native, msgpackr-extract). That breaks common JS toolchain defaults even when pure TypeScript compiles fine.

## Decision

1. **Orchestration:** Use `pnpm -r` scripts instead of Turborepo for task running (Turbo remains optional later where native binaries are allowed).
2. **Tests:** Use Node.js built-in `node:test` + `node:assert` via `scripts/run-node-tests.mjs` after `tsc`.
3. **API/worker dev:** Compile with `tsc` and run with `node` (no `tsx`).
4. **Next.js:** Prefer WASM SWC fallback when native SWC is blocked (`NEXT_DISABLE_SWC_NATIVE` behavior is automatic in Next when native fails).
5. **Install:** Document `pnpm install --ignore-scripts` when optional native postinstalls fail; always run `pnpm db:generate` explicitly.

CI on Linux remains the source of truth for full native tooling; local Windows must still typecheck, test, and build without native turbo/vitest.

## Consequences

- Slightly less sophisticated local task caching than Turbo.
- Tests are standard Node tests — portable and policy-friendly.
- Revisit Turborepo/Vitest when the environment allows native modules.

## Supersedes

None (soft supersedes turbo.json usage for local runs).
