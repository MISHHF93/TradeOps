#!/usr/bin/env node
/**
 * One-shot local bootstrap for TradeOps (App Control–friendly).
 *
 * 1) Ensure .env from .env.example
 * 2) Start Prisma Dev (PGlite) if DATABASE_URL port is down
 * 3) Generate / migrate / seed
 * 4) Print how to start the product
 *
 * Usage: pnpm run bootstrap:local
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const pnpm = isWin ? 'pnpm.cmd' : 'pnpm';

function loadEnvFile() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function parsePort(url) {
  try {
    const u = new URL(String(url).replace(/^postgresql:/, 'http:').replace(/^postgres:/, 'http:'));
    return Number(u.port || 5432);
  } catch {
    return 5432;
  }
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
    s.setTimeout(800, () => {
      s.destroy();
      resolve(false);
    });
  });
}

function run(args, label) {
  console.log(`\n→ ${label}`);
  const r = spawnSync(pnpm, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`Failed: ${label}`);
    process.exit(r.status ?? 1);
  }
}

async function ensurePglite() {
  const fileEnv = loadEnvFile();
  const url =
    process.env.DATABASE_URL ||
    fileEnv.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:51214/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5';
  const port = parsePort(url);
  if (await portOpen(port)) {
    console.log(`Database already up on port ${port}`);
    process.env.DATABASE_URL = url;
    return url;
  }

  const dbPort = Number(process.env.PRISMA_DEV_DB_PORT || 51214);
  const pgliteUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;
  console.log(`Starting Prisma Dev (PGlite) on ${dbPort}…`);

  const child = spawn(process.execPath, [join(root, 'scripts', 'prisma-dev-db.mjs')], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await portOpen(dbPort)) break;
  }
  if (!(await portOpen(dbPort))) {
    console.error('Could not start PGlite. Try: pnpm run db:pglite');
    process.exit(1);
  }

  process.env.DATABASE_URL = pgliteUrl;
  // Patch .env
  const envPath = join(root, '.env');
  if (existsSync(envPath)) {
    let text = readFileSync(envPath, 'utf8');
    const line = `DATABASE_URL=${pgliteUrl}`;
    text = /^DATABASE_URL=/m.test(text)
      ? text.replace(/^DATABASE_URL=.*$/m, line)
      : `${text.trimEnd()}\n${line}\n`;
    writeFileSync(envPath, text, 'utf8');
  }
  return pgliteUrl;
}

async function main() {
  console.log('TradeOps — local bootstrap');

  const example = join(root, '.env.example');
  const envPath = join(root, '.env');
  if (!existsSync(envPath) && existsSync(example)) {
    copyFileSync(example, envPath);
    console.log('Created .env from .env.example');
  }

  await ensurePglite();
  run(['run', 'setup:db'], 'Migrate + seed');

  console.log(`
Bootstrap complete.

  Start product:  npm start
  (optional)      pnpm run demo:loop   # after API is up — fills full pipeline

  Open:           http://localhost:3000
  Local mode:     AUTH_BYPASS (no login) · demo org demo-commerce
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
