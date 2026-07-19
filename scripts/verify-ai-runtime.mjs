#!/usr/bin/env node
/**
 * Deployment / local verification for the real AI path.
 * Never prints secret values. Exit 1 on hard failures.
 *
 * Usage:
 *   node scripts/verify-ai-runtime.mjs
 *   API_PUBLIC_URL=http://127.0.0.1:4000 node scripts/verify-ai-runtime.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const base = (process.env.API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'http://127.0.0.1:4000').replace(
  /\/$/,
  '',
);

function loadDotEnvKeyPresence() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) {
    return { hasEnvFile: false, cohereSet: false, provider: null, sim: null, cache: null };
  }
  const text = readFileSync(envPath, 'utf8');
  const get = (name) => {
    const m = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  return {
    hasEnvFile: true,
    cohereSet: get('COHERE_API_KEY').length > 0,
    provider: get('AI_PROVIDER') || 'cohere',
    sim: get('ENABLE_SIMULATION_MODE') || get('TRADEOPS_SIMULATION_MODE') || 'false',
    cache: get('AI_RESPONSE_CACHE_ENABLED') || 'false',
    runtime: get('AI_RUNTIME_ENABLED') || 'true',
  };
}

async function main() {
  const local = loadDotEnvKeyPresence();
  console.log('=== TradeOps AI runtime verification ===');
  console.log(`API base: ${base}`);
  console.log(
    `Local .env: file=${local.hasEnvFile} COHERE_API_KEY_set=${local.cohereSet} AI_PROVIDER=${local.provider} SIM=${local.sim} CACHE=${local.cache} RUNTIME=${local.runtime}`,
  );
  if (local.cohereSet === false) {
    console.log(
      'NOTE: COHERE_API_KEY is empty in .env — expect status=blocked on chat until you set a rotated key (never print it).',
    );
  }

  // 1) Generic health (postgres/redis)
  let infraOk = false;
  try {
    const h = await fetch(`${base}/api/v1/health`, { signal: AbortSignal.timeout(8000) });
    const j = await h.json().catch(() => ({}));
    console.log(`GET /api/v1/health → HTTP ${h.status} status=${j.status ?? '?'}`);
    infraOk = h.ok;
  } catch (e) {
    console.error(`GET /api/v1/health FAILED: ${e instanceof Error ? e.message : e}`);
  }

  // 2) AI health (may require auth — report honestly)
  try {
    const h = await fetch(`${base}/api/v1/ai/health`, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });
    const text = await h.text();
    let j = {};
    try {
      j = text ? JSON.parse(text) : {};
    } catch {
      j = { raw: text.slice(0, 200) };
    }
    if (h.status === 401 || h.status === 403) {
      console.log(
        `GET /api/v1/ai/health → HTTP ${h.status} (auth required — open /terminal/ai/runtime-lab while logged in)`,
      );
    } else {
      console.log(
        `GET /api/v1/ai/health → HTTP ${h.status} status=${j.status ?? '?'} provider=${j.runtime?.provider ?? '?'} configured=${j.runtime?.configured ?? '?'} probe=${j.runtime?.providerProbe ?? '?'}`,
      );
      if (j.runtime?.error) console.log(`  probe_error=${String(j.runtime.error).slice(0, 120)}`);
    }
  } catch (e) {
    console.error(`GET /api/v1/ai/health FAILED: ${e instanceof Error ? e.message : e}`);
  }

  // 3) Public catalog (no secrets)
  try {
    const h = await fetch(`${base}/api/v1/ai/gateway`, { signal: AbortSignal.timeout(8000) });
    console.log(`GET /api/v1/ai/gateway → HTTP ${h.status}`);
  } catch (e) {
    console.error(`GET /api/v1/ai/gateway FAILED: ${e instanceof Error ? e.message : e}`);
  }

  console.log('=== Checks complete ===');
  console.log('UI lab: /terminal/ai/runtime-lab');
  console.log('Canonical chat: POST /api/v1/ai/chat');
  if (!infraOk) {
    console.error('API not reachable — start with: pnpm start');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
