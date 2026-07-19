# Release Runbook

## Before release

1. Read `TRADEOPS_PRODUCTION_AUDIT.md`  
2. Fix Critical/High open issues or accept as blockers  
3. `pnpm test` · `pnpm build`  
4. Deploy staging · smoke (`pnpm e2e:smoke`)  
5. Verify tenant isolation + AI approvals + connector honesty  
6. Review public messaging (no false live claims)  
7. Privacy/terms review  
8. Backup production DB  

## Production

1. Deploy revision  
2. `pnpm db:migrate:deploy` (includes product artifacts)  
3. Health: `/api/v1/health/live`  
4. Confirm `TRADEOPS_ACCESS_MODE` is **not** `founder_direct` on public multi-user hosts  
5. Register / login / org (authenticated mode)  
6. AI workspace shadow run  
7. Workflow template list/run dry  
8. Live examples catalog loads  
9. Product artifact list/bootstrap on a test product  
10. Public pages + sitemap + robots  
11. Confirm `/terminal` noindex  

## Rollback

Redeploy previous image tags; reverse migration only with explicit plan.
