# Deployment

## Principles

- Provider-independent containers  
- Local laptop not required for production  
- Separate secrets per environment  

## Services

| Service | Image/entry |
|---------|-------------|
| API | `apps/api` → `node dist/main.js` |
| Web | `apps/web` → `next start` |
| Worker | `apps/worker` (requires Redis) |
| Postgres | managed or compose |
| Redis | managed or compose |

## Docker Compose (infra)

See `docker-compose.yml` and `infra/docker/docker-compose.yml` for Postgres + Redis.

## Env (production)

- `NODE_ENV=production`
- `AUTH_BYPASS=false` (ignored if true while production)
- Strong `APP_SECRET`, `CREDENTIALS_MASTER_KEY`
- `DATABASE_URL`, `REDIS_URL`
- `WEB_ORIGIN`, `API_PUBLIC_URL`, `NEXT_PUBLIC_SITE_URL` HTTPS

## Migrations

```bash
pnpm db:migrate:deploy
```

## Cloud Run notes

Deploy API and Web as separate services; map custom domain; mount secrets from Secret Manager; run migrations as a job before traffic shift.
