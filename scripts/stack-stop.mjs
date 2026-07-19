#!/usr/bin/env node
/**
 * Full local stack teardown: free ports + kill supervisor/watchdog + clear locks.
 * Usage: node scripts/stack-stop.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logDir = join(root, '.stack-logs');
const isWin = process.platform === 'win32';
const nodeBin = process.execPath;

function killPid(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return;
  try {
    if (isWin) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(Number(pid), 'SIGTERM');
    }
    console.log(`  killed PID ${pid}`);
  } catch {
    /* ignore */
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readPidFile(name) {
  const p = join(logDir, name);
  if (!existsSync(p)) return null;
  try {
    return Number(String(readFileSync(p, 'utf8')).trim());
  } catch {
    return null;
  }
}

console.log('TradeOps stack-stop');

// 1) Kill supervisor + watchdog first so they don't revive services mid-teardown
for (const lockName of ['supervisor.lock', 'watchdog.lock']) {
  const lock = readJson(join(logDir, lockName));
  if (lock?.pid) {
    console.log(`  stopping ${lockName} pid=${lock.pid}`);
    killPid(lock.pid);
  }
}
for (const f of ['watchdog.pid', 'db.pid', 'api.pid', 'web.pid']) {
  const pid = readPidFile(f);
  if (pid) {
    console.log(`  stopping ${f}=${pid}`);
    killPid(pid);
  }
}

// 2) Free ports (also kills listeners)
spawnSync(
  nodeBin,
  [join(root, 'scripts', 'free-ports.mjs'), '3000', '4000', '51213', '51214', '51215', '51216'],
  { cwd: root, stdio: 'inherit', windowsHide: true },
);

// 3) Stop prisma dev + clear locks
spawnSync(nodeBin, [join(root, 'scripts', 'prisma-dev-db.mjs'), '--stop'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
  timeout: 60_000,
});

// 4) Remove lock files so next stack:up is clean
for (const f of [
  'supervisor.lock',
  'watchdog.lock',
  'db-start.mutex',
  'supervisor.heartbeat',
  'db.pid',
  'api.pid',
  'web.pid',
  'watchdog.pid',
]) {
  try {
    const p = join(logDir, f);
    if (existsSync(p)) unlinkSync(p);
  } catch {
    /* ignore */
  }
}

console.log('Stack stopped.');
