#!/usr/bin/env node
/**
 * Merge the full vendor API-key catalog into .env (and refresh .env.example keys section).
 * - Never overwrites a key that already has a non-empty value
 * - Adds empty placeholders for every production connector credential
 * - Safe to re-run
 *
 * Usage: node scripts/sync-env-api-keys.mjs
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** @type {{ PRODUCTION_CONNECTORS: Array<{ id: string; provider: string; displayName: string; docsUrl: string; credentialEnvKeys: string[] }> }} */
let connectors;
try {
  connectors = require(join(root, 'packages/connector-core/dist/production-connectors.js'));
} catch {
  // Source fallback if dist not built
  console.warn('connector-core dist not found — using static catalog fallback');
  connectors = { PRODUCTION_CONNECTORS: [] };
}

const EXTRA_KEYS = [
  // Platform AI — Cohere is primary (code-first runtime). Never put secrets in NEXT_PUBLIC_*.
  {
    keys: [
      'AI_PROVIDER',
      'AI_RUNTIME_ENABLED',
      'COHERE_API_KEY',
      'COHERE_BASE_URL',
      'COHERE_CHAT_MODEL',
      'COHERE_EMBED_MODEL',
      'COHERE_RERANK_MODEL',
      'COHERE_TIMEOUT_MS',
      'COHERE_RETRIEVAL_ENABLED',
      'WEB_SEARCH_ENABLED',
      'TAVILY_API_KEY',
    ],
    note: 'Primary AI runtime (Cohere) + optional web search',
  },
  // Optional alternate AI adapters (not primary)
  {
    keys: ['XAI_API_KEY', 'XAI_BASE_URL', 'XAI_MODEL', 'XAI_EMBED_MODEL', 'GROK_API_KEY'],
    note: 'xAI / Grok (optional adapter only)',
  },
  {
    keys: ['TRADEOPS_AI_MODE', 'TRADEOPS_AI_DEFAULT_GENERATE', 'TRADEOPS_AI_TIMEOUT_MS'],
    note: 'Legacy AI mode flags (deprecated — prefer AI_PROVIDER + COHERE_*)',
  },
  { keys: ['TRADEOPS_STORAGE_DIR'], note: 'Local artifact storage' },
  // Stripe SaaS extras
  {
    keys: [
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_FOUNDER_MONTHLY',
      'STRIPE_PRICE_FOUNDER_ANNUAL',
      'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
      'STRIPE_PRICE_PROFESSIONAL_ANNUAL',
      'STRIPE_PRICE_AGENCY_MONTHLY',
      'STRIPE_PRICE_AGENCY_ANNUAL',
      'STRIPE_PRICE_ENTERPRISE_MONTHLY',
      'STRIPE_PRICE_ENTERPRISE_ANNUAL',
    ],
    note: 'Stripe SaaS billing extras',
  },
  // Optional bases
  { keys: ['PAYPAL_API_BASE'], note: 'PayPal sandbox vs live base URL' },
  { keys: ['SQUARE_API_BASE'], note: 'Square sandbox vs production base' },
  { keys: ['GOOGLE_MERCHANT_DATA_SOURCE_ID'], note: 'Google Merchant data source' },
  { keys: ['NEXT_PUBLIC_GA4_MEASUREMENT_ID'], note: 'Browser GA4 (public id only — not a secret)' },
  { keys: ['OTEL_EXPORTER_OTLP_ENDPOINT'], note: 'OpenTelemetry OTLP endpoint' },
];

const DEFAULT_HINTS = {
  AI_PROVIDER: 'cohere',
  AI_RUNTIME_ENABLED: 'true',
  COHERE_BASE_URL: 'https://api.cohere.com',
  COHERE_CHAT_MODEL: 'command-a-03-2025',
  COHERE_EMBED_MODEL: 'embed-v4.0',
  COHERE_RERANK_MODEL: 'rerank-v3.5',
  COHERE_TIMEOUT_MS: '60000',
  COHERE_RETRIEVAL_ENABLED: 'true',
  WEB_SEARCH_ENABLED: 'false',
  XAI_BASE_URL: 'https://api.x.ai/v1',
  XAI_MODEL: 'grok-4.5',
  // Legacy aliases kept empty/non-primary
  TRADEOPS_AI_MODE: 'auto',
  TRADEOPS_AI_DEFAULT_GENERATE: '1',
  TRADEOPS_AI_TIMEOUT_MS: '60000',
  PAYPAL_API_BASE: 'https://api-m.sandbox.paypal.com',
  SQUARE_API_BASE: 'https://connect.squareupsandbox.com',
  POSTHOG_HOST: 'https://app.posthog.com',
  SHOPIFY_SHOP_DOMAIN: 'your-store.myshopify.com',
  WOOCOMMERCE_URL: 'https://shop.example.com',
  SAP_BASE_URL: 'https://your-sap.example.com',
  AKENEO_BASE_URL: 'https://your-akeneo.example.com',
  WINDCHILL_BASE_URL: 'https://your-windchill.example.com',
};

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

function buildCatalogSection() {
  const lines = [];
  lines.push('');
  lines.push('# =============================================================================');
  lines.push('# VENDOR API KEYS CATALOG (auto-synced from production connector registry)');
  lines.push('# Fill values after =  |  Leave empty to stay in fixture/shadow mode');
  lines.push('# Never commit real secrets  |  Never use NEXT_PUBLIC_* for private keys');
  lines.push('# Docs: docs/TRADEOPS_API_KEYS_CATALOG.md  |  Re-run: pnpm run env:sync-keys');
  lines.push('# =============================================================================');
  lines.push('');

  const list = connectors.PRODUCTION_CONNECTORS || [];
  const byProvider = new Map();
  for (const c of list) {
    const p = c.provider || c.id;
    if (!byProvider.has(p)) byProvider.set(p, []);
    byProvider.get(p).push(c);
  }

  for (const [provider, items] of [...byProvider.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(`# --- ${provider} ---`);
    for (const c of items) {
      lines.push(`# ${c.displayName} (${c.id})`);
      lines.push(`# Docs: ${c.docsUrl}`);
      for (const key of c.credentialEnvKeys || []) {
        const hint = DEFAULT_HINTS[key];
        lines.push(hint ? `${key}=${hint}` : `${key}=`);
      }
      lines.push('');
    }
  }

  lines.push('# --- Additional platform / AI / billing extras ---');
  for (const block of EXTRA_KEYS) {
    lines.push(`# ${block.note}`);
    for (const key of block.keys) {
      // Skip keys already emitted from connector list
      const alreadyInConnectors = list.some((c) => (c.credentialEnvKeys || []).includes(key));
      if (
        alreadyInConnectors &&
        !['XAI_BASE_URL', 'XAI_MODEL', 'XAI_EMBED_MODEL', 'COHERE_BASE_URL', 'COHERE_CHAT_MODEL'].includes(
          key,
        )
      ) {
        continue;
      }
      const hint = DEFAULT_HINTS[key];
      lines.push(hint ? `${key}=${hint}` : `${key}=`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function mergeKeysIntoEnv(existingText, catalogText) {
  const existing = parseEnv(existingText);
  // Remove previous auto catalog if present
  const marker = '# VENDOR API KEYS CATALOG';
  let base = existingText;
  const idx = base.indexOf(marker);
  if (idx >= 0) {
    // strip from previous section header start
    const start = base.lastIndexOf('# ===', idx);
    base = base.slice(0, start >= 0 ? start : idx).trimEnd() + '\n';
  }

  const catalogLines = catalogText.split(/\r?\n/);
  const out = [base.trimEnd(), ''];
  for (const line of catalogLines) {
    if (!line || line.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      out.push(line);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const catalogVal = line.slice(eq + 1);
    const cur = existing[key];
    // Keep user value if set and not a mere placeholder hint for domain-like fields when they filled real secret
    if (cur !== undefined && cur !== '') {
      // If user already has a value, keep it
      out.push(`${key}=${cur}`);
    } else {
      // Empty or missing → use catalog line (may include URL hints for non-secret fields)
      out.push(catalogVal === '' ? `${key}=` : `${key}=${catalogVal}`);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function main() {
  const catalog = buildCatalogSection();
  const envPath = join(root, '.env');
  const examplePath = join(root, '.env.example');

  if (!existsSync(envPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
  }
  if (!existsSync(envPath)) {
    writeFileSync(envPath, '# TradeOps env\n', 'utf8');
  }

  const backup = `${envPath}.bak-keys-${Date.now()}`;
  copyFileSync(envPath, backup);

  const merged = mergeKeysIntoEnv(readFileSync(envPath, 'utf8'), catalog);
  writeFileSync(envPath, merged, 'utf8');

  // Also append catalog to .env.example (replace old vendor sections lightly)
  if (existsSync(examplePath)) {
    let ex = readFileSync(examplePath, 'utf8');
    const marker = '# VENDOR API KEYS CATALOG';
    const idx = ex.indexOf(marker);
    if (idx >= 0) {
      const start = ex.lastIndexOf('# ===', idx);
      ex = ex.slice(0, start >= 0 ? start : idx).trimEnd() + '\n';
    }
    // Strip old partial "Live production connectors" block if present without catalog marker
    const old = ex.indexOf('# ——— Live production connectors');
    if (old >= 0 && !ex.includes(marker)) {
      ex = ex.slice(0, old).trimEnd() + '\n';
    }
    writeFileSync(examplePath, mergeKeysIntoEnv(ex, catalog), 'utf8');
  }

  const keyCount = (catalog.match(/^[A-Z][A-Z0-9_]+=/gm) || []).length;
  console.log(`Synced ${keyCount} API key slots into .env`);
  console.log(`  backup: ${backup}`);
  console.log(`  connectors: ${(connectors.PRODUCTION_CONNECTORS || []).length}`);
  console.log('  Fill values, then: pnpm stop && pnpm start');
  console.log('  Catalog doc: docs/TRADEOPS_API_KEYS_CATALOG.md');
}

main();
