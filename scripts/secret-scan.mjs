#!/usr/bin/env node
/**
 * Lightweight secret scan for TradeOps source (not .env).
 * Exit 1 if high-confidence secrets appear in tracked-like paths.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'coverage',
  '.turbo',
]);

const PATTERNS = [
  { name: 'openai_sk', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'xai_key', re: /\bxai-[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'aws_key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private_key', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'bearer_long', re: /\bBearer\s+[A-Za-z0-9\-._~+/]{40,}=*/i },
  // Known chat-compromised Cohere key prefix (rotate; must not reappear in source)
  { name: 'compromised_cohere_prefix', re: /P2zi4O2NIEmz/ },
];

const ALLOW_FILES = [
  /\.env\.example$/,
  /docs\/ai\/CONFIGURATION\.md$/,
  /secret-scan\.mjs$/,
  /redaction\.ts$/,
  /redaction\.js$/,
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx|js|mjs|md|json|yml|yaml)$/i.test(name)) files.push(p);
  }
  return files;
}

const files = walk(root);
const hits = [];

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  if (rel === '.env' || rel.endsWith('/.env') || rel.includes('.env.local')) continue;
  if (ALLOW_FILES.some((re) => re.test(rel))) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) {
      hits.push({ file: rel, pattern: name });
    }
  }
}

if (hits.length) {
  console.error('Secret scan FAILED:');
  for (const h of hits) console.error(`  ${h.pattern} in ${h.file}`);
  process.exit(1);
}

console.log(`Secret scan OK (${files.length} files scanned, 0 hits)`);
