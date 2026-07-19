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

/**
 * TCP listen is not enough — zombie PGlite often holds 51214 without speaking Postgres.
 * Use Prisma query via the database package when possible.
 */
function prismaCanQuery(url) {
  const script = `
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    p.$queryRawUnsafe('SELECT 1 AS x')
      .then(() => p.$disconnect().then(() => process.exit(0)))
      .catch((e) => {
        console.error(e && e.message ? e.message : e);
        p.$disconnect().finally(() => process.exit(1));
      });
  `;
  const r = spawnSync(
    process.execPath,
    ['-e', script],
    {
      cwd: join(root, 'packages', 'database'),
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: url },
      timeout: 15_000,
    },
  );
  return r.status === 0;
}

function tryUnlink(p) {
  if (!p || !existsSync(p)) return;
  try {
    spawnSync(isWin ? 'cmd.exe' : 'rm', isWin ? ['/c', 'del', '/f', '/q', p] : ['-f', p], {
      stdio: 'ignore',
    });
    if (!existsSync(p)) console.log(`Cleared stale lock ${p}`);
  } catch {
    /* ignore */
  }
}

/**
 * Prisma Dev / PGlite leaves lock files when the process is killed (Windows Job Object,
 * IDE stop, free-ports). Holding them causes: "Lock file is already being held"
 * and API then dies with "Server has closed the connection" → ERR_CONNECTION_REFUSED.
 */
function clearStaleLocks() {
  const base = join(
    process.env.LOCALAPPDATA || process.env.HOME || '',
    'prisma-dev-nodejs',
    'Data',
  );
  if (!base || !existsSync(base)) return;
  try {
    const streams = join(base, 'durable-streams', name);
    for (const f of ['server.lock', 'server.lock.lock']) {
      tryUnlink(join(streams, f));
    }
    const dataDir = join(base, name);
    tryUnlink(join(dataDir, '.lock'));
    tryUnlink(join(dataDir, '.pglite', 'postmaster.pid'));
    // Also clear common lock name variants
    tryUnlink(join(dataDir, 'postmaster.pid'));
  } catch {
    /* ignore */
  }
}

function killPortListeners(port) {
  if (!isWin) {
    try {
      spawnSync('sh', ['-c', `lsof -ti tcp:${port} | xargs -r kill -9`], { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const out = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
      ],
      { encoding: 'utf8', timeout: 10_000 },
    );
    if (out.stdout?.trim()) console.log(out.stdout.trim());
  } catch {
    /* ignore */
  }
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

async function waitUntilQueryable(maxSec = 90) {
  for (let i = 0; i < maxSec; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if ((await portOpen(dbPort)) && prismaCanQuery(connectionString)) {
      return true;
    }
  }
  return false;
}

async function main() {
  const printOnly = process.argv.includes('--print');

  if (await portOpen(dbPort)) {
    if (prismaCanQuery(connectionString)) {
      console.log(`Prisma Dev DB healthy on 127.0.0.1:${dbPort}`);
      console.log(`DATABASE_URL=${connectionString}`);
      patchEnvFile();
      if (printOnly) process.exit(0);
      // Keep process alive so npm-run scripts that expect a long-lived child stay up.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await new Promise((r) => setTimeout(r, 60_000));
        if (!(await portOpen(dbPort)) || !prismaCanQuery(connectionString)) {
          console.error('Prisma Dev DB became unhealthy.');
          process.exit(1);
        }
      }
    }

    console.warn(
      `Port ${dbPort} is open but Prisma cannot query — treating as zombie PGlite. Restarting…`,
    );
    killPortListeners(dbPort);
    clearStaleLocks();
    // Ask prisma to stop/rm named server if CLI is available
    try {
      const pnpm = resolvePnpm();
      spawnSync(pnpm, ['--filter', '@tradeops/database', 'exec', 'prisma', 'dev', 'stop', name], {
        cwd: root,
        stdio: 'ignore',
        timeout: 15_000,
        shell: isWin,
      });
      spawnSync(pnpm, ['--filter', '@tradeops/database', 'exec', 'prisma', 'dev', 'rm', name], {
        cwd: root,
        stdio: 'ignore',
        timeout: 15_000,
        shell: isWin,
      });
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (printOnly) {
    console.error(`Prisma Dev DB not healthy on port ${dbPort}`);
    process.exit(1);
  }

  clearStaleLocks();
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

  // cmd /S /C strips outermost quotes; wrap full cmdline so paths with spaces work.
  const quote = (s) => {
    const t = String(s);
    if (!/[\s"&<>|^%]/.test(t)) return t;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const child = isWin
    ? spawn(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', `"${[quote(pnpm), ...args.map(quote)].join(' ')}"`],
        {
          cwd: root,
          stdio: 'inherit',
          windowsHide: true,
          windowsVerbatimArguments: true,
          env: process.env,
        },
      )
    : spawn(pnpm, args, { cwd: root, stdio: 'inherit', env: process.env });

  // Wait until Prisma can actually query, not just TCP accept.
  const ok = await waitUntilQueryable(90);
  if (ok) {
    console.log(`DATABASE_URL=${connectionString}`);
    console.log('Prisma Dev DB is queryable.');
    patchEnvFile();
  } else {
    console.error('Prisma Dev started but never became queryable.');
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
