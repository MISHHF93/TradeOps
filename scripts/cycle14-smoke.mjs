#!/usr/bin/env node
/**
 * Cycle 14 smoke — inventory + collection post-ACTIVE ops gates.
 * Does not require live Shopify credentials.
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
  console.log(`Cycle 14 smoke · API=${API} WEB=${WEB}`);

  const health = await get(`${API}/api/v1/health`);
  if (!health.ok || health.body?.status !== 'up') fail(`API ${health.body?.status}`);
  else pass('API up');

  const home = await get(`${WEB}/terminal/workspace`);
  if (!home.ok) fail(`home ${home.status}`);
  else if (/fetch failed|API offline/i.test(home.text)) fail('home offline');
  else if (!/inventory \+ collection|Launch to Shopify|Merchant setup/i.test(home.text)) {
    fail('home missing Cycle 14 inventory/collection copy');
  } else pass('home wizard ops path');

  // confirmOps gate
  const noConfirm = await get(`${API}/api/v1/ai/operator/shopify-post-active-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/1',
      confirmOps: false,
      inventoryQuantity: 10,
    }),
  });
  if (noConfirm.body?.status !== 'blocked_confirm') {
    fail(`expected blocked_confirm got ${noConfirm.body?.status}`);
  } else pass('confirmOps gate');

  // noop
  const noop = await get(`${API}/api/v1/ai/operator/shopify-post-active-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/1',
      confirmOps: true,
    }),
  });
  if (noop.body?.status !== 'blocked_noop') {
    fail(`expected blocked_noop got ${noop.body?.status}`);
  } else pass('blocked_noop without inventory/collection');

  // not pushed (listing from research without shopify gid)
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

  const golive = await get(`${API}/api/v1/ai/operator/prepare-shopify-golive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ runId: op.body?.runId, products: comparison }),
  });
  const listingId = golive.body?.goLivePack?.listing?.id;
  if (!listingId) fail('prepare missing listing');
  else pass(`listing=${String(listingId).slice(0, 8)}`);

  const notPushed = await get(`${API}/api/v1/ai/operator/shopify-post-active-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      confirmOps: true,
      inventoryQuantity: 10,
      collectionTitle: 'TradeOps Research',
    }),
  });
  if (notPushed.body?.status !== 'blocked_not_pushed') {
    fail(`expected blocked_not_pushed got ${notPushed.body?.status}`);
  } else pass('blocked_not_pushed before DRAFT push');

  // dry-run with fake gid
  const dry = await get(`${API}/api/v1/ai/operator/shopify-post-active-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/999014',
      confirmOps: true,
      dryRun: true,
      inventoryQuantity: 25,
      collectionTitle: 'TradeOps Research',
    }),
  });
  if (dry.body?.status !== 'dry_run') fail(`dry status=${dry.body?.status}`);
  if (dry.body?.inventory?.quantity !== 25) fail(`qty=${dry.body?.inventory?.quantity}`);
  else pass('dry-run inventory qty=25 planned');
  if (dry.body?.collection?.title !== 'TradeOps Research') {
    fail(`collection title=${dry.body?.collection?.title}`);
  } else pass('dry-run collection title planned');
  if (dry.body?.inventory?.ok || dry.body?.collection?.ok) {
    fail('dry-run must not claim ops ok');
  } else pass('dry-run does not claim applied');
  const invCheck = (dry.body?.opsReport?.checklist || []).find((c) => c.id === 'inventory');
  if (!invCheck?.detail || !/Would set available qty 25/i.test(invCheck.detail)) {
    fail(`inventory detail=${invCheck?.detail}`);
  } else pass('opsReport inventory plan');

  // live with phrase-less fake gid → credentials or probe or error
  const live = await get(`${API}/api/v1/ai/operator/shopify-post-active-ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/999014',
      confirmOps: true,
      dryRun: false,
      inventoryQuantity: 10,
      collectionTitle: 'TradeOps Research',
    }),
  });
  const allowed = new Set([
    'applied',
    'partial',
    'blocked_credentials',
    'blocked_probe',
    'shopify_error',
  ]);
  if (!allowed.has(live.body?.status)) fail(`live status=${live.body?.status}`);
  else pass(`live path status=${live.body.status}`);
  if (
    (live.body?.status === 'blocked_credentials' || live.body?.status === 'blocked_probe') &&
    (live.body?.inventory?.ok || live.body?.collection?.ok)
  ) {
    fail('blocked path must not claim ok ops');
  } else {
    pass('blocked/live honesty ok');
  }

  const blob = JSON.stringify(dry.body) + JSON.stringify(live.body);
  if (/shpat_|shpss_|ACCESS_TOKEN\s*[:=]\s*['\"][^'\"]+/i.test(blob)) {
    fail('secret leakage');
  } else pass('no secrets');

  if (process.exitCode) {
    console.error('\nCycle 14 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 14 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
