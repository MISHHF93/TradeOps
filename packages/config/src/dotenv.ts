/**
 * Load monorepo .env files into process.env (never overrides existing keys).
 *
 * API bootstrap path:
 *   scripts/start.mjs loadDotEnv (root .env)  →  child inherits env
 *   OR pnpm --filter api start  →  main.ts loadEnv() calls loadDotEnvFiles()
 *
 * Search order (later files do not override earlier process.env, but fill missing):
 *   1. monorepo root `.env`
 *   2. monorepo root `.env.local`
 *   3. `apps/api/.env`
 *   4. `apps/api/.env.local`
 *   5. `process.cwd()/.env` and `.env.local` if cwd is outside root
 *
 * apps/web `.env*` is intentionally NOT loaded into the API process.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Walk up from startDir looking for pnpm-workspace.yaml / package.json name tradeops */
function findMonorepoRoot(startDir: string): string {
  let dir = resolve(startDir);
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(join(dir, 'pnpm-workspace.yaml')) ||
      existsSync(join(dir, 'pnpm-workspace.yml'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(startDir);
}

/**
 * Apply file contents into `target` only for keys that are undefined or empty string.
 * Empty COHERE_API_KEY in process.env is treated as unset so a filled .env can apply.
 */
function applyEnvMap(
  map: Record<string, string>,
  target: NodeJS.ProcessEnv,
  opts?: { fillEmpty?: boolean },
): string[] {
  const applied: string[] = [];
  const fillEmpty = opts?.fillEmpty !== false;
  for (const [k, v] of Object.entries(map)) {
    const cur = target[k];
    const isUnset = cur === undefined;
    const isEmpty = fillEmpty && typeof cur === 'string' && cur.trim() === '';
    if (isUnset || isEmpty) {
      // Still set empty file values — caller may distinguish missing vs empty later
      target[k] = v;
      applied.push(k);
    }
  }
  return applied;
}

export type DotEnvLoadResult = {
  root: string;
  filesRead: string[];
  keysApplied: string[];
};

/**
 * Load dotenv files into process.env (or provided target).
 * Safe to call multiple times; idempotent for already-set non-empty keys.
 */
export function loadDotEnvFiles(
  target: NodeJS.ProcessEnv = process.env,
  startDir: string = process.cwd(),
): DotEnvLoadResult {
  const root = findMonorepoRoot(startDir);
  const candidates = [
    join(root, '.env'),
    join(root, '.env.local'),
    join(root, 'apps', 'api', '.env'),
    join(root, 'apps', 'api', '.env.local'),
  ];
  // If cwd is not under root (unusual), still allow local .env
  const cwdEnv = join(resolve(startDir), '.env');
  const cwdLocal = join(resolve(startDir), '.env.local');
  if (!candidates.includes(cwdEnv)) candidates.push(cwdEnv);
  if (!candidates.includes(cwdLocal)) candidates.push(cwdLocal);

  const filesRead: string[] = [];
  const keysApplied: string[] = [];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const map = parseEnvFile(readFileSync(file, 'utf8'));
      filesRead.push(file);
      keysApplied.push(...applyEnvMap(map, target));
    } catch {
      /* ignore unreadable file */
    }
  }

  return { root, filesRead, keysApplied: [...new Set(keysApplied)] };
}
