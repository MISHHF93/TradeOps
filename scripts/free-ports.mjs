#!/usr/bin/env node
/**
 * Free TradeOps ports (default 3000, 4000) on Windows/macOS/Linux.
 * Usage: node scripts/free-ports.mjs [port ...]
 */
import { execSync } from 'node:child_process';

const ports = process.argv.slice(2).map(Number).filter(Boolean);
const targets = ports.length ? ports : [3000, 4000];
const isWin = process.platform === 'win32';

function pidsOnPort(port) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (pid > 0) pids.add(pid);
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN || true`, {
      encoding: 'utf8',
      shell: '/bin/bash',
    });
    return out
      .split(/\s+/)
      .map(Number)
      .filter((n) => n > 0);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (isWin) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    console.log(`  killed PID ${pid}`);
  } catch (e) {
    console.log(`  could not kill PID ${pid}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log('Freeing ports:', targets.join(', '));
for (const port of targets) {
  const pids = pidsOnPort(port);
  if (pids.length === 0) {
    console.log(`  :${port} free`);
    continue;
  }
  console.log(`  :${port} held by ${pids.join(', ')}`);
  for (const pid of pids) killPid(pid);
}
console.log('Done.');
