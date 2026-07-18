/**
 * Regenerate docs/environment/ENVIRONMENT_INVENTORY.md from PLATFORM_ENV_MANIFEST.
 * Never writes secret values.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Prefer dist; fall back to building expectation
let m;
try {
  m = require(join(root, 'packages/config/dist/environment-manifest.js'));
} catch {
  console.error('Build @tradeops/config first: pnpm --filter @tradeops/config build');
  process.exit(1);
}

const manifest = m.PLATFORM_ENV_MANIFEST;
const tenants = m.TENANT_SCOPED_CREDENTIAL_NAMES;
const aliases = m.ENV_ALIASES;
const required = m.listRequiredProductionEnv();
const secrets = m.listManifestSecrets();

const bySub = new Map();
for (const row of manifest) {
  if (!bySub.has(row.subsystem)) bySub.set(row.subsystem, []);
  bySub.get(row.subsystem).push(row);
}

const lines = [];
const push = (s = '') => lines.push(s);

push('# TradeOps Environment Inventory');
push('');
push('**Generated from `PLATFORM_ENV_MANIFEST`** (code-derived).  ');
push('**Secrets:** names only — never store real values in this document.');
push('');
push(`_Generated: ${new Date().toISOString()}_`);
push('');
push('## Stack (discovered)');
push('');
push('| Layer | Technology |');
push('|-------|------------|');
push('| Monorepo | pnpm workspaces |');
push('| API | NestJS `apps/api` |');
push('| Web | Next.js 15 `apps/web` |');
push('| Worker | `apps/worker` |');
push('| Database | PostgreSQL + Prisma (`@tradeops/database`); local Prisma Dev / PGlite |');
push('| Cache / queues | Redis (optional locally) |');
push('| Auth / tenancy | Session auth + `TRADEOPS_ACCESS_MODE` |');
push('| AI | `@tradeops/ai-runtime` — **Cohere code-first** (`AI_PROVIDER=cohere`) |');
push('| Config | `@tradeops/config` (Zod `loadEnv` + AI platform + financial gates + manifest) |');
push('| Connectors | `@tradeops/connectors/live-http` probeCredentials + tenant vault |');
push('| Deploy | Dockerfiles, `docker-compose.yml` |');
push('');
push('## Counts');
push('');
push('| Metric | Count |');
push('|--------|------:|');
push(`| Canonical manifest rows | ${manifest.length} |`);
push(`| Required in production | ${required.length} |`);
push(`| Secret flags | ${secrets.length} |`);
push(`| Tenant vault credential names | ${tenants.length} |`);
push(`| Alias mappings | ${Object.keys(aliases).length} |`);
push('');
push('## How to regenerate');
push('');
push('```bash');
push('node scripts/scan-env-keys.mjs');
push('pnpm --filter @tradeops/config build');
push('node scripts/write-env-inventory.mjs');
push('```');
push('');
push('## Canonical files');
push('');
push('| File | Role |');
push('|------|------|');
push('| `packages/config/src/environment-manifest.ts` | Typed inventory + production requirements |');
push('| `packages/config/src/env-validation.ts` | Fail-closed production validation |');
push('| `packages/config/src/index.ts` | Zod core `loadEnv()` |');
push('| `packages/config/src/ai-platform-config.ts` | Cohere / search / tool policy |');
push('| `packages/config/src/financial-gates.ts` | Legal capital gates |');
push('| `packages/config/src/security-boot.ts` | Bind + secret strength boot gates |');
push('| `.env.example` | Full safe template |');
push('| `env.vendors.template` | Optional vendor key paste sheet |');
push('');
push('## Required in production');
push('');
push(required.map((n) => `- \`${n}\``).join('\n'));
push('');
push('## Manifest by subsystem');
push('');

for (const [sub, rows] of [...bySub.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  push(`### ${sub} (${rows.length})`);
  push('');
  push('| Name | Secret | Prod req | Storage | Description |');
  push('|------|:------:|:--------:|---------|-------------|');
  for (const r of rows) {
    const desc = (r.description || '').replace(/\|/g, '\\|');
    const dep = r.deprecated ? ' _(deprecated)_' : '';
    push(
      `| \`${r.name}\` | ${r.secret ? 'yes' : ''} | ${r.requiredInProduction ? 'yes' : ''} | ${r.storage} | ${desc}${dep} |`,
    );
  }
  push('');
}

push('## Tenant-scoped credential names');
push('');
push('Merchant credentials for multi-tenant production belong in the encrypted connector vault:');
push('');
for (const n of tenants) {
  push(`- \`${n}\``);
}
push('');
push('## Aliases (legacy → canonical)');
push('');
push('| Alias | Canonical |');
push('|-------|-----------|');
for (const [a, c] of Object.entries(aliases).sort((x, y) => x[0].localeCompare(y[0]))) {
  push(`| \`${a}\` | \`${c}\` |`);
}
push('');
push('## Compromised key policy');
push('');
push('Any API key pasted into chat, tickets, or logs is **compromised**. Rotate it; do not reuse. Leave `COHERE_API_KEY=` blank in templates.');
push('');

const outPath = join(root, 'docs/environment/ENVIRONMENT_INVENTORY.md');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outPath} (${manifest.length} vars)`);
