/**
 * Shared helpers for stack-up-win + stack-supervise (Windows-first local stack).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Start a launcher detached from agent Job Object (Windows). */
export function startDetached(name, workDir, commandLine, envMap) {
  const launcher = writeLauncher(name, workDir, commandLine, envMap);
  console.log(`→ start ${name}`);
  if (isWin) {
    const ps = [
      `$p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', '${launcher.replace(/'/g, "''")}') -WorkingDirectory '${workDir.replace(/'/g, "''")}' -WindowStyle Hidden -PassThru`,
      `if ($p) { Set-Content -Path '${join(logDir, `${name}.pid`).replace(/'/g, "''")}' -Value $p.Id -Encoding ascii; Write-Output $p.Id }`,
    ].join('; ');
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
    spawnSync('cmd.exe', ['/c', 'start', '""', '/MIN', 'cmd.exe', '/c', launcher], {
      cwd: workDir,
      windowsHide: true,
    });
    console.log(`[${name}] launched (cmd start fallback)`);
    return null;
  }
  spawnSync(nodeBin, ['-e', `require('child_process').spawn('cmd',[],{detached:true,stdio:'ignore'})`], {
    cwd: workDir,
  });
  return null;
}

export async function apiHealthy(port = 4000) {
  if (!(await portOpen(port))) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
      signal: AbortSignal.timeout(3000),
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
    // port open is enough for stay-alive; HTTP may fail mid-compile
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
    { PRISMA_DEV_DB_PORT: String(ports.db) },
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
  // Prefer production start; supervisor will fall back if needed
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

export function isPidAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
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
