#!/usr/bin/env node
/**
 * Report TradeOps local stack health (DB :51214, API :4000, Web :3000) + supervisor.
 * Usage: node scripts/stack-status.mjs
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

async function main() {
  const env = loadDotEnv();
  const ports = stackPorts(env);
  console.log('TradeOps stack status');

  // Watchdog
  const wd = readLock(watchdogPath);
  if (wd?.pid && isPidAlive(wd.pid)) {
    console.log(`  WDG  UP pid=${wd.pid}`);
  } else if (wd?.pid) {
    console.log(`  WDG  STALE pid=${wd.pid}`);
  } else {
    console.log('  WDG  DOWN');
  }

  // Supervisor
  let sup = 'DOWN';
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (isPidAlive(lock.pid)) {
        sup = `UP pid=${lock.pid} since=${lock.startedAt ?? '?'}`;
        if (lock.lastTick) sup += ` tick=${lock.lastTick}`;
      } else {
        sup = `STALE lock pid=${lock.pid}`;
      }
    } catch {
      sup = 'LOCK unreadable';
    }
  }
  console.log(`  SUP  ${sup}`);

  if (existsSync(heartbeatPath)) {
    try {
      const hb = JSON.parse(readFileSync(heartbeatPath, 'utf8'));
      console.log(`  HB   ${hb.at} phase=${hb.phase} pid=${hb.pid}`);
    } catch {
      /* ignore */
    }
  }

  const dbOk = await dbHealthy(env);
  const dbOpen = await portOpen(ports.db);
  console.log(
    `  ${dbOk ? 'UP  ' : 'DOWN'} :${ports.db} PGlite DB ${dbOk ? '(queryable)' : dbOpen ? '(zombie TCP only)' : ''}`,
  );

  const apiOk = await apiHealthy(ports.api);
  const apiOpen = await portOpen(ports.api);
  let apiExtra = '';
  if (apiOpen) {
    try {
      const res = await fetch(`http://127.0.0.1:${ports.api}/api/v1/health`, {
        signal: AbortSignal.timeout(4000),
      });
      const j = await res.json();
      const pg = (j.dependencies || []).find((d) => d.name === 'postgres');
      apiExtra = ` HTTP ${res.status} api=${j.status} postgres=${pg?.status ?? '?'}`;
    } catch (e) {
      apiExtra = ` (HTTP fail: ${e instanceof Error ? e.message : e})`;
    }
  }
  console.log(
    `  ${apiOk ? 'UP  ' : 'DOWN'} :${ports.api} API${apiOk ? ' healthy' : apiOpen ? ' unhealthy' : ''}${apiExtra}`,
  );

  const webOpen = await portOpen(ports.web);
  let webExtra = '';
  if (webOpen) {
    try {
      const res = await fetch(`http://127.0.0.1:${ports.web}/`, {
        signal: AbortSignal.timeout(4000),
      });
      webExtra = ` HTTP ${res.status}`;
    } catch (e) {
      webExtra = ` (HTTP fail: ${e instanceof Error ? e.message : e})`;
    }
  }
  console.log(`  ${webOpen ? 'UP  ' : 'DOWN'} :${ports.web} Web${webExtra}`);

  try {
    const res = await fetch('http://127.0.0.1:4000/api/v1/ai/health', {
      signal: AbortSignal.timeout(4000),
    });
    const j = await res.json();
    console.log(
      `  AI   health configured=${j.configured} errorCode=${j.errorCode ?? 'none'} model=${j.model ?? '?'}`,
    );
  } catch {
    console.log('  AI   health unreachable');
  }

  if (!dbOk || !apiOk || !webOpen) {
    console.log('\nHint: pnpm stack:up   (or pnpm stack:up --force if stuck)');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
