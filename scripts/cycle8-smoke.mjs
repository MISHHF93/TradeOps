#!/usr/bin/env node
/**
 * Cycle 8 smoke — Shopify go-live pack from research (approval + readiness; no productCreate).
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
  console.log(`Cycle 8 smoke · API=${API} WEB=${WEB}`);

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
  else if (
    !/Prepare Shopify go-live|Shopify path|Merchant setup|First run · Cycle 6/i.test(home.text)
  ) {
    fail('home missing Cycle 8 go-live wizard copy');
  } else pass('home wizard Shopify go-live path');

  const conn = await get(`${WEB}/terminal/connectors`);
  if (!conn.ok) fail(`connectors ${conn.status}`);
  else if (!/shopify-path|SHOPIFY_SHOP_DOMAIN|First live path/i.test(conn.text)) {
    fail('connectors missing shopify-path');
  } else pass('connectors shopify-path');

  const op = await get(`${API}/api/v1/ai/operator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      objective:
        'Suggest 4 concrete USB-powered LED products worth reselling online with rough price bands',
      navigate: false,
    }),
  });
  if (!op.ok) fail(`operator ${op.status} ${op.body?.message || ''}`);
  const comparison = Array.isArray(op.body?.productComparison)
    ? op.body.productComparison
    : [];
  if (comparison.length < 3) fail(`comparison ${comparison.length}`);
  else pass(`comparison=${comparison.length}`);

  if (!op.body?.merchantDecision?.topPick?.product) fail('missing merchantDecision');
  else pass(`topPick=${op.body.merchantDecision.topPick.product}`);

  const golive = await get(`${API}/api/v1/ai/operator/prepare-shopify-golive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      runId: op.body?.runId,
      products: comparison,
    }),
  });
  if (!golive.ok || golive.body?.error) {
    fail(
      `prepare-shopify-golive ${golive.status} ${golive.body?.error || golive.body?.message || ''}`,
    );
  }

  const pack = golive.body?.goLivePack;
  if (!pack?.headline || !Array.isArray(pack.checklist) || pack.checklist.length < 4) {
    fail('goLivePack checklist incomplete');
  } else {
    pass(`golive="${String(pack.headline).slice(0, 70)}"`);
    pass(`checklist=${pack.checklist.length}`);
  }

  const byId = Object.fromEntries((pack?.checklist || []).map((c) => [c.id, c]));
  if (!byId.draft?.ok) fail('draft check not ok');
  else pass('checklist.draft ok');
  if (!byId.approval?.ok) fail('approval check not ok');
  else pass(`checklist.approval ok status=${pack.approval?.status}`);
  if (byId.live_push?.ok) fail('live_push must stay blocked (no productCreate)');
  else pass('checklist.live_push blocked (honest)');

  if (pack?.honesty?.publishedToShopify) fail('must not claim publishedToShopify');
  else pass('honesty.publishedToShopify=false');

  if (!pack?.approval?.id || pack.approval.status !== 'pending') {
    // approved is ok if re-run; pending expected first time
    if (pack?.approval?.status === 'approved') pass('approval already approved (deduped)');
    else fail(`approval ${pack?.approval?.status}`);
  } else {
    pass(`approval pending id=${String(pack.approval.id).slice(0, 8)}`);
  }

  if (pack?.listing?.status !== 'pending_approval' && pack?.listing?.status !== 'active') {
    fail(`listing status=${pack?.listing?.status}`);
  } else {
    pass(`listing status=${pack.listing.status}`);
  }

  if (!pack?.publishPayloadPreview?.title || pack.publishPayloadPreview.status !== 'preview_only') {
    fail('publishPayloadPreview missing/wrong');
  } else {
    pass(
      `payload preview ${pack.publishPayloadPreview.title.slice(0, 40)} · ${pack.publishPayloadPreview.price}`,
    );
  }

  // Secrets must never appear
  const blob = JSON.stringify(golive.body);
  if (/shpat_|shpss_|ACCESS_TOKEN\s*[:=]\s*['\"][^'\"]+/i.test(blob)) {
    fail('possible secret leakage in go-live response');
  } else pass('no secrets in go-live response');

  if (process.exitCode) {
    console.error('\nCycle 8 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 8 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
