/**
 * Scan repo for process.env / NEXT_PUBLIC_* usage. Writes docs/environment/_raw-env-scan.json
 * Never prints secret values.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['apps', 'packages', 'scripts'];
const skipRe = /node_modules|[\\/]dist[\\/]|\.next|dist-seed|\.map$/;
const keys = new Map();

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (skipRe.test(p)) continue;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(name)) continue;
    let t;
    try {
      t = readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    const rel = relative(process.cwd(), p).replace(/\\/g, '/');
    const add = (k) => {
      if (!k || k.length < 2) return;
      // OS / incomplete fragments — not TradeOps config
      if (k === 'APPDATA' || k === 'HOME' || k === 'PATH' || k === 'USERPROFILE') return;
      if (k.endsWith('_') || !/[A-Z0-9]$/.test(k)) return;
      if (!keys.has(k)) keys.set(k, { count: 0, files: new Set() });
      const e = keys.get(k);
      e.count += 1;
      if (e.files.size < 20) e.files.add(rel);
    };
    for (const m of t.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) add(m[1]);
    for (const m of t.matchAll(/process\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g)) add(m[1]);
    // Config modules pass `env` bags: env.COHERE_API_KEY
    for (const m of t.matchAll(/(?:^|[^.\w])env\.([A-Z][A-Z0-9_]*)/gm)) add(m[1]);
    for (const m of t.matchAll(/NEXT_PUBLIC_[A-Z][A-Z0-9_]+/g)) add(m[0]);
    for (const m of t.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]*)/g)) add(m[1]);
    // process.env[name] dynamic gates — capture string literals in same file
    // Status / error code strings — not env vars
    const notEnv = new Set([
      'AI_PROVIDER_FAILED',
      'AI_PROVIDER_NOT_CONFIGURED',
      'AI_RUNTIME_DISABLED',
      'AI_TENANT_REQUIRED',
      'WEB_SEARCH_NOT_CONFIGURED',
      'UNKNOWN_PROVIDER',
      'FINANCIAL_GATE_DISABLED',
    ]);
    for (const m of t.matchAll(/['"]([A-Z][A-Z0-9_]{3,})['"]\s*(?:,|\))/g)) {
      const k = m[1];
      if (notEnv.has(k)) continue;
      // Require a real env-style suffix or full known subsystem prefix (reject bare prefixes)
      if (k.endsWith('_') || !k.includes('_')) continue;
      if (
        /_(KEY|SECRET|TOKEN|URL|MODE|ENABLED|PORT|HOST|ID|MS|DOMAIN|HASH|PASSWORD|USERNAME)$/.test(k) ||
        /^(TRADEOPS|COHERE|AI|SEARCH|WEB_SEARCH|CAPITAL|STRIPE|PUBLIC|INVESTOR|PROFIT|EQUITY|POOLED|AUTOMATED|DISTRIBUTIONS|MARKETPLACE|PRIVATE|GUARANTEED)_/.test(
          k,
        )
      ) {
        add(k);
      }
    }
  }
}

for (const r of roots) walk(r);

const sorted = [...keys.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const out = {
  scannedAt: new Date().toISOString(),
  totalKeys: sorted.length,
  keys: Object.fromEntries(
    sorted.map(([k, v]) => [k, { count: v.count, files: [...v.files] }]),
  ),
};

mkdirSync('docs/environment', { recursive: true });
writeFileSync('docs/environment/_raw-env-scan.json', JSON.stringify(out, null, 2));
console.log(`TOTAL_KEYS=${sorted.length}`);
console.log(sorted.map(([k]) => k).join('\n'));
