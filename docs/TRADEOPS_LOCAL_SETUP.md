# Local Setup

## Prerequisites

- Node ≥ 20.11, pnpm 9  
- **One** of: Docker Postgres, system Postgres, or **Prisma Dev / PGlite** (default on locked-down Windows)

Windows Application Control: if native postinstall fails:

```bash
pnpm install --ignore-scripts
pnpm db:generate
```

## Recommended path (this Windows host)

```powershell
cd C:\Users\borah\TradeOps
pnpm install
copy .env.example .env
# Ensure:
#   TRADEOPS_ACCESS_MODE=founder_direct
#   NEXT_PUBLIC_TRADEOPS_ACCESS_MODE=founder_direct
pnpm setup                    # install deps, generate, build
pnpm run bootstrap:local      # PGlite if needed + migrate + seed
npm start                     # API :4000 + Web :3000
```

### Direct Founder Access (default)

Open **http://localhost:3000** → redirects to **`/terminal/cockpit`**.

No register, login, password, email verify, or onboarding.

| Surface | URL |
|---------|-----|
| Command center | http://localhost:3000/terminal/cockpit |
| Terminal / Scanner | http://localhost:3000/terminal |
| AI Operator | http://localhost:3000/terminal/ai |
| Account / settings | http://localhost:3000/app |
| API health | http://localhost:4000/api/v1/health |
| Access mode | http://localhost:4000/api/v1/public/access-mode |
| Auth me (direct identity) | http://localhost:4000/api/v1/auth/me |

Founder identity is initialized on API boot: `founder@tradeops.local` / org `demo-commerce` (renamed display **TradeOps Founder Workspace**). Existing products and connectors are preserved.

Optional after start — fill the full commerce pipeline:

```powershell
pnpm run demo:loop
# or click “Run full demo loop” in the terminal UI
```

## Restore login UX (optional)

```env
TRADEOPS_ACCESS_MODE=authenticated
NEXT_PUBLIC_TRADEOPS_ACCESS_MODE=authenticated
AUTH_BYPASS=false
```

Then open `/login` or `/register`.

## Docker path (if Docker is available)

```bash
cp .env.example .env
# Set DATABASE_URL to docker Postgres (see .env.example option A)
docker compose up -d
pnpm install
pnpm setup
pnpm run setup:db
pnpm start
```

## Fixture connectors

No third-party credentials required. Seed installs **FIXTURE** supplier + marketplace connectors. Live connectors still need your OAuth/API credentials.

## After start — verify deployment

```powershell
pnpm e2e:smoke
```

| Check | Expected |
|-------|----------|
| http://localhost:3000/ | 307 → cockpit |
| http://localhost:4000/api/v1/health/live | `status: up` |
| Product twin media | Open any product → **Discover / bootstrap artifacts** |

Full deploy notes: [TRADEOPS_DEPLOYMENT.md](./TRADEOPS_DEPLOYMENT.md).

## Docs

- [TRADEOPS_DIRECT_FOUNDER_ACCESS.md](./TRADEOPS_DIRECT_FOUNDER_ACCESS.md)  
- [TRADEOPS_ACCESS_MODES.md](./TRADEOPS_ACCESS_MODES.md)  
- [TRADEOPS_SECURITY_MODEL.md](./TRADEOPS_SECURITY_MODEL.md)  
- [TRADEOPS_DEPLOYMENT.md](./TRADEOPS_DEPLOYMENT.md)  
- [TRADEOPS_PRODUCT_ARTIFACT_MODEL.md](./TRADEOPS_PRODUCT_ARTIFACT_MODEL.md)  
