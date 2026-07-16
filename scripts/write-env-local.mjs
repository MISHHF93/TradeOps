import { writeFileSync } from 'node:fs';

const c = `# Platform
NODE_ENV=development
LOG_LEVEL=info

# Apps
API_PORT=4000
API_HOST=0.0.0.0
WEB_PORT=3000
WEB_ORIGIN=http://localhost:3000
API_PUBLIC_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_PUBLIC_URL=http://127.0.0.1:4000

# Prisma Dev / PGlite
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51214/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5

# Redis
REDIS_URL=redis://localhost:6379

# Secrets
APP_SECRET=dev-only-change-me-to-a-long-random-string
CREDENTIALS_MASTER_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=

# Local-only auth bypass
AUTH_BYPASS=true

# Web API timeouts (ms) — PGlite needs more than 4s
API_TIMEOUT_MS=60000
NEXT_PUBLIC_API_TIMEOUT_MS=60000
`;

writeFileSync(new URL('../.env', import.meta.url), c);
console.log('Wrote .env');
