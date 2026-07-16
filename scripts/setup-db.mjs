#!/usr/bin/env node
/**
 * First-time database setup: generate client, migrate, seed.
 * Requires Postgres at DATABASE_URL (default localhost:5432).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const pnpm = isWin ? 'pnpm.cmd' : 'pnpm';

function run(args, label) {
  console.log(`\n→ ${label}`);
  const r = spawnSync(pnpm, args, { cwd: root, stdio: 'inherit', shell: isWin, env: process.env });
  if (r.status !== 0) {
    console.error(`\nFailed: ${label} (exit ${r.status})`);
    console.error('Is PostgreSQL running? Default URL:');
    console.error('  postgresql://tradeops:tradeops@localhost:5432/tradeops?schema=public');
    console.error('With Docker:  docker compose up -d');
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(join(root, '.env')) && existsSync(join(root, '.env.example'))) {
  copyFileSync(join(root, '.env.example'), join(root, '.env'));
  console.log('Created .env from .env.example');
}

console.log('TradeOps database setup');
run(['db:generate'], 'Generate Prisma client');
run(['db:migrate:deploy'], 'Apply migrations');
run(['db:seed'], 'Seed demo merchant + fixture products');

console.log(`
Setup complete.

  Local identity (AUTH_BYPASS): founder@tradeops.local / org demo-commerce
  No login UI — open the terminal directly.

  Start stack: npm start
               (or: pnpm start)

  Product:     http://localhost:3000  →  /terminal
`);
