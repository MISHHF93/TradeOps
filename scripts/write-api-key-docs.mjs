#!/usr/bin/env node
/**
 * Write paste-ready vendor API key templates + catalog doc.
 * Usage: pnpm run env:write-key-docs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { PRODUCTION_CONNECTORS } = require(
  join(root, 'packages/connector-core/dist/production-connectors.js'),
);

const hints = {
  XAI_BASE_URL: 'https://api.x.ai/v1',
  XAI_CHAT_MODEL: 'grok-4.5',
  TRADEOPS_AI_MODE: 'auto',
  TRADEOPS_AI_DEFAULT_GENERATE: '1',
  TRADEOPS_AI_TIMEOUT_MS: '60000',
  PAYPAL_API_BASE: 'https://api-m.sandbox.paypal.com',
  SQUARE_API_BASE: 'https://connect.squareupsandbox.com',
  POSTHOG_HOST: 'https://app.posthog.com',
};

function buildPasteEnv() {
  const lines = [];
  lines.push('# =============================================================================');
  lines.push('# TradeOps — VENDOR API KEYS (paste-ready)');
  lines.push('# Paste your secret RIGHT AFTER the = sign. Leave blank if unused.');
  lines.push('# Example:  XAI_API_KEY=xai-abc123');
  lines.push('# Then copy lines into root .env  (or merge this whole file).');
  lines.push('# Restart: pnpm stop && pnpm start');
  lines.push('# Never commit real secrets. Regenerate: pnpm run env:write-key-docs');
  lines.push('# =============================================================================');
  lines.push('');

  const byProvider = new Map();
  for (const c of PRODUCTION_CONNECTORS) {
    if (!byProvider.has(c.provider)) byProvider.set(c.provider, []);
    byProvider.get(c.provider).push(c);
  }

  for (const [provider, items] of [...byProvider.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push('# ---------------------------------------------------------------------------');
    lines.push('# ' + provider.toUpperCase());
    lines.push('# ---------------------------------------------------------------------------');
    for (const c of items) {
      lines.push('# ' + c.displayName + '  [' + c.id + ']');
      lines.push('# Get keys: ' + c.docsUrl);
      for (const key of c.credentialEnvKeys) {
        lines.push(key + '=' + (hints[key] || ''));
      }
      lines.push('');
    }
  }

  const extras = [
    [
      '# xAI model / mode settings',
      [
        ['XAI_BASE_URL', 'https://api.x.ai/v1'],
        ['XAI_CHAT_MODEL', 'grok-4.5'],
        ['XAI_EMBED_MODEL', ''],
        ['GROK_API_KEY', ''],
        ['TRADEOPS_AI_MODE', 'auto'],
        ['TRADEOPS_AI_DEFAULT_GENERATE', '1'],
        ['TRADEOPS_AI_TIMEOUT_MS', '60000'],
        ['TRADEOPS_STORAGE_DIR', ''],
      ],
    ],
    [
      '# Stripe SaaS prices / webhook',
      [
        ['STRIPE_WEBHOOK_SECRET', ''],
        ['STRIPE_PRICE_FOUNDER_MONTHLY', ''],
        ['STRIPE_PRICE_FOUNDER_ANNUAL', ''],
        ['STRIPE_PRICE_PROFESSIONAL_MONTHLY', ''],
        ['STRIPE_PRICE_PROFESSIONAL_ANNUAL', ''],
        ['STRIPE_PRICE_AGENCY_MONTHLY', ''],
        ['STRIPE_PRICE_AGENCY_ANNUAL', ''],
        ['STRIPE_PRICE_ENTERPRISE_MONTHLY', ''],
        ['STRIPE_PRICE_ENTERPRISE_ANNUAL', ''],
      ],
    ],
    [
      '# Optional bases / public IDs',
      [
        ['PAYPAL_API_BASE', 'https://api-m.sandbox.paypal.com'],
        ['SQUARE_API_BASE', 'https://connect.squareupsandbox.com'],
        ['GOOGLE_MERCHANT_DATA_SOURCE_ID', ''],
        ['NEXT_PUBLIC_GA4_MEASUREMENT_ID', ''],
        ['OTEL_EXPORTER_OTLP_ENDPOINT', ''],
      ],
    ],
  ];

  for (const [header, pairs] of extras) {
    lines.push('# ---------------------------------------------------------------------------');
    lines.push(header);
    lines.push('# ---------------------------------------------------------------------------');
    for (const [k, v] of pairs) lines.push(k + '=' + v);
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

function buildMarkdown() {
  const lines = [];
  lines.push('# API keys — paste placeholders');
  lines.push('');
  lines.push('Use these files to paste secrets after you register with each vendor.');
  lines.push('');
  lines.push('| File | Purpose |');
  lines.push('|------|---------|');
  lines.push('| [env-api-keys.paste.env](./env-api-keys.paste.env) | **Paste-ready** `KEY=` lines (all vendors) |');
  lines.push('| [../env.vendors.template](../env.vendors.template) | Same content at repo root |');
  lines.push('| [../.env](../.env) | Live local config (gitignored) — merge keys here |');
  lines.push('');
  lines.push('## How to paste');
  lines.push('');
  lines.push('1. Open `docs/env-api-keys.paste.env` (or `env.vendors.template`).');
  lines.push('2. After you get a key from the vendor dashboard, put it **after** `=`:');
  lines.push('');
  lines.push('```env');
  lines.push('XAI_API_KEY=xai-your-real-key-here');
  lines.push('STRIPE_SECRET_KEY=sk_test_your_real_key');
  lines.push('SHOPIFY_ACCESS_TOKEN=shpat_your_real_token');
  lines.push('SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com');
  lines.push('```');
  lines.push('');
  lines.push('3. Copy those lines into root `.env` (replace the empty `KEY=` lines).');
  lines.push('4. Save and restart:');
  lines.push('');
  lines.push('```powershell');
  lines.push('pnpm stop');
  lines.push('pnpm start');
  lines.push('```');
  lines.push('');
  lines.push('Leave unused vendors blank — TradeOps stays fixture/shadow for those.');
  lines.push('');
  lines.push('Regenerate templates: `pnpm run env:write-key-docs`');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Priority block (start here)');
  lines.push('');
  lines.push('```env');
  lines.push('# AI — https://console.x.ai');
  lines.push('XAI_API_KEY=');
  lines.push('');
  lines.push('# Shopify — https://shopify.dev/docs/api/admin-graphql');
  lines.push('SHOPIFY_SHOP_DOMAIN=');
  lines.push('SHOPIFY_ACCESS_TOKEN=');
  lines.push('');
  lines.push('# Stripe — https://dashboard.stripe.com/apikeys');
  lines.push('STRIPE_SECRET_KEY=');
  lines.push('STRIPE_WEBHOOK_SECRET=');
  lines.push('');
  lines.push('# Intelligence');
  lines.push('SERPAPI_API_KEY=');
  lines.push('KEEPA_API_KEY=');
  lines.push('GOOGLE_MERCHANT_ACCESS_TOKEN=');
  lines.push('GOOGLE_MERCHANT_ID=');
  lines.push('OPENEXCHANGERATES_APP_ID=');
  lines.push('');
  lines.push('# Shipping');
  lines.push('EASYPOST_API_KEY=');
  lines.push('SHIPSTATION_API_KEY=');
  lines.push('SHIPSTATION_API_SECRET=');
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Full variable list');
  lines.push('');
  lines.push('| Vendor | Variable name | Get key |');
  lines.push('|--------|---------------|---------|');
  for (const c of PRODUCTION_CONNECTORS) {
    for (const key of c.credentialEnvKeys) {
      lines.push('| ' + c.provider + ' | `' + key + '` | ' + c.docsUrl + ' |');
    }
  }
  lines.push('');
  lines.push('## Security');
  lines.push('');
  lines.push('- Keep `API_HOST=127.0.0.1` while using founder_direct (see [TRADEOPS_INTERNET_SECURITY.md](./TRADEOPS_INTERNET_SECURITY.md)).');
  lines.push('- Never put private keys in `NEXT_PUBLIC_*` variables.');
  lines.push('- Do not commit a filled `.env`.');
  lines.push('');
  return lines.join('\n') + '\n';
}

const paste = buildPasteEnv();
writeFileSync(join(root, 'docs', 'env-api-keys.paste.env'), paste);
writeFileSync(join(root, 'env.vendors.template'), paste);
writeFileSync(join(root, 'docs', 'TRADEOPS_API_KEYS_CATALOG.md'), buildMarkdown());

const keyCount = (paste.match(/^[A-Z][A-Z0-9_]+=/gm) || []).length;
console.log('Wrote paste-ready templates:');
console.log('  docs/env-api-keys.paste.env');
console.log('  env.vendors.template');
console.log('  docs/TRADEOPS_API_KEYS_CATALOG.md');
console.log('  key slots:', keyCount);
