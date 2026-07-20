#!/usr/bin/env node
/**
 * Cycle 4 exit criteria:
 * - stack healthy
 * - operator productComparison
 * - research-to-cases creates ai-research products + cases
 * - home/connectors copy present
 */
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
  console.log(`Cycle 4 smoke · API=${API} WEB=${WEB}`);

  const health = await get(`${API}/api/v1/health`);
  if (!health.ok || health.body?.status !== 'up') fail(`API ${health.status} ${health.body?.status}`);
  else {
    const pg = (health.body.dependencies || []).find((d) => d.name === 'postgres');
    if (pg?.status !== 'up') fail(`postgres ${pg?.status}`);
    else pass('API + postgres up');
  }

  for (const [path, re] of [
    ['/terminal/workspace', /Ask AI|Compare options|Save as Cases|What do you want/i],
    ['/terminal/connectors', /Go live|First live path|SHOPIFY|Research with AI/i],
  ]) {
    const page = await get(`${WEB}${path}`);
    if (!page.ok) fail(`page ${path} ${page.status}`);
    else if (/fetch failed|API offline/i.test(page.text)) fail(`page ${path} offline`);
    else if (!re.test(page.text)) fail(`page ${path} missing copy`);
    else pass(`page ${path}`);
  }

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
  else if (op.body?.honesty?.path !== 'ecommerce_agent') fail('not ecommerce_agent');
  else pass('operator ecommerce_agent');

  const comparison = Array.isArray(op.body?.productComparison)
    ? op.body.productComparison
    : [];
  if (comparison.length < 3) fail(`comparison ${comparison.length}`);
  else pass(`comparison=${comparison.length}`);

  const persist = await get(`${API}/api/v1/ai/operator/research-to-cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      runId: op.body?.runId,
      products: comparison,
    }),
  });
  if (!persist.ok) fail(`research-to-cases ${persist.status} ${JSON.stringify(persist.body)?.slice(0, 160)}`);
  else {
    const c = persist.body?.created ?? 0;
    const r = persist.body?.reused ?? 0;
    const n = persist.body?.cases?.length ?? 0;
    if (n < 3) fail(`cases saved ${n}`);
    else pass(`research-to-cases created=${c} reused=${r} cases=${n}`);
    const platforms = (persist.body?.cases || []).map((x) => x.title).slice(0, 3);
    console.log(`  titles: ${platforms.join(' · ')}`);
  }

  // Cases board should list research cases (or at least respond)
  const process = await get(`${API}/api/v1/commerce/process`);
  if (!process.ok) fail(`process ${process.status}`);
  else {
    const total = process.body?.summary?.totalOpen ?? 0;
    if (total < 1) fail('process has no open cases after save');
    else pass(`process open cases=${total}`);
  }

  if (process.exitCode) {
    console.error('\nCycle 4 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 4 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
