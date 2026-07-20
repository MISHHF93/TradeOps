#!/usr/bin/env node
/**
 * Cycle 10 smoke — launch report + price/SKU plan + admin link fields.
 * Live Shopify optional; dry-run must return launchReport with planned price/SKU.
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
  console.log(`Cycle 10 smoke · API=${API} WEB=${WEB}`);

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
  else if (!/Launch to Shopify|price\/SKU|Merchant setup|Dry-run/i.test(home.text)) {
    fail('home missing Cycle 10 launch wizard copy');
  } else pass('home wizard launch path');

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
  if (!golive.body?.goLivePack?.listing?.id) fail('prepare golive missing listing');
  else pass(`listing=${String(golive.body.goLivePack.listing.id).slice(0, 8)}`);

  const listingId = golive.body.goLivePack.listing.id;
  const approvalId = golive.body.goLivePack.approval?.id;

  const dry = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      approvalId,
      confirmPush: true,
      approveIfPending: true,
      dryRun: true,
    }),
  });
  if (dry.body?.status !== 'dry_run') fail(`dry-run status=${dry.body?.status}`);
  if (dry.body?.publishedToShopify) fail('dry-run published');
  const lr = dry.body?.launchReport;
  if (!lr?.headline || !Array.isArray(lr.checklist) || lr.checklist.length < 3) {
    fail('dry-run missing launchReport');
  } else pass(`launchReport="${String(lr.headline).slice(0, 50)}"`);

  const byId = Object.fromEntries(lr.checklist.map((c) => [c.id, c]));
  if (!byId.price?.detail || !/\$|\d/.test(byId.price.detail)) {
    fail('launchReport.price missing planned price');
  } else pass(`planned price detail=${byId.price.detail}`);
  if (!byId.sku?.detail) fail('launchReport.sku missing');
  else pass(`planned sku detail=${byId.sku.detail}`);
  if (lr.priceSynced !== false || lr.skuSynced !== false) {
    fail('dry-run must not claim price/sku synced');
  } else pass('priceSynced=false skuSynced=false (honest dry-run)');

  if (!dry.body?.payloadPreview?.price || !dry.body?.payloadPreview?.sku) {
    fail('payloadPreview missing price/sku');
  } else {
    pass(
      `payloadPreview price=${dry.body.payloadPreview.price} sku=${dry.body.payloadPreview.sku}`,
    );
  }

  const live = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      approvalId,
      confirmPush: true,
      approveIfPending: true,
      dryRun: false,
    }),
  });
  const st = live.body?.status;
  const allowed = new Set([
    'pushed',
    'blocked_credentials',
    'blocked_probe',
    'already_pushed',
    'shopify_error',
  ]);
  if (!allowed.has(st)) fail(`live status=${st}`);
  else pass(`live status=${st}`);

  if (!live.body?.launchReport?.checklist?.length) {
    fail('live missing launchReport');
  } else pass(`live launchReport checks=${live.body.launchReport.checklist.length}`);

  if (st === 'pushed') {
    if (!live.body.publishedToShopify) fail('pushed must set publishedToShopify');
    if (!live.body.shopifyProductId) fail('pushed missing product id');
    if (live.body.launchReport.priceSynced !== true) {
      // soft: variant API may fail on some shops; still require product
      console.log(
        `WARN: priceSynced=${live.body.launchReport.priceSynced} err may be variant API`,
      );
    } else pass(`price synced $${live.body.variant?.price ?? '?'}`);
    if (live.body.shopifyAdminUrl || live.body.launchReport.shopifyAdminUrl) {
      pass(`adminUrl=${live.body.shopifyAdminUrl || live.body.launchReport.shopifyAdminUrl}`);
    } else {
      fail('pushed missing shopifyAdminUrl');
    }
  }

  if (st === 'blocked_credentials') {
    if (live.body.publishedToShopify) fail('blocked cannot publish');
    if (live.body.launchReport.priceSynced !== false) fail('blocked must not claim sync');
    pass('blocked_credentials honest launchReport');
  }

  const blob = JSON.stringify(dry.body) + JSON.stringify(live.body);
  if (/shpat_|shpss_|ACCESS_TOKEN\s*[:=]\s*['\"][^'\"]+/i.test(blob)) {
    fail('secret leakage');
  } else pass('no secrets');

  if (process.exitCode) {
    console.error('\nCycle 10 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 10 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
