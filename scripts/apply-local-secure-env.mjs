#!/usr/bin/env node
/**
 * Harden local .env for a machine that is on the internet/LAN:
 * - Bind API + Web to 127.0.0.1 only
 * - Rotate weak secrets
 * - Keep founder_direct for local no-login (safe only on loopback)
 * - Preserve existing DATABASE_URL and any already-set live API keys
 *
 * Usage: node scripts/apply-local-secure-env.mjs
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const examplePath = join(root, '.env.example');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function setLine(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (re.test(text)) return text.replace(re, line);
  return `${text.trimEnd()}\n${line}\n`;
}

if (!existsSync(envPath)) {
  if (existsSync(examplePath)) copyFileSync(examplePath, envPath);
  else writeFileSync(envPath, '', 'utf8');
}

// Backup
const backup = `${envPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
copyFileSync(envPath, backup);

let text = readFileSync(envPath, 'utf8');
const current = parseEnv(text);

const weakSecret =
  !current.APP_SECRET ||
  current.APP_SECRET.length < 32 ||
  current.APP_SECRET.includes('dev-only');
const weakKey =
  !current.CREDENTIALS_MASTER_KEY ||
  current.CREDENTIALS_MASTER_KEY.startsWith('AAAA') ||
  current.CREDENTIALS_MASTER_KEY.length < 40;

const appSecret = weakSecret
  ? randomBytes(48).toString('base64url')
  : current.APP_SECRET;
const credKey = weakKey ? randomBytes(32).toString('base64') : current.CREDENTIALS_MASTER_KEY;

const hardened = {
  NODE_ENV: current.NODE_ENV || 'development',
  LOG_LEVEL: current.LOG_LEVEL || 'info',
  API_PORT: current.API_PORT || '4000',
  API_HOST: '127.0.0.1',
  WEB_PORT: current.WEB_PORT || '3000',
  WEB_HOST: '127.0.0.1',
  WEB_ORIGIN: 'http://localhost:3000',
  API_PUBLIC_URL: 'http://127.0.0.1:4000',
  NEXT_PUBLIC_API_PUBLIC_URL: 'http://127.0.0.1:4000',
  APP_SECRET: appSecret,
  CREDENTIALS_MASTER_KEY: credKey,
  SESSION_TTL_HOURS: current.SESSION_TTL_HOURS || '168',
  // Safe on loopback only — still no multi-user SaaS
  TRADEOPS_ACCESS_MODE: current.TRADEOPS_ACCESS_MODE || 'founder_direct',
  NEXT_PUBLIC_TRADEOPS_ACCESS_MODE:
    current.NEXT_PUBLIC_TRADEOPS_ACCESS_MODE || current.TRADEOPS_ACCESS_MODE || 'founder_direct',
  AUTH_BYPASS: current.AUTH_BYPASS ?? 'true',
  // Do not allow insecure public bind by default
  TRADEOPS_ALLOW_INSECURE_BIND: '0',
  TRADEOPS_ALLOW_PUBLIC_FOUNDER: '0',
  TRADEOPS_PUBLIC_WARNING: 'false',
  API_TIMEOUT_MS: current.API_TIMEOUT_MS || '60000',
  NEXT_PUBLIC_API_TIMEOUT_MS: current.NEXT_PUBLIC_API_TIMEOUT_MS || '60000',
};

for (const [k, v] of Object.entries(hardened)) {
  text = setLine(text, k, v);
}

// Ensure optional key section markers exist once
if (!text.includes('# ——— Live API keys')) {
  text += `

# ——— Live API keys (optional — fill to enable live connectors / AI) ———
# Get keys from each provider. Never commit real values. Never use NEXT_PUBLIC_* for secrets.
# XAI_API_KEY=
# XAI_BASE_URL=https://api.x.ai/v1
# XAI_CHAT_MODEL=grok-4.5
# TRADEOPS_AI_MODE=auto
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# SHOPIFY_SHOP_DOMAIN=
# SHOPIFY_ACCESS_TOKEN=
# GOOGLE_MERCHANT_ACCESS_TOKEN=
# GOOGLE_MERCHANT_ID=
# GOOGLE_MERCHANT_DATA_SOURCE_ID=
# OPENEXCHANGERATES_APP_ID=
# SERPAPI_API_KEY=
# EASYPOST_API_KEY=
# WOOCOMMERCE_URL=
# WOOCOMMERCE_CONSUMER_KEY=
# WOOCOMMERCE_CONSUMER_SECRET=
# BIGCOMMERCE_STORE_HASH=
# BIGCOMMERCE_ACCESS_TOKEN=
# EBAY_ACCESS_TOKEN=
# PAYPAL_CLIENT_ID=
# PAYPAL_CLIENT_SECRET=
# SHIPSTATION_API_KEY=
# SHIPSTATION_API_SECRET=
# KEEPA_API_KEY=
# SQUARE_ACCESS_TOKEN=
`;
}

writeFileSync(envPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');

console.log('Local secure .env applied');
console.log(`  backup: ${backup}`);
console.log('  API_HOST=127.0.0.1  WEB_HOST=127.0.0.1  (loopback only)');
console.log(`  APP_SECRET rotated: ${weakSecret ? 'yes' : 'kept existing'}`);
console.log(`  CREDENTIALS_MASTER_KEY rotated: ${weakKey ? 'yes' : 'kept existing'}`);
console.log('  Access mode still founder_direct (safe only because bind is loopback)');
console.log('');
console.log('Restart stack:  pnpm stop ; pnpm start');
console.log('Fill live keys: edit .env (see docs/TRADEOPS_INTERNET_SECURITY.md)');
