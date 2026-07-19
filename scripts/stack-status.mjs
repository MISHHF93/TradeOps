#!/usr/bin/env node
/**
 * Report TradeOps local stack health (DB :51214, API :4000, Web :3000) + supervisor.
 * Usage: node scripts/stack-status.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = join(root, '.stack-logs', 'supervisor.lock');

const checks = [
  { name: 'PGlite DB', port: 51214 },
  { name: 'API', port: 4000, url: 'http://127.0.0.1:4000/api/v1/health' },
  { name: 'Web', port: 3000, url: 'http://127.0.0.1:3000' },
];

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

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('TradeOps stack status');
  // Supervisor
  let sup = 'DOWN';
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (pidAlive(lock.pid)) {
        sup = `UP pid=${lock.pid} since=${lock.startedAt ?? '?'}`;
      } else {
        sup = `STALE lock pid=${lock.pid}`;
      }
    } catch {
      sup = 'LOCK unreadable';
    }
  }
  console.log(`  SUP  ${sup}`);

  for (const c of checks) {
    const open = await portOpen(c.port);
    let extra = '';
    if (open && c.url) {
      try {
        const res = await fetch(c.url, { signal: AbortSignal.timeout(4000) });
        if (c.name === 'API') {
          const j = await res.json();
          const pg = (j.dependencies || []).find((d) => d.name === 'postgres');
          extra = ` HTTP ${res.status} api=${j.status} postgres=${pg?.status ?? '?'}`;
        } else {
          extra = ` HTTP ${res.status}`;
        }
      } catch (e) {
        extra = ` (HTTP fail: ${e instanceof Error ? e.message : e})`;
      }
    }
    console.log(`  ${open ? 'UP  ' : 'DOWN'} :${c.port} ${c.name}${extra}`);
  }
  try {
    const res = await fetch('http://127.0.0.1:4000/api/v1/ai/health', {
      signal: AbortSignal.timeout(4000),
    });
    const j = await res.json();
    console.log(
      `  AI   health configured=${j.configured} errorCode=${j.errorCode} model=${j.model}`,
    );
  } catch {
    console.log('  AI   health unreachable');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
