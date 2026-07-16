#!/usr/bin/env node
/**
 * Start an embedded PostgreSQL for local first-run (no Docker / no admin installer).
 *
 * Data dir: .data/postgres
 * Port: 5432 (or EMBEDDED_PG_PORT)
 * User/pass/db: tradeops / tradeops / tradeops
 *
 * Usage:
 *   node scripts/local-db.mjs          # start and keep running
 *   node scripts/local-db.mjs --init   # initialise cluster if needed, then start
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const EmbeddedPostgres = require('embedded-postgres').default;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.data', 'postgres');
const port = Number(process.env.EMBEDDED_PG_PORT || 5432);
const user = 'tradeops';
const password = 'tradeops';
const database = 'tradeops';

mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: (msg) => process.stdout.write(`[postgres] ${msg}`),
  onError: (msg) => process.stderr.write(`[postgres:err] ${msg}`),
});

async function main() {
  const needsInit = !existsSync(join(dataDir, 'PG_VERSION'));
  if (needsInit) {
    console.log('Initialising embedded PostgreSQL cluster…');
    await pg.initialise();
  }

  console.log(`Starting embedded PostgreSQL on 127.0.0.1:${port}…`);
  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`Database "${database}" ready.`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already exists/i.test(msg)) {
      console.log(`Database "${database}" already exists.`);
    } else {
      console.warn('createDatabase note:', msg);
    }
  }

  const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}?schema=public&connect_timeout=5`;
  writeFileSync(join(root, '.data', 'database-url.txt'), url + '\n', 'utf8');

  // Ensure root .env points at embedded DB if still defaulting to missing server
  console.log('');
  console.log('Embedded Postgres is running.');
  console.log(`  DATABASE_URL=${url}`);
  console.log('');
  console.log('In another terminal:');
  console.log('  set DATABASE_URL=' + url); // for current session docs
  console.log('  pnpm run setup:db');
  console.log('  npm start');
  console.log('');
  console.log('Leave this window open (Ctrl+C stops Postgres).');

  const stop = async () => {
    console.log('\nStopping embedded PostgreSQL…');
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  console.error('\nIf binaries were blocked by Application Control, install Docker Desktop or PostgreSQL manually.');
  process.exit(1);
});
