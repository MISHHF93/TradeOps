#!/usr/bin/env node
/**
 * Start TradeOps API + Web for local use.
 * Usage: npm start   or   pnpm start
 *
 * - Frees ports 3000/4000 if stuck from a previous run
 * - Starts API then Web
 * - Reads WEB_PORT / API_PORT from environment or .env
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const require = createRequire(import.meta.url);

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const API_PORT = Number(process.env.API_PORT || 4000);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);
const API_HOST = process.env.API_HOST || '127.0.0.1';
const WEB_HOST = process.env.WEB_HOST || '127.0.0.1';

function freePorts(ports) {
  try {
    execSync(`node "${join(root, 'scripts', 'free-ports.mjs')}" ${ports.join(' ')}`, {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    console.warn('Warning: could not free ports automatically');
  }
}

function resolvePnpm() {
  // Prefer pnpm.cmd on Windows so spawn() works without shell:true
  if (isWin) {
    try {
      const lines = execSync('where.exe pnpm', { encoding: 'utf8' })
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      const cmd = lines.find((l) => l.toLowerCase().endsWith('.cmd'));
      if (cmd && existsSync(cmd)) return cmd;
      for (const line of lines) {
        const candidate = line.toLowerCase().endsWith('.cmd') ? line : `${line}.cmd`;
        if (existsSync(candidate)) return candidate;
      }
    } catch {
      /* fall through */
    }
    const fallback = join(process.env.APPDATA || '', 'npm', 'pnpm.cmd');
    if (existsSync(fallback)) return fallback;
    return 'pnpm.cmd';
  }
  try {
    return execSync('which pnpm', { encoding: 'utf8' }).trim();
  } catch {
    return 'pnpm';
  }
}

/** Quote a single Windows cmdline argument when it contains spaces or shell metacharacters. */
function quoteWinArg(arg) {
  const s = String(arg);
  if (s.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function isNodeExecutable(command) {
  const s = String(command).toLowerCase().replace(/\//g, '\\');
  return (
    s === process.execPath.toLowerCase() ||
    s.endsWith('\\node.exe') ||
    s.endsWith('\\node') ||
    s === 'node' ||
    s === 'node.exe'
  );
}

function run(command, args, name, env = {}) {
  // Prefer direct spawn for node.exe — avoids cmd.exe splitting "C:\Program Files\nodejs\node.exe".
  // For pnpm.cmd and other shells, use cmd /c with quoted args on Windows.
  const child =
    !isWin || isNodeExecutable(command)
      ? spawn(command, args, {
          cwd: root,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          env: { ...process.env, ...env },
          windowsHide: true,
        })
      : spawn(
          process.env.ComSpec || 'cmd.exe',
          ['/d', '/s', '/c', [quoteWinArg(command), ...args.map(quoteWinArg)].join(' ')],
          {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            env: { ...process.env, ...env },
            windowsHide: true,
            windowsVerbatimArguments: true,
          },
        );

  const prefix = (line) => `[${name}] ${line}`;
  const pipe = (stream) => {
    stream.on('data', (buf) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        if (line.length) console.log(prefix(line));
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('error', (err) => {
    console.error(`[${name}] failed to spawn:`, err.message);
  });

  child.on('exit', (code, signal) => {
    console.log(`[${name}] exited code=${code} signal=${signal ?? ''}`);
  });

  return child;
}

function ensureBuilt() {
  const apiMain = join(root, 'apps', 'api', 'dist', 'main.js');
  if (!existsSync(apiMain)) {
    console.error('API is not built yet. Run:\n  pnpm setup\n  (or: pnpm build)');
    process.exit(1);
  }
  const webNext = join(root, 'apps', 'web', '.next');
  if (!existsSync(webNext)) {
    console.error('Web is not built yet. Run:\n  pnpm setup\n  (or: pnpm --filter @tradeops/web build)');
    process.exit(1);
  }
}

function parseDatabasePort(url) {
  try {
    const u = new URL(url.replace(/^postgresql:/, 'http:').replace(/^postgres:/, 'http:'));
    return Number(u.port || 5432);
  } catch {
    return 5432;
  }
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    import('node:net').then(({ default: net }) => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.setTimeout(800, () => {
        socket.destroy();
        resolve(false);
      });
    });
  });
}

/**
 * Ensure a reachable Postgres for the vertical slice.
 * Prefers existing DATABASE_URL; if that port is down, starts Prisma Dev (PGlite).
 */
async function ensureDatabase() {
  const currentUrl =
    process.env.DATABASE_URL ||
    'postgresql://tradeops:tradeops@127.0.0.1:5432/tradeops?schema=public';
  const port = parseDatabasePort(currentUrl);
  if (await portOpen(port)) {
    console.log(`Database reachable at port ${port}`);
    return currentUrl;
  }

  console.log(`Database not reachable on port ${port} — starting Prisma Dev (PGlite)…`);
  const dbPort = Number(process.env.PRISMA_DEV_DB_PORT || 51214);
  const pgliteUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;

  if (!(await portOpen(dbPort))) {
    // Fire-and-forget long-lived PGlite process.
    run(process.execPath, [join(root, 'scripts', 'prisma-dev-db.mjs')], 'db');
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await portOpen(dbPort)) break;
    }
  }

  if (!(await portOpen(dbPort))) {
    console.error(
      'Could not start local database. Options:\n' +
        '  • pnpm run db:pglite   (Prisma PGlite — works under App Control)\n' +
        '  • docker compose up -d\n' +
        '  • Set DATABASE_URL to a hosted Postgres (Neon/Supabase)',
    );
    process.exit(1);
  }

  process.env.DATABASE_URL = pgliteUrl;
  console.log(`Using Prisma Dev DATABASE_URL on port ${dbPort}`);
  return pgliteUrl;
}

const accessMode = (process.env.TRADEOPS_ACCESS_MODE || 'founder_direct').toLowerCase();
console.log(`TradeOps — starting stack (TRADEOPS_ACCESS_MODE=${accessMode})`);
if (accessMode === 'founder_direct' || accessMode === 'founder' || !process.env.TRADEOPS_ACCESS_MODE) {
  console.log('  Direct Founder Access — open root → terminal (no login)');
  console.log(`  Workspace: http://localhost:${WEB_PORT}/terminal/cockpit`);
} else {
  console.log(`  Web:      http://localhost:${WEB_PORT}`);
  console.log(`  Login:    http://localhost:${WEB_PORT}/login`);
}
console.log(`  Terminal: http://localhost:${WEB_PORT}/terminal`);
console.log(`  API:      http://localhost:${API_PORT}/api/v1/health/live`);
console.log(`  Mode API: http://localhost:${API_PORT}/api/v1/public/access-mode`);
console.log(`  Demo:     pnpm run demo:loop`);
console.log('');

ensureBuilt();
console.log('Clearing stuck ports if needed…');
freePorts([WEB_PORT, API_PORT]);
console.log('');

const pnpm = resolvePnpm();
if (!existsSync(pnpm) && isWin) {
  console.error(`pnpm not found at ${pnpm}. Install: npm install -g pnpm@9.15.0`);
  process.exit(1);
}

const databaseUrl = await ensureDatabase();

// Shared env for local stack. Next.js `next start` requires NODE_ENV=production;
// API stays on development so AUTH_BYPASS (local no-login) remains active.
// Bind loopback by default so founder_direct is not reachable from LAN/WAN.
const sharedEnv = {
  API_PORT: String(API_PORT),
  API_HOST,
  WEB_HOST,
  HOSTNAME: WEB_HOST,
  PORT: String(WEB_PORT),
  WEB_PORT: String(WEB_PORT),
  API_PUBLIC_URL: process.env.API_PUBLIC_URL || `http://127.0.0.1:${API_PORT}`,
  NEXT_PUBLIC_API_PUBLIC_URL:
    process.env.NEXT_PUBLIC_API_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    `http://127.0.0.1:${API_PORT}`,
  AUTH_BYPASS: process.env.AUTH_BYPASS ?? 'true',
  DATABASE_URL: databaseUrl,
};

console.log(`  Bind:     API ${API_HOST}:${API_PORT} · Web ${WEB_HOST}:${WEB_PORT}`);
if (API_HOST === '0.0.0.0' || API_HOST === '::') {
  console.warn(
    '  ⚠ API_HOST is public-facing. Prefer 127.0.0.1 unless behind a reverse proxy. See docs/TRADEOPS_INTERNET_SECURITY.md',
  );
}

const children = [
  run(pnpm, ['--filter', '@tradeops/api', 'start'], 'api', {
    ...sharedEnv,
    NODE_ENV: 'development',
  }),
  run(
    pnpm,
    [
      '--filter',
      '@tradeops/web',
      'exec',
      'next',
      'start',
      '-H',
      WEB_HOST,
      '-p',
      String(WEB_PORT),
    ],
    'web',
    {
      ...sharedEnv,
      NODE_ENV: 'production',
    },
  ),
];

const shutdown = () => {
  for (const c of children) {
    try {
      if (isWin && c.pid) {
        try {
          execSync(`taskkill /PID ${c.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          c.kill();
        }
      } else {
        c.kill('SIGTERM');
      }
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
