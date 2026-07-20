#!/usr/bin/env node
/**
 * Report TradeOps local stack health (DB :51214, API :4000, Web :3000) + supervisor.
 * Usage:
 *   node scripts/stack-status.mjs
 *   node scripts/stack-status.mjs --json   # machine-readable (Cycle 12)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  apiHealthy,
  dbHealthy,
  isPidAlive,
  loadDotEnv,
  portOpen,
  readLock,
  stackPorts,
} from './stack-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logDir = join(root, '.stack-logs');
const lockPath = join(logDir, 'supervisor.lock');
const watchdogPath = join(logDir, 'watchdog.lock');
const heartbeatPath = join(logDir, 'supervisor.heartbeat');
const asJson = process.argv.includes('--json');

async function collectStatus() {
  const env = loadDotEnv();
  const ports = stackPorts(env);

  const wd = readLock(watchdogPath);
  let watchdog = 'down';
  if (wd?.pid && isPidAlive(wd.pid)) watchdog = 'up';
  else if (wd?.pid) watchdog = 'stale';

  let supervisor = 'down';
  let supervisorPid = null;
  let supervisorSince = null;
  let supervisorTick = null;
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (isPidAlive(lock.pid)) {
        supervisor = 'up';
        supervisorPid = lock.pid;
        supervisorSince = lock.startedAt ?? null;
        supervisorTick = lock.lastTick ?? null;
      } else {
        supervisor = 'stale';
        supervisorPid = lock.pid;
      }
    } catch {
      supervisor = 'lock_unreadable';
    }
  }

  let heartbeat = null;
  if (existsSync(heartbeatPath)) {
    try {
      heartbeat = JSON.parse(readFileSync(heartbeatPath, 'utf8'));
    } catch {
      /* ignore */
    }
  }

  const dbOk = await dbHealthy(env);
  const dbOpen = await portOpen(ports.db);
  const apiOk = await apiHealthy(ports.api);
  const apiOpen = await portOpen(ports.api);
  let apiHttp = null;
  let apiStatus = null;
  let postgresStatus = null;
  if (apiOpen) {
    try {
      const res = await fetch(`http://127.0.0.1:${ports.api}/api/v1/health`, {
        signal: AbortSignal.timeout(4000),
      });
      const j = await res.json();
      apiHttp = res.status;
      apiStatus = j.status ?? null;
      const pg = (j.dependencies || []).find((d) => d.name === 'postgres');
      postgresStatus = pg?.status ?? null;
    } catch {
      apiHttp = null;
    }
  }

  const webOpen = await portOpen(ports.web);
  let webHttp = null;
  if (webOpen) {
    try {
      const res = await fetch(`http://127.0.0.1:${ports.web}/`, {
        signal: AbortSignal.timeout(4000),
      });
      webHttp = res.status;
    } catch {
      webHttp = null;
    }
  }

  let ai = null;
  try {
    const res = await fetch(`http://127.0.0.1:${ports.api}/api/v1/ai/health`, {
      signal: AbortSignal.timeout(4000),
    });
    const j = await res.json();
    ai = {
      configured: Boolean(j.configured),
      errorCode: j.errorCode ?? null,
      model: j.model ?? null,
    };
  } catch {
    ai = { configured: false, errorCode: 'unreachable', model: null };
  }

  const healthy = Boolean(dbOk && apiOk && webOpen);
  return {
    ok: healthy,
    cycle: 12,
    ports,
    watchdog,
    supervisor,
    supervisorPid,
    supervisorSince,
    supervisorTick,
    heartbeat,
    db: {
      ok: dbOk,
      open: dbOpen,
      status: dbOk ? 'queryable' : dbOpen ? 'zombie_tcp' : 'down',
    },
    api: {
      ok: apiOk,
      open: apiOpen,
      http: apiHttp,
      status: apiStatus,
      postgres: postgresStatus,
    },
    web: {
      ok: webOpen,
      open: webOpen,
      http: webHttp,
    },
    ai,
    hint: healthy
      ? null
      : 'node scripts/stack-keep.mjs  (or pnpm stack:up --force if stuck)',
  };
}

async function main() {
  const status = await collectStatus();

  if (asJson) {
    console.log(JSON.stringify(status));
    process.exit(status.ok ? 0 : 1);
  }

  console.log('TradeOps stack status');
  console.log(
    `  WDG  ${status.watchdog === 'up' ? `UP pid=${readLock(watchdogPath)?.pid}` : status.watchdog.toUpperCase()}`,
  );
  if (status.supervisor === 'up') {
    console.log(
      `  SUP  UP pid=${status.supervisorPid} since=${status.supervisorSince ?? '?'}${
        status.supervisorTick ? ` tick=${status.supervisorTick}` : ''
      }`,
    );
  } else {
    console.log(`  SUP  ${status.supervisor.toUpperCase()}`);
  }
  if (status.heartbeat) {
    console.log(
      `  HB   ${status.heartbeat.at} phase=${status.heartbeat.phase} pid=${status.heartbeat.pid}`,
    );
  }
  console.log(
    `  ${status.db.ok ? 'UP  ' : 'DOWN'} :${status.ports.db} PGlite DB ${
      status.db.ok ? '(queryable)' : status.db.open ? '(zombie TCP only)' : ''
    }`,
  );
  console.log(
    `  ${status.api.ok ? 'UP  ' : 'DOWN'} :${status.ports.api} API${
      status.api.ok ? ' healthy' : status.api.open ? ' unhealthy' : ''
    }${
      status.api.http
        ? ` HTTP ${status.api.http} api=${status.api.status} postgres=${status.api.postgres ?? '?'}`
        : ''
    }`,
  );
  console.log(
    `  ${status.web.ok ? 'UP  ' : 'DOWN'} :${status.ports.web} Web${
      status.web.http ? ` HTTP ${status.web.http}` : ''
    }`,
  );
  if (status.ai) {
    console.log(
      `  AI   health configured=${status.ai.configured} errorCode=${status.ai.errorCode ?? 'none'} model=${status.ai.model ?? '?'}`,
    );
  }
  if (!status.ok) {
    console.log(`\nHint: ${status.hint}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
