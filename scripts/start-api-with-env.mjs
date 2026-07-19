#!/usr/bin/env node
/**
 * Start API with keys loaded from gitignored .env (never prints secret values).
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const envPath = resolve(root, '.env');
const env = {
  ...process.env,
  API_HOST: '127.0.0.1',
  TRADEOPS_SECURITY_BOOT: process.env.TRADEOPS_SECURITY_BOOT || 'warn',
  AI_PROVIDER: 'cohere',
  AI_RUNTIME_ENABLED: 'true',
  ENABLE_SIMULATION_MODE: 'false',
  AI_RESPONSE_CACHE_ENABLED: 'false',
};

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
}

env.API_HOST = '127.0.0.1';
env.AI_PROVIDER = env.AI_PROVIDER || 'cohere';

const keyLen = (env.COHERE_API_KEY || '').trim().length;
console.log(`[start-api] COHERE_API_KEY configured=${keyLen > 0} length=${keyLen}`);
console.log(`[start-api] AI_PROVIDER=${env.AI_PROVIDER}`);

const child = spawn('pnpm', ['--filter', '@tradeops/api', 'start'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
