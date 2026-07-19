#!/usr/bin/env node
/**
 * Long-lived TradeOps stack supervisor — keeps DB/API/Web up.
 *
 * Fixes for recurring ERR_CONNECTION_REFUSED:
 * - Health-check PGlite with real Prisma query (not TCP alone)
 * - Clear PGlite locks before every DB restart
 * - Exponential backoff instead of permanent rate-limit death
 * - Heartbeat file so status can detect a live supervisor
 * - Windows outer watchdog restarts supervisor if it exits
 * - Breakaway process launch (via stack-lib) survives agent Job Objects
 *
 * Usage:
 *   node scripts/stack-supervise.mjs              # foreground loop
 *   node scripts/stack-supervise.mjs --daemon     # detach + watchdog on Windows
 *   node scripts/stack-supervise.mjs --once       # one ensure pass then exit
 *   node scripts/stack-supervise.mjs --status
 *   node scripts/stack-supervise.mjs --watchdog   # outer respawn loop (internal)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  apiHealthy,
  clearStaleSupervisorLock,
  dbHealthy,
  ensureDbSchema,
  freePort,
  isPidAlive,
  isWin,
  loadDotEnv,
  logDir,
  logLine,
  nodeBin,
  portOpen,
  readLock,
  root,
  stackPorts,
  startApi,
  startDb,
  startWeb,
  startWebDev,
  waitPort,
  webHealthy,
  writeHeartbeat,
  writeLock,
} from './stack-lib.mjs';

const LOCK = join(logDir, 'supervisor.lock');
const INTERVAL_MS = 8_000;
const args = new Set(process.argv.slice(2));
const once = args.has('--once');
const daemon = args.has('--daemon');
const statusOnly = args.has('--status');
const watchdogMode = args.has('--watchdog');

/** restart timestamps per service for backoff (no hard permanent give-up) */
const restartLog = { db: [], api: [], web: [] };

function pruneRestarts(name, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  restartLog[name] = (restartLog[name] || []).filter((t) => now - t < windowMs);
}

function restartCount(name) {
  pruneRestarts(name);
  return restartLog[name]?.length || 0;
}

function markRestart(name) {
  pruneRestarts(name);
  restartLog[name].push(Date.now());
}

/** Backoff seconds before another restart attempt (caps at 60s). Never permanent. */
function backoffSec(name) {
  const n = restartCount(name);
  if (n <= 0) return 0;
  return Math.min(60, 2 ** Math.min(n, 5));
}

function lastRestartAgeSec(name) {
  pruneRestarts(name);
  const arr = restartLog[name] || [];
  if (!arr.length) return Infinity;
  return (Date.now() - arr[arr.length - 1]) / 1000;
}

function canRestartNow(name) {
  return lastRestartAgeSec(name) >= backoffSec(name);
}

function clearPgliteLocks() {
  // Hard reset DB locks/processes. Bounded timeout so supervisor never hangs forever.
  try {
    const r = spawnSync(nodeBin, [join(root, 'scripts', 'prisma-dev-db.mjs'), '--stop'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.error) logLine(`db-stop error: ${r.error.message}`);
  } catch (e) {
    logLine(`db-stop exception: ${e instanceof Error ? e.message : e}`);
  }
}

function acquireLock() {
  clearStaleSupervisorLock();
  const existing = readLock(LOCK);
  if (existing?.pid && isPidAlive(existing.pid) && existing.pid !== process.pid) {
    return { ok: false, existing };
  }
  writeLock(LOCK, {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    root,
    mode: watchdogMode ? 'watchdog-child' : 'foreground',
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

async function ensureStack(env) {
  const ports = stackPorts(env);
  const report = { db: 'ok', api: 'ok', web: 'ok', actions: [] };

  // --- DB: real queryable health ---
  let dbOk = await dbHealthy(env);
  if (!dbOk) {
    if (!canRestartNow('db')) {
      report.db = `backoff_${Math.ceil(backoffSec('db') - lastRestartAgeSec('db'))}s`;
      logLine(`DB down — backoff ${report.db}`);
    } else {
      markRestart('db');
      logLine(`DB :${ports.db} down/unqueryable — hard reset + start (attempt ${restartCount('db')})`);
      writeHeartbeat({ phase: 'db-restart', attempt: restartCount('db') });
      // Kill zombie listeners + clear locks via prisma-dev-db --stop
      freePort(ports.db);
      freePort(ports.db + 1);
      freePort(51215);
      freePort(51216);
      clearPgliteLocks();
      await new Promise((r) => setTimeout(r, 1200));
      startDb(env);
      report.actions.push('start-db');
      // Wait for queryable, not just TCP — heartbeat every few seconds so status stays live
      let ok = false;
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (i > 0 && i % 5 === 0) {
          writeHeartbeat({ phase: 'db-wait', sec: i, attempt: restartCount('db') });
          writeLock(LOCK, {
            pid: process.pid,
            startedAt: readLock(LOCK)?.startedAt || new Date().toISOString(),
            root,
            lastTick: new Date().toISOString(),
            phase: `db-wait-${i}s`,
          });
        }
        if (await dbHealthy(env)) {
          ok = true;
          break;
        }
      }
      report.db = ok ? 'restarted' : 'failed';
      if (!ok) logLine('DB failed to become queryable after restart');
      else {
        logLine('DB became queryable after restart');
        // Hard reset often wipes tables — re-apply schema before bringing API back
        try {
          if (!ensureDbSchema(env)) logLine('DB schema ensure failed after restart');
        } catch (e) {
          logLine(`DB schema ensure error: ${e instanceof Error ? e.message : e}`);
        }
      }
      dbOk = ok;
    }
  } else {
    // DB up but empty (0 tables) — apply schema without bouncing PGlite
    try {
      if (!ensureDbSchema(env)) {
        report.db = 'schema_missing';
        logLine('DB queryable but schema missing — db push failed');
      }
    } catch (e) {
      logLine(`DB schema check error: ${e instanceof Error ? e.message : e}`);
    }
  }

  // --- API ---
  const apiOk = await apiHealthy(ports.api);
  if (!apiOk) {
    if (!(await dbHealthy(env))) {
      report.api = 'waiting_db';
      logLine('API unhealthy and DB not queryable — skip API restart this tick');
    } else if (!canRestartNow('api')) {
      report.api = `backoff_${Math.ceil(backoffSec('api') - lastRestartAgeSec('api'))}s`;
      logLine(`API down — backoff ${report.api}`);
    } else {
      markRestart('api');
      if (await portOpen(ports.api)) freePort(ports.api);
      logLine(`API :${ports.api} unhealthy — starting (attempt ${restartCount('api')})`);
      startApi(env);
      report.actions.push('start-api');
      await waitPort(ports.api, 'API', 50);
      // give nest + prisma a moment
      for (let i = 0; i < 30; i++) {
        if (await apiHealthy(ports.api)) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      report.api = (await apiHealthy(ports.api)) ? 'restarted' : 'failed';
    }
  }

  // --- Web ---
  const webOk = await webHealthy(ports.web);
  if (!webOk) {
    if (!canRestartNow('web')) {
      report.web = `backoff_${Math.ceil(backoffSec('web') - lastRestartAgeSec('web'))}s`;
      logLine(`Web down — backoff ${report.web}`);
    } else {
      markRestart('web');
      if (await portOpen(ports.web)) freePort(ports.web);
      logLine(`Web :${ports.web} down — starting (attempt ${restartCount('web')})`);
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
      : lock
        ? `STALE pid=${lock.pid}`
        : 'DOWN';
  console.log('TradeOps supervisor status');
  console.log(`  supervisor  ${sup}`);
  console.log(`  DB :${ports.db}  ${(await dbHealthy(env)) ? 'UP(queryable)' : (await portOpen(ports.db)) ? 'UP(zombie)' : 'DOWN'}`);
  console.log(
    `  API :${ports.api} ${(await apiHealthy(ports.api)) ? 'UP(healthy)' : (await portOpen(ports.api)) ? 'UP(unhealthy)' : 'DOWN'}`,
  );
  console.log(`  Web :${ports.web} ${(await portOpen(ports.web)) ? 'UP' : 'DOWN'}`);
}

/**
 * Outer Windows watchdog: if the inner supervisor exits, restart it forever.
 * Launched via --daemon so the actual supervisor cannot silently disappear.
 */
function spawnWatchdogDaemon() {
  const watchdogScript = join(logDir, 'run-supervisor-watchdog.cmd');
  const out = join(logDir, 'supervisor.out.log');
  const err = join(logDir, 'supervisor.err.log');
  const supervise = join(root, 'scripts', 'stack-supervise.mjs');
  const bat = [
    '@echo off',
    'setlocal',
    `cd /d "${root}"`,
    'echo [%date% %time%] supervisor watchdog started>> "' + out + '"',
    ':loop',
    `"${nodeBin}" "${supervise}" >> "${out}" 2>> "${err}"`,
    'echo [%date% %time%] supervisor exited %ERRORLEVEL% — restarting in 3s>> "' + out + '"',
    'timeout /t 3 /nobreak >nul',
    'goto loop',
    '',
  ].join('\r\n');
  writeFileSync(watchdogScript, bat, 'utf8');

  const ps = `
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'cmd.exe'
$psi.Arguments = '/c "${watchdogScript.replace(/'/g, "''")}"'
$psi.WorkingDirectory = '${root.replace(/'/g, "''")}'
$psi.UseShellExecute = $true
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true
$p = [System.Diagnostics.Process]::Start($psi)
if ($p) {
  Set-Content -Path '${join(logDir, 'watchdog.pid').replace(/'/g, "''")}' -Value $p.Id -Encoding ascii
  Write-Output $p.Id
}
`.trim();

  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    { encoding: 'utf8', windowsHide: true, timeout: 15000 },
  );
  const pid = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop();
  if (pid && /^\d+$/.test(pid)) {
    console.log(`Supervisor watchdog detached PID=${pid}`);
    console.log('Logs: .stack-logs/supervisor.log (+ supervisor.out/err.log)');
    // write a marker lock so status knows a watchdog is intended
    writeLock(join(logDir, 'watchdog.lock'), {
      pid: Number(pid),
      startedAt: new Date().toISOString(),
    });
  } else {
    console.error('Failed to detach supervisor watchdog', r.stderr || r.stdout || r.status);
    process.exit(1);
  }
}

async function runForegroundLoop(env) {
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
  // Prevent silent death on stray rejections
  process.on('uncaughtException', (e) => {
    logLine(`uncaughtException: ${e instanceof Error ? e.stack || e.message : e}`);
  });
  process.on('unhandledRejection', (e) => {
    logLine(`unhandledRejection: ${e instanceof Error ? e.stack || e.message : e}`);
  });

  logLine(`Supervisor started PID=${process.pid}`);
  writeHeartbeat({ phase: 'start' });

  await ensureStack(env);
  await printStatus(env);
  writeHeartbeat({ phase: 'post-ensure' });

  if (once) {
    releaseLock();
    return;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    try {
      // Refresh lock mtime / pid ownership
      writeLock(LOCK, {
        pid: process.pid,
        startedAt: readLock(LOCK)?.startedAt || new Date().toISOString(),
        root,
        lastTick: new Date().toISOString(),
      });
      const report = await ensureStack(env);
      writeHeartbeat({
        phase: 'tick',
        db: report.db,
        api: report.api,
        web: report.web,
        actions: report.actions,
      });
      if (report.actions.length) {
        logLine(
          `tick actions=${report.actions.join(',')} db=${report.db} api=${report.api} web=${report.web}`,
        );
      } else {
        // Quiet heartbeat every ~minute in log so we know supervisor is alive
        const sec = new Date().getSeconds();
        if (sec < 8) {
          logLine(`tick ok db=${report.db} api=${report.api} web=${report.web}`);
        }
      }
    } catch (e) {
      logLine(`tick error: ${e instanceof Error ? e.stack || e.message : e}`);
      writeHeartbeat({ phase: 'error', error: String(e) });
    }
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
    clearStaleSupervisorLock();
    const existing = readLock(LOCK);
    if (existing?.pid && isPidAlive(existing.pid)) {
      console.log(`Supervisor already running PID=${existing.pid}`);
      await printStatus(env);
      return;
    }
    // Also check watchdog
    const wd = readLock(join(logDir, 'watchdog.lock'));
    if (wd?.pid && isPidAlive(wd.pid)) {
      console.log(`Supervisor watchdog already running PID=${wd.pid}`);
      await printStatus(env);
      return;
    }
    if (isWin) {
      spawnWatchdogDaemon();
    } else {
      console.log('Starting foreground supervisor (use a process manager on non-Windows).');
      await runForegroundLoop(env);
    }
    return;
  }

  await runForegroundLoop(env);
}

main().catch((e) => {
  console.error(e);
  releaseLock();
  process.exit(1);
});
