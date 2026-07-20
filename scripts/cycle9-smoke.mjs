#!/usr/bin/env node
/**
 * Cycle 9 smoke — approve + explicit Shopify push (dry-run / credential gate).
 * Never requires live Shopify; asserts confirmPush + honesty.
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
  console.log(`Cycle 9 smoke · API=${API} WEB=${WEB}`);

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
  else if (!/Prepare \+ push Shopify|Approve|Dry-run|Merchant setup/i.test(home.text)) {
    fail('home missing Cycle 9 wizard push copy');
  } else pass('home wizard push path');

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
  if (!golive.ok || !golive.body?.goLivePack?.listing?.id) {
    fail(`prepare-shopify-golive ${golive.status} ${golive.body?.error || ''}`);
  } else {
    pass(`listing=${String(golive.body.goLivePack.listing.id).slice(0, 8)}`);
    pass(`approval=${golive.body.goLivePack.approval?.status}`);
  }

  const listingId = golive.body.goLivePack.listing.id;
  const approvalId = golive.body.goLivePack.approval?.id;

  // Without confirmPush must refuse
  const noConfirm = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ listingId, approvalId, confirmPush: false }),
  });
  if (noConfirm.body?.status !== 'blocked_confirm' || noConfirm.body?.publishedToShopify) {
    fail(`confirm gate status=${noConfirm.body?.status}`);
  } else pass('confirmPush gate blocks silent push');

  // Dry-run with approve
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
  if (!dry.ok && dry.body?.error === 'listing_required') fail('dry-run listing missing');
  if (dry.body?.status !== 'dry_run') fail(`dry-run status=${dry.body?.status}`);
  if (dry.body?.publishedToShopify) fail('dry-run must not publish');
  if (!dry.body?.payloadPreview?.title) fail('dry-run missing payloadPreview');
  else {
    pass(`dry-run ok title=${dry.body.payloadPreview.title.slice(0, 40)}`);
    pass(`approval after dry=${dry.body.approval?.status}`);
  }

  // Live push path (credentials optional)
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
  if (!allowed.has(st)) fail(`live push unexpected status=${st}`);
  else pass(`live path status=${st} published=${Boolean(live.body?.publishedToShopify)}`);

  if (st === 'pushed') {
    if (!live.body?.shopifyProductId?.includes('gid://shopify')) {
      fail('pushed without shopify product gid');
    } else pass(`shopifyProductId=${String(live.body.shopifyProductId).slice(0, 40)}`);
  }
  if (st === 'blocked_credentials' && live.body?.publishedToShopify) {
    fail('blocked_credentials cannot claim published');
  }
  if (st !== 'pushed' && live.body?.publishedToShopify && st !== 'already_pushed') {
    fail('publishedToShopify true without pushed');
  }

  // Secrets
  const blob = JSON.stringify(live.body) + JSON.stringify(dry.body);
  if (/shpat_|shpss_|ACCESS_TOKEN\s*[:=]\s*['\"][^'\"]+/i.test(blob)) {
    fail('possible secret leakage');
  } else pass('no secrets in push responses');

  if (process.exitCode) {
    console.error('\nCycle 9 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 9 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
