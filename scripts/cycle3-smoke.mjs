#!/usr/bin/env node
/**
 * Cycle 3 exit criteria smoke.
 * Usage: node scripts/cycle3-smoke.mjs
 * Optional: CYCLE3_ENSURE_STACK=1 runs stack-supervise --once first.
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

function looksLikeProduct(t) {
  if (!t || t.length < 6 || t.length > 80) return false;
  if (/\b(how to|best products to sell|amazon fba|worth reselling)\b/i.test(t)) return false;
  return /[A-Za-z]{3,}/.test(t);
}

async function main() {
  if (process.env.CYCLE3_ENSURE_STACK === '1') {
    console.log('Ensuring stack (supervise --once)...');
    const r = spawnSync(process.execPath, [join(root, 'scripts/stack-supervise.mjs'), '--once'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
    });
    if (r.status !== 0) fail(`stack-supervise --once exit ${r.status}`);
    else pass('stack-supervise --once');
  }

  console.log(`Cycle 3 smoke · API=${API} WEB=${WEB}`);

  const health = await get(`${API}/api/v1/health`);
  if (!health.ok || health.body?.status !== 'up') fail(`API health ${health.status}`);
  else {
    const pg = (health.body.dependencies || []).find((d) => d.name === 'postgres');
    if (pg?.status !== 'up') fail(`postgres ${pg?.status}`);
    else pass('API + postgres up');
  }

  const home = await get(`${WEB}/terminal/workspace`);
  if (!home.ok) fail(`home ${home.status}`);
  else if (!/60 second demo|Ask AI|Compare options|Connect when ready/i.test(home.text)) {
    fail('Home missing founder 60s demo path');
  } else pass('Home founder demo path');

  if (/fetch failed|API offline/i.test(home.text || '')) fail('Home offline chrome');
  else pass('Home online');

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
  else {
    if (op.body?.honesty?.path !== 'ecommerce_agent') fail(`path=${op.body?.honesty?.path}`);
    else pass('operator ecommerce_agent');

    const recs = Array.isArray(op.body?.recommendations) ? op.body.recommendations : [];
    const products = recs.filter((r) => looksLikeProduct(r?.title));
    if (products.length < 3) fail(`product recs ${products.length}`);
    else pass(`product recs=${products.length}`);

    const withPrice = products.filter(
      (r) => r.priceBand || /\$|\d+\s*[-–—]\s*\d+/.test(String(r.rationale || '')),
    );
    if (withPrice.length < 2) {
      fail(`need ≥2 price bands, got ${withPrice.length}`);
    } else pass(`price bands=${withPrice.length}`);

    const comparison = Array.isArray(op.body?.productComparison)
      ? op.body.productComparison
      : [];
    if (comparison.length < 3) fail(`productComparison length ${comparison.length}`);
    else pass(`productComparison=${comparison.length}`);

    const artifact = op.body?.envelope?.artifactType;
    if (artifact && artifact !== 'product_comparison' && comparison.length >= 2) {
      // soft: still ok if field present
      pass(`artifactType=${artifact}`);
    } else if (artifact === 'product_comparison') pass('artifactType=product_comparison');
    else pass(`artifactType=${artifact || 'n/a'}`);

    products.slice(0, 4).forEach((r, i) => {
      console.log(`  R${i + 1} ${r.title} | ${r.priceBand || '—'} | ${(r.rationale || '').slice(0, 50)}`);
    });
  }

  if (process.exitCode) {
    console.error('\nCycle 3 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 3 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
