#!/usr/bin/env node
/**
 * Cycle 5 exit criteria:
 * - stack healthy
 * - auto-save path works (research-to-cases)
 * - home has autosave affordance / demo path
 * - connectors has Shopify first-path copy
 * - stack-keep --status does not crash
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';
const WEB = process.env.WEB_PUBLIC_URL || 'http://127.0.0.1:3000';

async function get(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, text, body };
}

function fail(m) {
  console.error(`FAIL: ${m}`);
  process.exitCode = 1;
}
function pass(m) {
  console.log(`OK: ${m}`);
}

async function main() {
  console.log(`Cycle 5 smoke · API=${API} WEB=${WEB}`);

  const st = spawnSync(
    process.execPath,
    [join(root, 'scripts', 'stack-keep.mjs'), '--status'],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  if (st.error) fail(`stack-keep --status error ${st.error.message}`);
  else pass('stack-keep --status runs');

  const health = await get(`${API}/api/v1/health`);
  if (!health.ok || health.body?.status !== 'up') fail(`API ${health.body?.status}`);
  else {
    const pg = (health.body.dependencies || []).find((d) => d.name === 'postgres');
    if (pg?.status !== 'up') fail(`postgres ${pg?.status}`);
    else pass('API + postgres up');
  }

  const home = await get(`${WEB}/terminal/workspace`);
  if (!home.ok) fail(`home ${home.status}`);
  else if (/fetch failed|API offline/i.test(home.text)) fail('home offline');
  else if (!/Ask AI|Compare options/i.test(home.text)) fail('home missing demo path');
  else pass('home demo path');

  const conn = await get(`${WEB}/terminal/connectors`);
  if (!conn.ok) fail(`connectors ${conn.status}`);
  else if (!/Shopify \(first live path\)|SHOPIFY/i.test(conn.text)) {
    fail('connectors missing Shopify first-path');
  } else pass('connectors Shopify first-path');

  const op = await get(`${API}/api/v1/ai/operator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      objective:
        'Suggest 4 concrete USB-powered LED products worth reselling online with rough price bands',
      navigate: false,
    }),
  });
  if (!op.ok) fail(`operator ${op.status}`);
  const comparison = Array.isArray(op.body?.productComparison)
    ? op.body.productComparison
    : [];
  if (comparison.length < 3) fail(`comparison ${comparison.length}`);
  else pass(`comparison=${comparison.length}`);

  // Simulate auto-save (same endpoint the UI uses)
  const persist = await get(`${API}/api/v1/ai/operator/research-to-cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ runId: op.body?.runId, products: comparison }),
  });
  if (!persist.ok) fail(`auto-save endpoint ${persist.status}`);
  else if ((persist.body?.cases?.length ?? 0) < 3) fail('auto-save cases < 3');
  else pass(`auto-save cases=${persist.body.cases.length} created=${persist.body.created}`);

  if (process.exitCode) {
    console.error('\nCycle 5 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 5 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
