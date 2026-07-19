/**
 * Shared helpers for stack-up-win + stack-supervise (Windows-first local stack).
 *
 * Process launch uses PowerShell Start-Process with UseShellExecute so children
 * break away from the parent Job Object (agents/CI) and survive tool timeouts.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const logDir = join(root, '.stack-logs');
export const nodeBin = process.execPath;
export const isWin = process.platform === 'win32';

mkdirSync(logDir, { recursive: true });

export function loadDotEnv() {
  const map = {};
  const p = join(root, '.env');
  if (!existsSync(p)) return map;
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) map[k] = v;
  }
  return map;
}

export function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
    s.setTimeout(600, () => {
      s.destroy();
      resolve(false);
    });
  });
}

export async function waitPort(port, label, maxSec = 90) {
  for (let i = 0; i < maxSec; i++) {
    if (await portOpen(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`FAIL ${label} :${port} not open after ${maxSec}s`);
  return false;
}

export function freePort(port) {
  const r = spawnSync(nodeBin, [join(root, 'scripts', 'free-ports.mjs'), String(port)], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
}

/**
 * True when PGlite accepts TCP AND Prisma can SELECT 1.
 * Port-only checks hide zombie servers that cause API "Server has closed the connection".
 */
export function dbQueryable(env = {}) {
  const ports = stackPorts(env);
  const url =
    env.DATABASE_URL ||
    `postgresql://postgres:postgres@127.0.0.1:${ports.db}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;
  const script = `
    const net = require('net');
    const { PrismaClient } = require('@prisma/client');
    const port = ${ports.db};
    const url = process.env.DATABASE_URL;
    function tcp() {
      return new Promise((resolve) => {
        const s = net.connect({ port, host: '127.0.0.1' }, () => { s.end(); resolve(true); });
        s.on('error', () => resolve(false));
        s.setTimeout(800, () => { s.destroy(); resolve(false); });
      });
    }
    (async () => {
      if (!(await tcp())) process.exit(2);
      const p = new PrismaClient({ datasources: { db: { url } } });
      try {
        await p.$queryRawUnsafe('SELECT 1 AS x');
        await p.$disconnect();
        process.exit(0);
      } catch (e) {
        try { await p.$disconnect(); } catch {}
        process.exit(1);
      }
    })();
  `;
  const r = spawnSync(nodeBin, ['-e', script], {
    cwd: join(root, 'packages', 'database'),
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: url },
    timeout: 15_000,
    windowsHide: true,
  });
  return r.status === 0;
}

export async function dbHealthy(env = {}) {
  const ports = stackPorts(env);
  if (!(await portOpen(ports.db))) return false;
  return dbQueryable(env);
}

export function writeLauncher(name, workDir, commandLine, envMap) {
  const out = join(logDir, `${name}.out.log`);
  const err = join(logDir, `${name}.err.log`);
  const launcher = join(logDir, `run-${name}.cmd`);
  const envLines = Object.entries(envMap || {})
    .filter(([k]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k))
    .map(([k, v]) => {
      const safe = String(v ?? '')
        .replace(/%/g, '%%')
        .replace(/"/g, '');
      return `set "${k}=${safe}"`;
    });
  const bat = [
    '@echo off',
    'setlocal',
    `cd /d "${workDir}"`,
    ...envLines,
    `echo [%date% %time%] starting ${name}>> "${out}"`,
    `${commandLine} >> "${out}" 2>> "${err}"`,
    `echo [%date% %time%] exited %ERRORLEVEL%>> "${out}"`,
    '',
  ].join('\r\n');
  writeFileSync(launcher, bat, 'utf8');
  return launcher;
}

/**
 * Start a long-lived process detached from agent Job Objects.
 * Uses PowerShell ProcessStartInfo.UseShellExecute = $true so the child is not
 * killed when the launching tool/job ends.
 */
export function startDetached(name, workDir, commandLine, envMap) {
  const launcher = writeLauncher(name, workDir, commandLine, envMap);
  const pidFile = join(logDir, `${name}.pid`);
  console.log(`→ start ${name}`);
  if (isWin) {
    const launcherEsc = launcher.replace(/'/g, "''");
    const workEsc = workDir.replace(/'/g, "''");
    const pidEsc = pidFile.replace(/'/g, "''");
    // UseShellExecute=true breaks away from Job Object (critical for agent shells)
    const ps = `
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'cmd.exe'
$psi.Arguments = '/c "${launcherEsc}"'
$psi.WorkingDirectory = '${workEsc}'
$psi.UseShellExecute = $true
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true
try {
  $p = [System.Diagnostics.Process]::Start($psi)
  if ($p) {
    Set-Content -Path '${pidEsc}' -Value $p.Id -Encoding ascii
    Write-Output $p.Id
  }
} catch {
  Write-Error $_
  exit 1
}
`.trim();
    const r = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 },
    );
    const pid = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop();
    if (pid && /^\d+$/.test(pid)) {
      console.log(`[${name}] launched PID=${pid}`);
      return pid;
    }
    // Fallback: classic Start-Process
    const ps2 = [
      `$p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', '${launcherEsc}') -WorkingDirectory '${workEsc}' -WindowStyle Hidden -PassThru`,
      `if ($p) { Set-Content -Path '${pidEsc}' -Value $p.Id -Encoding ascii; Write-Output $p.Id }`,
    ].join('; ');
    const r2 = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps2],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 },
    );
    const pid2 = (r2.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop();
    if (pid2 && /^\d+$/.test(pid2)) {
      console.log(`[${name}] launched PID=${pid2} (fallback)`);
      return pid2;
    }
    console.error(`[${name}] launch failed`, r.stderr || r2.stderr || r.status);
    return null;
  }
  // non-Windows: simple detached spawn via shell
  spawnSync('bash', ['-c', `nohup ${commandLine} >> "${join(logDir, `${name}.out.log`)}" 2>> "${join(logDir, `${name}.err.log`)}" & echo $!`], {
    cwd: workDir,
    encoding: 'utf8',
  });
  return null;
}

export async function apiHealthy(port = 4000) {
  if (!(await portOpen(port))) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const j = await res.json();
    const pg = (j.dependencies || []).find((d) => d.name === 'postgres');
    return pg?.status === 'up';
  } catch {
    return false;
  }
}

export async function webHealthy(port = 3000) {
  if (!(await portOpen(port))) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.status > 0 && res.status < 500;
  } catch {
    // port open is enough mid-compile
    return true;
  }
}

export function stackPorts(env = {}) {
  return {
    db: Number(env.PRISMA_DEV_DB_PORT || 51214),
    api: Number(env.API_PORT || 4000),
    web: Number(env.WEB_PORT || 3000),
  };
}

export function buildApiEnv(env) {
  const ports = stackPorts(env);
  const databaseUrl =
    env.DATABASE_URL ||
    `postgresql://postgres:postgres@127.0.0.1:${ports.db}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;
  return {
    DATABASE_URL: databaseUrl,
    AI_PROVIDER: env.AI_PROVIDER || 'cohere',
    COHERE_API_KEY: env.COHERE_API_KEY || '',
    COHERE_CHAT_MODEL: env.COHERE_CHAT_MODEL || 'command-a-plus-05-2026',
    COHERE_EMBED_MODEL: env.COHERE_EMBED_MODEL || 'embed-v4.0',
    COHERE_RERANK_MODEL: env.COHERE_RERANK_MODEL || 'rerank-v3.5',
    TAVILY_API_KEY: env.TAVILY_API_KEY || '',
    NODE_ENV: env.NODE_ENV || 'development',
    API_PORT: String(ports.api),
    API_HOST: env.API_HOST || '127.0.0.1',
    WEB_ORIGIN: env.WEB_ORIGIN || 'http://localhost:3000',
    TRADEOPS_ACCESS_MODE: env.TRADEOPS_ACCESS_MODE || 'founder_direct',
    AUTH_BYPASS: env.AUTH_BYPASS || 'true',
    APP_SECRET: env.APP_SECRET || '',
    CREDENTIALS_MASTER_KEY: env.CREDENTIALS_MASTER_KEY || '',
    REDIS_URL: env.REDIS_URL || 'redis://localhost:6379',
  };
}

export function buildWebEnv(env) {
  return {
    // next start requires NODE_ENV=production; leave unset so next sets it
    API_PUBLIC_URL: env.API_PUBLIC_URL || 'http://127.0.0.1:4000',
    NEXT_PUBLIC_API_PUBLIC_URL: env.NEXT_PUBLIC_API_PUBLIC_URL || 'http://127.0.0.1:4000',
    PORT: String(env.WEB_PORT || 3000),
    HOSTNAME: '127.0.0.1',
  };
}

export function startDb(env) {
  const ports = stackPorts(env);
  return startDetached(
    'db',
    root,
    `"${nodeBin}" "${join(root, 'scripts', 'prisma-dev-db.mjs')}"`,
    { PRISMA_DEV_DB_PORT: String(ports.db), PRISMA_DEV_NAME: env.PRISMA_DEV_NAME || 'tradeops' },
  );
}

export function startApi(env) {
  const apiMain = join(root, 'apps', 'api', 'dist', 'main.js');
  if (!existsSync(apiMain)) {
    console.error('API not built:', apiMain);
    return null;
  }
  return startDetached('api', root, `"${nodeBin}" "${apiMain}"`, buildApiEnv(env));
}

export function startWeb(env) {
  const nextBin = join(root, 'apps', 'web', 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!existsSync(nextBin)) {
    console.error('next binary missing:', nextBin);
    return null;
  }
  const webDir = join(root, 'apps', 'web');
  const ports = stackPorts(env);
  return startDetached(
    'web',
    webDir,
    `"${nodeBin}" "${nextBin}" start -p ${ports.web} -H 127.0.0.1`,
    buildWebEnv(env),
  );
}

export function startWebDev(env) {
  const nextBin = join(root, 'apps', 'web', 'node_modules', 'next', 'dist', 'bin', 'next');
  const webDir = join(root, 'apps', 'web');
  const ports = stackPorts(env);
  return startDetached(
    'web',
    webDir,
    `"${nodeBin}" "${nextBin}" dev -p ${ports.web} -H 127.0.0.1`,
    buildWebEnv(env),
  );
}

export function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    writeFileSync(join(logDir, 'supervisor.log'), `${line}\n`, { flag: 'a' });
  } catch {
    /* ignore */
  }
}

export function writeHeartbeat(extra = {}) {
  try {
    writeFileSync(
      join(logDir, 'supervisor.heartbeat'),
      JSON.stringify({ at: new Date().toISOString(), pid: process.pid, ...extra }, null, 2),
      'utf8',
    );
  } catch {
    /* ignore */
  }
}

export function isPidAlive(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

export function readLock(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeLock(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

export function clearStaleSupervisorLock() {
  const lock = join(logDir, 'supervisor.lock');
  const existing = readLock(lock);
  if (!existing) return;
  if (!existing.pid || !isPidAlive(existing.pid)) {
    try {
      unlinkSync(lock);
      console.log('Cleared stale supervisor.lock');
    } catch {
      /* ignore */
    }
  }
}
