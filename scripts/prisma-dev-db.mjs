#!/usr/bin/env node
/**
 * Start (or ensure) a local Prisma Postgres (PGlite) server for TradeOps.
 *
 * Used on machines where system Postgres / Docker / embedded-postgres are blocked
 * (e.g. Windows Application Control). Prisma Dev exposes a standard Postgres wire
 * port so Prisma migrate/seed and the Nest API work unchanged.
 *
 * Usage:
 *   node scripts/prisma-dev-db.mjs           # start and keep running
 *   node scripts/prisma-dev-db.mjs --print   # print DATABASE_URL if already up
 *
 * Env:
 *   PRISMA_DEV_DB_PORT  (default 51214)
 *   PRISMA_DEV_NAME     (default tradeops)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const name = process.env.PRISMA_DEV_NAME || 'tradeops';
const dbPort = Number(process.env.PRISMA_DEV_DB_PORT || 51214);
// pgbouncer=true disables prepared statements (required for PGlite + Prisma).
const connectionString = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;

function resolvePnpm() {
  if (isWin) {
    try {
      const lines = spawnSync('where.exe', ['pnpm'], { encoding: 'utf8' })
        .stdout.trim()
        .split(/\r?\n/)
        .filter(Boolean);
      const cmd = lines.find((l) => l.toLowerCase().endsWith('.cmd'));
      if (cmd && existsSync(cmd)) return cmd;
    } catch {
      /* fall through */
    }
    const fallback = join(process.env.APPDATA || '', 'npm', 'pnpm.cmd');
    if (existsSync(fallback)) return fallback;
    return 'pnpm.cmd';
  }
  return 'pnpm';
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function patchEnvFile() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  let text = readFileSync(envPath, 'utf8');
  const line = `DATABASE_URL=${connectionString}`;
  if (/^DATABASE_URL=/m.test(text)) {
    text = text.replace(/^DATABASE_URL=.*$/m, line);
  } else {
    text = `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(envPath, text, 'utf8');
}

async function main() {
  const printOnly = process.argv.includes('--print');

  if (await portOpen(dbPort)) {
    console.log(`Prisma Dev DB already listening on 127.0.0.1:${dbPort}`);
    console.log(`DATABASE_URL=${connectionString}`);
    patchEnvFile();
    if (printOnly) process.exit(0);
    // Keep process alive so npm-run scripts that expect a long-lived child stay up.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((r) => setTimeout(r, 60_000));
      if (!(await portOpen(dbPort))) {
        console.error('Prisma Dev DB port closed unexpectedly.');
        process.exit(1);
      }
    }
  }

  if (printOnly) {
    console.error(`Prisma Dev DB not running on port ${dbPort}`);
    process.exit(1);
  }

  console.log(`Starting Prisma Dev (PGlite) name=${name} db-port=${dbPort}…`);
  const pnpm = resolvePnpm();
  const args = [
    '--filter',
    '@tradeops/database',
    'exec',
    'prisma',
    'dev',
    '--name',
    name,
    '-P',
    String(dbPort),
  ];

  const child = isWin
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', pnpm, ...args], {
        cwd: root,
        stdio: 'inherit',
        windowsHide: true,
        env: process.env,
      })
    : spawn(pnpm, args, { cwd: root, stdio: 'inherit', env: process.env });

  // Wait until the wire port accepts connections, then patch .env.
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await portOpen(dbPort)) {
      console.log(`DATABASE_URL=${connectionString}`);
      patchEnvFile();
      break;
    }
  }

  child.on('exit', (code, signal) => {
    console.error(`prisma dev exited code=${code} signal=${signal ?? ''}`);
    process.exit(code ?? 1);
  });

  const shutdown = () => {
    try {
      if (isWin && child.pid) {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
