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

/**
 * Load monorepo root `.env` into process.env.
 * Matches packages/config loadDotEnvFiles policy:
 * - never override non-empty existing process.env values
 * - treat empty/whitespace process.env values as unset so file values can apply
 *   (critical for COHERE_API_KEY when a shell exported an empty placeholder)
 */
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
    const cur = process.env[key];
    const unset = cur === undefined;
    const empty = typeof cur === 'string' && cur.trim() === '';
    if (unset || empty) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const API_PORT = Number(process.env.API_PORT || 4000);
const WEB_PORT = Number(process.env.WEB_PORT || 3000);

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

function run(command, args, name, env = {}) {
  // Windows: paths like C:\Program Files\nodejs\node.exe must be quoted for cmd.exe /c.
  // cmd /S /C strips the outermost quotes, so wrap the full cmdline in an extra pair.
  // Without that, `"C:\Program Files\..."` becomes `C:\Program` and spawn fails.
  const child = isWin
    ? spawn(
        process.env.ComSpec || 'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          `"${[quoteWinArg(command), ...args.map(quoteWinArg)].join(' ')}"`,
        ],
        {
          cwd: root,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          env: { ...process.env, ...env },
          windowsHide: true,
          windowsVerbatimArguments: true,
        },
      )
    : spawn(command, args, {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env, ...env },
      });

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
 * TCP listen is not enough — zombie PGlite can hold the port without accepting Prisma.
 */
function prismaCanQuery(url) {
  try {
    const script = `
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
      p.$queryRawUnsafe('SELECT 1 AS x')
        .then(() => p.$disconnect().then(() => process.exit(0)))
        .catch(() => p.$disconnect().finally(() => process.exit(1)));
    `;
    execSync(`node -e ${JSON.stringify(script)}`, {
      cwd: join(root, 'packages', 'database'),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'ignore',
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  }
}

function ensureSchema(url) {
  try {
    console.log('Ensuring Prisma migrations are applied…');
    execSync('pnpm --filter @tradeops/database migrate:deploy', {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
      timeout: 120_000,
    });
  } catch (e) {
    console.warn('migrate:deploy warning:', e instanceof Error ? e.message : e);
  }
  // Seed founder + fixture products if org table empty / missing seed data
  try {
    const check = `
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
      p.organization.count()
        .then((n) => p.$disconnect().then(() => process.exit(n > 0 ? 0 : 2)))
        .catch(() => p.$disconnect().finally(() => process.exit(2)));
    `;
    try {
      execSync(`node -e ${JSON.stringify(check)}`, {
        cwd: join(root, 'packages', 'database'),
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'ignore',
        timeout: 15_000,
      });
      console.log('Seed data present (organizations found).');
    } catch {
      console.log('No orgs found — running seed…');
      execSync('pnpm --filter @tradeops/database seed', {
        cwd: root,
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'inherit',
        timeout: 120_000,
      });
    }
  } catch (e) {
    console.warn('seed check warning:', e instanceof Error ? e.message : e);
  }
}

/**
 * Ensure a reachable Postgres for the vertical slice.
 * Prefers existing DATABASE_URL; if that port is down or zombie, starts Prisma Dev (PGlite).
 */
async function ensureDatabase() {
  const currentUrl =
    process.env.DATABASE_URL ||
    'postgresql://tradeops:tradeops@127.0.0.1:5432/tradeops?schema=public';
  const port = parseDatabasePort(currentUrl);
  if ((await portOpen(port)) && prismaCanQuery(currentUrl)) {
    console.log(`Database healthy at port ${port}`);
    ensureSchema(currentUrl);
    return currentUrl;
  }

  if (await portOpen(port)) {
    console.warn(
      `Port ${port} is open but Prisma cannot query — starting/repairing Prisma Dev (PGlite)…`,
    );
  } else {
    console.log(`Database not reachable on port ${port} — starting Prisma Dev (PGlite)…`);
  }

  const dbPort = Number(process.env.PRISMA_DEV_DB_PORT || 51214);
  const pgliteUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5`;

  // Fire-and-forget long-lived PGlite process (script kills zombies itself).
  run(process.execPath, [join(root, 'scripts', 'prisma-dev-db.mjs')], 'db');
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if ((await portOpen(dbPort)) && prismaCanQuery(pgliteUrl)) break;
  }

  if (!(await portOpen(dbPort)) || !prismaCanQuery(pgliteUrl)) {
    console.error(
      'Could not start a healthy local database. Options:\n' +
        '  • pnpm run db:pglite   (Prisma PGlite — works under App Control)\n' +
        '  • then: pnpm --filter @tradeops/database migrate:deploy && pnpm db:seed\n' +
        '  • docker compose up -d\n' +
        '  • Set DATABASE_URL to a hosted Postgres (Neon/Supabase)',
    );
    process.exit(1);
  }

  process.env.DATABASE_URL = pgliteUrl;
  console.log(`Using Prisma Dev DATABASE_URL on port ${dbPort}`);
  ensureSchema(pgliteUrl);
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
const sharedEnv = {
  API_PORT: String(API_PORT),
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

const children = [
  run(pnpm, ['--filter', '@tradeops/api', 'start'], 'api', {
    ...sharedEnv,
    NODE_ENV: 'development',
  }),
  run(
    pnpm,
    ['--filter', '@tradeops/web', 'exec', 'next', 'start', '-p', String(WEB_PORT)],
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
