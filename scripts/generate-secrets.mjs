#!/usr/bin/env node
/**
 * Generate strong APP_SECRET + CREDENTIALS_MASTER_KEY for .env
 * Usage: node scripts/generate-secrets.mjs
 *        node scripts/generate-secrets.mjs --write   # merge into .env
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

const appSecret = randomBytes(48).toString('base64url');
const credentialsKey = randomBytes(32).toString('base64');

console.log('# Paste into .env (or re-run with --write)');
console.log(`APP_SECRET=${appSecret}`);
console.log(`CREDENTIALS_MASTER_KEY=${credentialsKey}`);

if (write) {
  const envPath = join(root, '.env');
  let text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const setKey = (src, key, val) => {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(src)) return src.replace(re, `${key}=${val}`);
    return `${src.trimEnd()}\n${key}=${val}\n`;
  };
  text = setKey(text, 'APP_SECRET', appSecret);
  text = setKey(text, 'CREDENTIALS_MASTER_KEY', credentialsKey);
  writeFileSync(envPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  console.log(`\nUpdated ${envPath}`);
}
