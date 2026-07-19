#!/usr/bin/env node
/**
 * Start (or ensure) a local Prisma Postgres (PGlite) server for TradeOps.
 *
 * Root-cause history:
 * - Windows Job Object / free-ports / IDE stop leave PGlite lock files behind.
 * - Next start then hangs or "never becomes queryable".
 * - API dies with "Server has closed the connection" → browser ERR_CONNECTION_REFUSED.
 *
 * This script clears stale locks, kills zombie listeners, waits until Prisma can
 * actually query, and keeps a parent process alive while prisma dev runs.
 *
 * Usage:
 *   node scripts/prisma-dev-db.mjs           # start and keep running
 *   node scripts/prisma-dev-db.mjs --print   # print DATABASE_URL if healthy
 *   node scripts/prisma-dev-db.mjs --stop    # stop named server + clear locks
 *
 * Env:
 *   PRISMA_DEV_DB_PORT  (default 51214)
 *   PRISMA_DEV_NAME     (default tradeops)
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logDir = join(root, '.stack-logs');
const isWin = process.platform === 'win32';
const name = process.env.PRISMA_DEV_NAME || 'tradeops';
const dbPort = Number(process.env.PRISMA_DEV_DB_PORT || 51214);
const connectionString = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;
const mutexPath = join(logDir, 'db-start.mutex');

mkdirSync(logDir, { recursive: true });

/**
 * Resolve prisma CLI entry (node script). Prefer direct path — `pnpm exec prisma`
 * often fails on Windows with ERR_PNPM_RECURSIVE_EXEC / "Command prisma not found"
 * when run from detached launchers, which is a primary cause of permanent stack death.
 */
function resolvePrismaEntry() {
  const candidates = [
    join(root, 'packages', 'database', 'node_modules', 'prisma', 'build', 'index.js'),
    join(root, 'node_modules', 'prisma', 'build', 'index.js'),
    join(root, 'node_modules', '.pnpm', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Last resort: try requiring resolve from database package
  try {
    const r = spawnSync(
      process.execPath,
      ['-e', "console.log(require.resolve('prisma/build/index.js'))"],
      {
        cwd: join(root, 'packages', 'database'),
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    const p = (r.stdout || '').trim();
    if (p && existsSync(p)) return p;
  } catch {
    /* ignore */
  }
  return null;
}

function runPrisma(args, opts = {}) {
  const entry = resolvePrismaEntry();
  if (!entry) {
    console.error('Prisma CLI not found. Run: pnpm install && pnpm --filter @tradeops/database generate');
    return { status: 1, stdout: '', stderr: 'prisma CLI missing' };
  }
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: join(root, 'packages', 'database'),
    encoding: 'utf8',
    windowsHide: true,
    env: process.env,
    ...opts,
  });
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

function prismaCanQuery(url, timeoutMs = 12_000) {
  const script = `
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const t = setTimeout(() => { try { p.$disconnect(); } catch {} process.exit(2); }, ${timeoutMs});
    p.$queryRawUnsafe('SELECT 1 AS x')
      .then(() => p.$disconnect().then(() => { clearTimeout(t); process.exit(0); }))
      .catch((e) => {
        console.error(e && e.message ? e.message : e);
        clearTimeout(t);
        p.$disconnect().finally(() => process.exit(1));
      });
  `;
  const r = spawnSync(process.execPath, ['-e', script], {
    cwd: join(root, 'packages', 'database'),
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: url },
    timeout: timeoutMs + 3000,
  });
  return r.status === 0;
}

function tryUnlink(p) {
  if (!p || !existsSync(p)) return false;
  try {
    unlinkSync(p);
    if (!existsSync(p)) {
      console.log(`Cleared stale lock ${p}`);
      return true;
    }
  } catch {
    /* fall through to cmd del */
  }
  try {
    spawnSync(isWin ? 'cmd.exe' : 'rm', isWin ? ['/c', 'del', '/f', '/q', p] : ['-f', p], {
      stdio: 'ignore',
    });
    if (!existsSync(p)) {
      console.log(`Cleared stale lock ${p}`);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function walkUnlink(dir, names) {
  if (!dir || !existsSync(dir)) return;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkUnlink(full, names);
      continue;
    }
    if (names.has(ent.name.toLowerCase())) tryUnlink(full);
  }
}

/**
 * Prisma Dev / PGlite leaves lock files when killed (Job Object, free-ports, IDE stop).
 * Holding them causes "Lock file is already being held" and a non-queryable port.
 */
export function clearStaleLocks() {
  const base = join(
    process.env.LOCALAPPDATA || process.env.HOME || '',
    'prisma-dev-nodejs',
    'Data',
  );
  if (!base || !existsSync(base)) return;

  const lockNames = new Set([
    'server.lock',
    'server.lock.lock',
    'postmaster.pid',
    '.lock',
  ]);

  try {
    const streams = join(base, 'durable-streams', name);
    for (const f of ['server.lock', 'server.lock.lock']) {
      tryUnlink(join(streams, f));
    }
    // Named instance dir
    const dataDir = join(base, name);
    tryUnlink(join(dataDir, '.lock'));
    tryUnlink(join(dataDir, 'postmaster.pid'));
    tryUnlink(join(dataDir, '.pglite', 'postmaster.pid'));
    walkUnlink(dataDir, lockNames);
    // Also clear any other tradeops* leftovers that block name reuse
    try {
      for (const ent of readdirSync(base, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        if (ent.name === name || ent.name.startsWith(`${name}`)) {
          walkUnlink(join(base, ent.name), lockNames);
        }
      }
    } catch {
      /* ignore */
    }
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
    // Only kill LISTEN owners on the port + prisma CLI processes that own this instance.
    // Do NOT match bare port numbers in command lines (avoids killing supervisors/probes).
    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'prisma\\\\build\\\\index\\.js|prisma dev|\"dev\" --name' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { encoding: 'utf8', timeout: 15_000 },
    );
  } catch {
    /* ignore */
  }
  // netstat fallback
  try {
    const out = spawnSync('cmd.exe', ['/c', `netstat -ano | findstr :${port}`], {
      encoding: 'utf8',
    });
    const pids = new Set();
    for (const line of (out.stdout || '').split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    }
  } catch {
    /* ignore */
  }
}

function stopNamedServer() {
  try {
    runPrisma(['dev', 'stop', name], { stdio: 'ignore', timeout: 20_000 });
    runPrisma(['dev', 'rm', name], { stdio: 'ignore', timeout: 20_000 });
  } catch {
    /* ignore */
  }
}

function acquireMutex(timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (existsSync(mutexPath)) {
        try {
          const age = Date.now() - statSync(mutexPath).mtimeMs;
          if (age > 180_000) tryUnlink(mutexPath);
        } catch {
          tryUnlink(mutexPath);
        }
      }
      const fd = openSync(mutexPath, 'wx');
      writeFileSync(mutexPath, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      closeSync(fd);
      return true;
    } catch {
      // another starter holds mutex — if DB became healthy, we can bail
      if (prismaCanQuery(connectionString)) return false;
      spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1500)'], { stdio: 'ignore' });
    }
  }
  // force take over
  tryUnlink(mutexPath);
  try {
    writeFileSync(mutexPath, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    return true;
  } catch {
    return true;
  }
}

function releaseMutex() {
  try {
    if (existsSync(mutexPath)) {
      const raw = readFileSync(mutexPath, 'utf8');
      const j = JSON.parse(raw);
      if (!j.pid || j.pid === process.pid) tryUnlink(mutexPath);
    }
  } catch {
    tryUnlink(mutexPath);
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

async function waitUntilQueryable(maxSec = 120) {
  for (let i = 0; i < maxSec; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if ((await portOpen(dbPort)) && prismaCanQuery(connectionString)) {
      return true;
    }
  }
  return false;
}

async function hardResetPort() {
  console.warn(`Hard-resetting PGlite on port ${dbPort}…`);
  killPortListeners(dbPort);
  // also free shadow stream ports commonly used by prisma dev
  for (const p of [dbPort + 1, dbPort + 2, 51215, 51216]) {
    if (p !== dbPort) killPortListeners(p);
  }
  stopNamedServer();
  clearStaleLocks();
  await new Promise((r) => setTimeout(r, 1500));
  clearStaleLocks();
}

async function main() {
  const printOnly = process.argv.includes('--print');
  const stopOnly = process.argv.includes('--stop');

  if (stopOnly) {
    await hardResetPort();
    releaseMutex();
    console.log('Prisma Dev stopped and locks cleared.');
    process.exit(0);
  }

  // Already healthy → optional keep-alive (parent for stack launchers)
  if ((await portOpen(dbPort)) && prismaCanQuery(connectionString)) {
    console.log(`Prisma Dev DB healthy on 127.0.0.1:${dbPort}`);
    console.log(`DATABASE_URL=${connectionString}`);
    patchEnvFile();
    if (printOnly) process.exit(0);
    // Keep alive with soft probes — do NOT exit on a single blip
    let fails = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((r) => setTimeout(r, 20_000));
      const open = await portOpen(dbPort);
      const ok = open && prismaCanQuery(connectionString);
      if (ok) {
        fails = 0;
        continue;
      }
      fails += 1;
      console.error(`Prisma Dev health blip (${fails}/3) open=${open}`);
      if (fails >= 3) {
        console.error('Prisma Dev DB became unhealthy — exiting so supervisor can restart.');
        process.exit(1);
      }
    }
  }

  if (printOnly) {
    console.error(`Prisma Dev DB not healthy on port ${dbPort}`);
    process.exit(1);
  }

  // Port open but not queryable → zombie
  if (await portOpen(dbPort)) {
    console.warn(
      `Port ${dbPort} is open but Prisma cannot query — treating as zombie PGlite. Restarting…`,
    );
    await hardResetPort();
  }

  const gotMutex = acquireMutex();
  if (!gotMutex) {
    // Peer starter finished and DB is healthy
    if (prismaCanQuery(connectionString)) {
      console.log(`Prisma Dev DB healthy (peer started) on 127.0.0.1:${dbPort}`);
      console.log(`DATABASE_URL=${connectionString}`);
      patchEnvFile();
      // Stay alive as a lightweight health parent
      let fails = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await new Promise((r) => setTimeout(r, 20_000));
        if ((await portOpen(dbPort)) && prismaCanQuery(connectionString)) {
          fails = 0;
          continue;
        }
        fails += 1;
        if (fails >= 3) process.exit(1);
      }
    }
  }

  try {
    clearStaleLocks();
    const prismaEntry = resolvePrismaEntry();
    if (!prismaEntry) {
      releaseMutex();
      console.error('Prisma CLI not found under packages/database/node_modules/prisma');
      process.exit(1);
    }
    console.log(`Starting Prisma Dev (PGlite) name=${name} db-port=${dbPort}…`);
    console.log(`  prisma=${prismaEntry}`);

    const spawnPrismaDev = () =>
      spawn(
        process.execPath,
        [prismaEntry, 'dev', '--name', name, '-P', String(dbPort)],
        {
          cwd: join(root, 'packages', 'database'),
          stdio: 'inherit',
          windowsHide: true,
          env: process.env,
          detached: false,
        },
      );

    let child = spawnPrismaDev();

    let ok = await waitUntilQueryable(90);
    if (!ok) {
      console.error('Prisma Dev started but never became queryable — hard reset and retry once.');
      try {
        if (isWin && child.pid) {
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          child.kill('SIGTERM');
        }
      } catch {
        /* ignore */
      }
      await hardResetPort();
      // Force-remove "already running" ghost by stopping named server again
      stopNamedServer();
      clearStaleLocks();
      await new Promise((r) => setTimeout(r, 1000));
      child = spawnPrismaDev();
      ok = await waitUntilQueryable(90);
    }

    releaseMutex();

    if (!ok) {
      console.error('Prisma Dev retry failed — not queryable.');
      try {
        if (child.pid) {
          spawnSync(
            isWin ? 'taskkill' : 'kill',
            isWin ? ['/PID', String(child.pid), '/T', '/F'] : ['-9', String(child.pid)],
            { stdio: 'ignore' },
          );
        }
      } catch {
        /* ignore */
      }
      process.exit(1);
    }

    console.log(`DATABASE_URL=${connectionString}`);
    console.log('Prisma Dev DB is queryable.');
    patchEnvFile();

    child.on('exit', (code, signal) => {
      console.error(`prisma dev exited code=${code} signal=${signal ?? ''}`);
      clearStaleLocks();
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
      clearStaleLocks();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (e) {
    releaseMutex();
    throw e;
  }
}

main().catch((err) => {
  releaseMutex();
  console.error(err);
  process.exit(1);
});
