#!/usr/bin/env node
/**
 * Bring up TradeOps local stack in the correct order (no port races).
 *
 * Order:
 *   1. PGlite (prisma-dev-db) — must stay queryable on :51214
 *   2. API  :4000  (loads root .env via @tradeops/config loadEnv)
 *   3. Web  :3000  (only if not already up)
 *
 * Usage:
 *   node scripts/stack-up.mjs
 *   node scripts/stack-up.mjs --api-only
 *   node scripts/stack-up.mjs --skip-web
 *
 * Does NOT free 51214 while API is starting. Only frees a port if that
 * specific service is being restarted and the port is held by a dead process.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const args = new Set(process.argv.slice(2));
const apiOnly = args.has('--api-only');
const skipWeb = args.has('--skip-web') || apiOnly;

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
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
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv();

const DB_PORT = Number(process.env.PRISMA_DEV_DB_PORT || 51214);
const API_PORT = Number(process.env.API_PORT || 4000);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;

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

function resolvePnpm() {
  if (!isWin) return 'pnpm';
  try {
    const lines = spawnSync('where.exe', ['pnpm'], { encoding: 'utf8' })
      .stdout.trim()
      .split(/\r?\n/)
      .filter(Boolean);
    const cmd = lines.find((l) => l.toLowerCase().endsWith('.cmd'));
    if (cmd && existsSync(cmd)) return cmd;
  } catch {
    /* fall through */
  }
  const fallback = join(process.env.APPDATA || '', 'npm', 'pnpm.cmd');
  return existsSync(fallback) ? fallback : 'pnpm.cmd';
}

function freePort(port) {
  spawnSync(process.execPath, [join(root, 'scripts', 'free-ports.mjs'), String(port)], {
    cwd: root,
    stdio: 'inherit',
  });
}

function quoteWinArg(arg) {
  const s = String(arg);
  if (s.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Start a long-lived service that survives parent exit (critical on Windows Job Objects).
 * Writes a .cmd launcher and uses `cmd start` so the process is not killed with the agent shell.
 * @param {{ cwd?: string }} [opts]
 */
function spawnLong(name, command, cmdArgs, env = {}, opts = {}) {
  console.log(`→ start ${name}`);
  const workDir = opts.cwd || root;
  const cleanEnv = { ...env };
  delete cleanEnv.cwd;
  const mergedEnv = { ...process.env, ...cleanEnv };

  if (isWin) {
    const logDir = join(root, '.stack-logs');
    mkdirSync(logDir, { recursive: true });
    const outLog = join(logDir, `${name}.out.log`);
    const errLog = join(logDir, `${name}.err.log`);
    const launcher = join(logDir, `run-${name}.cmd`);
    const envLines = Object.entries(cleanEnv)
      .filter(([k]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k))
      .map(([k, v]) => `set "${k}=${String(v).replace(/%/g, '%%').replace(/"/g, '')}"`)
      .join('\r\n');
    const quotedArgs = cmdArgs.map((a) => quoteWinArg(a)).join(' ');
    const bat = [
      '@echo off',
      `cd /d "${workDir}"`,
      envLines,
      `"${command}" ${quotedArgs} > "${outLog}" 2> "${errLog}"`,
      '',
    ].join('\r\n');
    writeFileSync(launcher, bat, 'utf8');
    const r = spawnSync(
      'cmd.exe',
      ['/c', 'start', 'TradeOps-' + name, '/MIN', 'cmd.exe', '/c', launcher],
      { cwd: root, env: mergedEnv, encoding: 'utf8', windowsHide: true },
    );
    if (r.status !== 0) {
      console.error(`[${name}] start failed: ${r.stderr || r.stdout || r.status}`);
    } else {
      console.log(`[${name}] launched (detached cmd start) logs=.stack-logs/${name}.*.log`);
    }
    return null;
  }

  const child = spawn(command, cmdArgs, {
    cwd: workDir,
    env: mergedEnv,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  return child;
}

async function waitPort(port, label, maxSec = 90) {
  for (let i = 0; i < maxSec; i++) {
    if (await portOpen(port)) {
      console.log(`✓ ${label} :${port} open`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`✗ ${label} :${port} not open after ${maxSec}s`);
  return false;
}

async function waitApiHealthy(maxSec = 60) {
  for (let i = 0; i < maxSec; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4000/api/v1/health', {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      const j = await res.json();
      const pg = (j.dependencies || []).find((d) => d.name === 'postgres');
      if (pg?.status === 'up') {
        console.log(`✓ API healthy postgres=up status=${j.status}`);
        return true;
      }
      console.log(`… API up but postgres=${pg?.status ?? '?'} (wait)`);
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error('✗ API never reported postgres=up');
  return false;
}

async function main() {
  console.log('TradeOps stack-up (ordered, no free-ports race on DB while API runs)');
  const pnpm = resolvePnpm();
  const children = [];

  // 1) DB — run node script directly (not pnpm) so the process stays alive
  if (!(await portOpen(DB_PORT))) {
    freePort(DB_PORT);
    children.push(
      spawnLong('db', process.execPath, [join(root, 'scripts', 'prisma-dev-db.mjs')]),
    );
    if (!(await waitPort(DB_PORT, 'PGlite', 120))) process.exit(1);
  } else {
    console.log(`✓ PGlite already :${DB_PORT}`);
  }

  // 2) API — node dist/main.js with env (avoids pnpm wrapper exiting)
  if (await portOpen(API_PORT)) {
    console.log(`… freeing API :${API_PORT}`);
    freePort(API_PORT);
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!(await portOpen(DB_PORT))) {
    console.error('✗ DB died after free API — abort');
    process.exit(1);
  }
  const apiMain = join(root, 'apps', 'api', 'dist', 'main.js');
  if (!existsSync(apiMain)) {
    console.error('✗ API not built. Run: pnpm --filter @tradeops/api build');
    process.exit(1);
  }
  children.push(
    spawnLong('api', process.execPath, [apiMain], {
      DATABASE_URL,
      AI_PROVIDER: process.env.AI_PROVIDER || 'cohere',
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      COHERE_CHAT_MODEL: process.env.COHERE_CHAT_MODEL || 'command-a-plus-05-2026',
      COHERE_EMBED_MODEL: process.env.COHERE_EMBED_MODEL || 'embed-v4.0',
      COHERE_RERANK_MODEL: process.env.COHERE_RERANK_MODEL || 'rerank-v3.5',
      TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
      NODE_ENV: process.env.NODE_ENV || 'development',
      API_PORT: String(API_PORT),
      API_HOST: process.env.API_HOST || '127.0.0.1',
      WEB_ORIGIN: process.env.WEB_ORIGIN || 'http://localhost:3000',
      TRADEOPS_ACCESS_MODE: process.env.TRADEOPS_ACCESS_MODE || 'founder_direct',
      AUTH_BYPASS: process.env.AUTH_BYPASS || 'true',
      APP_SECRET: process.env.APP_SECRET || '',
      CREDENTIALS_MASTER_KEY: process.env.CREDENTIALS_MASTER_KEY || '',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  );
  if (!(await waitPort(API_PORT, 'API', 40))) process.exit(1);
  await waitApiHealthy(60);

  // 3) Web — next binary via node for longevity
  if (!skipWeb) {
    if (!(await portOpen(WEB_PORT))) {
      const nextCli = join(
        root,
        'node_modules',
        '.pnpm',
        // resolve next from apps/web
      );
      // Prefer pnpm exec next start in apps/web via node of next/dist/bin/next
      const webNext = join(root, 'apps', 'web', 'node_modules', 'next', 'dist', 'bin', 'next');
      const webNextRoot = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
      const nextBin = existsSync(webNext) ? webNext : webNextRoot;
      if (existsSync(nextBin)) {
        children.push(
          spawnLong(
            'web',
            process.execPath,
            [nextBin, 'start', '-p', String(WEB_PORT)],
            {
              API_PUBLIC_URL: process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000',
              NEXT_PUBLIC_API_PUBLIC_URL:
                process.env.NEXT_PUBLIC_API_PUBLIC_URL || 'http://127.0.0.1:4000',
            },
            { cwd: join(root, 'apps', 'web') },
          ),
        );
      } else {
        children.push(
          spawnLong('web', pnpm, ['--filter', '@tradeops/web', 'start'], {
            API_PUBLIC_URL: process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000',
            NEXT_PUBLIC_API_PUBLIC_URL:
              process.env.NEXT_PUBLIC_API_PUBLIC_URL || 'http://127.0.0.1:4000',
          }),
        );
      }
      await waitPort(WEB_PORT, 'Web', 60);
    } else {
      console.log(`✓ Web already :${WEB_PORT}`);
    }
  }

  console.log('');
  console.log('Stack running (Windows: Start-Process detached — survives this script exit).');
  console.log('  node scripts/stack-status.mjs');
  console.log('  http://localhost:3000');
  console.log('  http://127.0.0.1:4000/api/v1/health');
  console.log('  http://127.0.0.1:4000/api/v1/ai/health');
  void children;
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
