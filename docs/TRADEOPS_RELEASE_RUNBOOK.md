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
2. `pnpm db:migrate:deploy`  
3. Health: `/api/v1/health/live`  
4. Register / login / org  
5. AI workspace shadow run  
6. Workflow template list/run dry  
7. Public pages + sitemap + robots  
8. Confirm `/terminal` noindex  

## Rollback

Redeploy previous image tags; reverse migration only with explicit plan.
