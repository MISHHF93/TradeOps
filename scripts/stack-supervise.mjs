#!/usr/bin/env node
/**
 * Long-lived TradeOps stack supervisor.
 *
 * - Health-checks DB :51214, API :4000, Web :3000 every INTERVAL_MS
 * - Restarts only dead services (never free-ports healthy ones)
 * - Single instance via .stack-logs/supervisor.lock
 *
 * Usage:
 *   node scripts/stack-supervise.mjs              # run in foreground
 *   node scripts/stack-supervise.mjs --daemon     # detach on Windows then exit
 *   node scripts/stack-supervise.mjs --once       # one ensure pass then exit
 *   node scripts/stack-supervise.mjs --status     # print lock + health
 */
import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  apiHealthy,
  freePort,
  isPidAlive,
  isWin,
  loadDotEnv,
  logLine,
  nodeBin,
  portOpen,
  readLock,
  root,
  logDir,
  stackPorts,
  startApi,
  startDb,
  startWeb,
  startWebDev,
  waitPort,
  webHealthy,
  writeLock,
} from './stack-lib.mjs';

const LOCK = join(logDir, 'supervisor.lock');
const INTERVAL_MS = 10_000;
const MAX_RESTARTS = 5;
const WINDOW_MS = 5 * 60 * 1000;
const args = new Set(process.argv.slice(2));
const once = args.has('--once');
const daemon = args.has('--daemon');
const statusOnly = args.has('--status');

const restartLog = {
  db: [],
  api: [],
  web: [],
};

function pruneRestarts(name) {
  const now = Date.now();
  restartLog[name] = (restartLog[name] || []).filter((t) => now - t < WINDOW_MS);
}

function canRestart(name) {
  pruneRestarts(name);
  return (restartLog[name]?.length || 0) < MAX_RESTARTS;
}

function markRestart(name) {
  pruneRestarts(name);
  restartLog[name].push(Date.now());
}

function acquireLock() {
  const existing = readLock(LOCK);
  if (existing?.pid && isPidAlive(existing.pid) && existing.pid !== process.pid) {
    return { ok: false, existing };
  }
  writeLock(LOCK, {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    root,
  });
  return { ok: true };
}

function releaseLock() {
  const existing = readLock(LOCK);
  if (existing?.pid === process.pid) {
    try {
      unlinkSync(LOCK);
    } catch {
      /* ignore */
    }
  }
}

async function ensureStack(env, { forceFreeDead = false } = {}) {
  const ports = stackPorts(env);
  const report = { db: 'ok', api: 'ok', web: 'ok', actions: [] };

  // DB
  if (!(await portOpen(ports.db))) {
    if (!canRestart('db')) {
      report.db = 'down_rate_limited';
      logLine('DB down but restart rate-limited');
    } else {
      markRestart('db');
      if (forceFreeDead) freePort(ports.db);
      logLine(`DB :${ports.db} down — starting`);
      startDb(env);
      report.actions.push('start-db');
      const ok = await waitPort(ports.db, 'PGlite', 90);
      report.db = ok ? 'restarted' : 'failed';
      if (!ok) logLine('DB failed to open after restart');
    }
  }

  // API (needs DB)
  const apiOk = await apiHealthy(ports.api);
  if (!apiOk) {
    if (!(await portOpen(ports.db))) {
      report.api = 'waiting_db';
      logLine('API unhealthy and DB down — skip API restart this tick');
    } else if (!canRestart('api')) {
      report.api = 'down_rate_limited';
      logLine('API down but restart rate-limited');
    } else {
      markRestart('api');
      // Free only API port if something is half-listening without healthy postgres
      if (await portOpen(ports.api)) freePort(ports.api);
      logLine(`API :${ports.api} unhealthy — starting`);
      startApi(env);
      report.actions.push('start-api');
      await waitPort(ports.api, 'API', 45);
      report.api = (await apiHealthy(ports.api)) ? 'restarted' : 'failed';
    }
  }

  // Web
  const webOk = await webHealthy(ports.web);
  if (!webOk) {
    if (!canRestart('web')) {
      report.web = 'down_rate_limited';
      logLine('Web down but restart rate-limited');
    } else {
      markRestart('web');
      if (await portOpen(ports.web)) freePort(ports.web);
      logLine(`Web :${ports.web} down — starting`);
      startWeb(env);
      report.actions.push('start-web');
      let ok = await waitPort(ports.web, 'Web', 40);
      if (!ok) {
        logLine('Web production start failed — trying next dev');
        freePort(ports.web);
        startWebDev(env);
        ok = await waitPort(ports.web, 'Web-dev', 90);
      }
      report.web = ok ? 'restarted' : 'failed';
    }
  }

  return report;
}

async function printStatus(env) {
  const ports = stackPorts(env);
  const lock = readLock(LOCK);
  const sup =
    lock?.pid && isPidAlive(lock.pid)
      ? `UP pid=${lock.pid} since=${lock.startedAt}`
      : 'DOWN';
  console.log('TradeOps supervisor status');
  console.log(`  supervisor  ${sup}`);
  console.log(`  DB :${ports.db}  ${(await portOpen(ports.db)) ? 'UP' : 'DOWN'}`);
  console.log(`  API :${ports.api} ${(await apiHealthy(ports.api)) ? 'UP(healthy)' : (await portOpen(ports.api)) ? 'UP(unhealthy)' : 'DOWN'}`);
  console.log(`  Web :${ports.web} ${(await portOpen(ports.web)) ? 'UP' : 'DOWN'}`);
}

function spawnDaemon() {
  if (!isWin) {
    const child = spawnSync(
      nodeBin,
      [join(root, 'scripts', 'stack-supervise.mjs'), '--foreground'],
      { detached: true, stdio: 'ignore', cwd: root, windowsHide: true },
    );
    // spawnSync with detached is wrong — use spawn
    console.error('Use: node scripts/stack-supervise.mjs  (foreground) on non-Windows');
    return;
  }
  // Detach supervisor from agent Job Object
  const script = join(root, 'scripts', 'stack-supervise.mjs').replace(/'/g, "''");
  const out = join(logDir, 'supervisor.out.log').replace(/'/g, "''");
  const err = join(logDir, 'supervisor.err.log').replace(/'/g, "''");
  const ps = [
    `$p = Start-Process -FilePath '${nodeBin.replace(/'/g, "''")}'`,
    `-ArgumentList @('${script}')`,
    `-WorkingDirectory '${root.replace(/'/g, "''")}'`,
    `-WindowStyle Hidden`,
    `-RedirectStandardOutput '${out}'`,
    `-RedirectStandardError '${err}'`,
    `-PassThru`,
    `; if ($p) { Write-Output $p.Id }`,
  ].join(' ');
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    { encoding: 'utf8', windowsHide: true, timeout: 15000 },
  );
  const pid = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop();
  if (pid && /^\d+$/.test(pid)) {
    console.log(`Supervisor detached PID=${pid}`);
    console.log(`Logs: .stack-logs/supervisor.log (+ supervisor.out/err.log)`);
  } else {
    console.error('Failed to detach supervisor', r.stderr || r.stdout || r.status);
    process.exit(1);
  }
}

async function main() {
  const env = loadDotEnv();
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined || String(process.env[k]).trim() === '') {
      process.env[k] = v;
    }
  }

  if (statusOnly) {
    await printStatus(env);
    return;
  }

  if (daemon) {
    // If already running, report and exit
    const existing = readLock(LOCK);
    if (existing?.pid && isPidAlive(existing.pid)) {
      console.log(`Supervisor already running PID=${existing.pid}`);
      await printStatus(env);
      return;
    }
    spawnDaemon();
    return;
  }

  // Foreground supervisor (also used by detached Start-Process)
  const lock = acquireLock();
  if (!lock.ok) {
    console.log(`Another supervisor holds the lock (PID=${lock.existing?.pid}). Exiting.`);
    process.exit(0);
  }

  const cleanup = () => {
    releaseLock();
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  logLine(`Supervisor started PID=${process.pid}`);
  // Initial ensure
  await ensureStack(env, { forceFreeDead: true });
  await printStatus(env);

  if (once) {
    releaseLock();
    return;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    try {
      const report = await ensureStack(env, { forceFreeDead: false });
      if (report.actions.length) {
        logLine(`tick actions=${report.actions.join(',')} db=${report.db} api=${report.api} web=${report.web}`);
      }
    } catch (e) {
      logLine(`tick error: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  releaseLock();
  process.exit(1);
});
