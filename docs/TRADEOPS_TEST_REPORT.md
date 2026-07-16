# Test Report — 2026-07-16

## Package tests (executed)

| Package | Result |
|---------|--------|
| `@tradeops/auth` | 4 pass |
| `@tradeops/commerce-engine` | 13 pass |
| `@tradeops/ai-runtime` | 3 pass |
| `@tradeops/harmonization` | 3 pass |
| `@tradeops/connector-google-merchant` | 3 pass |
| `@tradeops/connector-core` | 1 pass |
| `@tradeops/workflow-engine` | run with package test |

## Smoke

`pnpm e2e:smoke` against running stack:

- health live  
- public capabilities  
- public unit economics  
- seed login  
- AI operator shadow  
- workflow templates  
- public web pages  

## Build

- `pnpm --filter @tradeops/api build` — pass  
- `pnpm --filter @tradeops/web build` — pass (SWC warning on App Control Windows)

## CI

`.github/workflows/ci.yml` — typecheck, lint, test, migrate, build on Postgres 16 + Redis 7.
