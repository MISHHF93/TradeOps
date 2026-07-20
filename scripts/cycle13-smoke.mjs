#!/usr/bin/env node
/**
 * Cycle 13 smoke — storefront ACTIVE publish gates (confirm + phrase + not_pushed).
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
  console.log(`Cycle 13 smoke · API=${API} WEB=${WEB}`);

  const health = await get(`${API}/api/v1/health`);
  if (!health.ok || health.body?.status !== 'up') fail(`API ${health.body?.status}`);
  else pass('API up');

  const home = await get(`${WEB}/terminal/workspace`);
  if (!home.ok) fail(`home ${home.status}`);
  else if (/fetch failed|API offline/i.test(home.text)) fail('home offline');
  else if (!/Publish ACTIVE|Launch to Shopify|Merchant setup/i.test(home.text)) {
    fail('home missing Cycle 13 ACTIVE publish copy');
  } else pass('home wizard ACTIVE path');

  // Without listing / product → not_pushed
  const noListing = await get(`${API}/api/v1/ai/operator/publish-shopify-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      confirmPublish: true,
      confirmPhrase: 'PUBLISH_ACTIVE',
    }),
  });
  if (noListing.body?.status !== 'blocked_not_pushed') {
    fail(`expected blocked_not_pushed got ${noListing.body?.status}`);
  } else pass('blocked_not_pushed without product');
  if (noListing.body?.storefrontActive) fail('must not claim storefrontActive');
  else pass('storefrontActive=false');

  // confirmPublish false
  const noConfirm = await get(`${API}/api/v1/ai/operator/publish-shopify-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/1',
      confirmPublish: false,
      confirmPhrase: 'PUBLISH_ACTIVE',
    }),
  });
  if (noConfirm.body?.status !== 'blocked_confirm') {
    fail(`expected blocked_confirm got ${noConfirm.body?.status}`);
  } else pass('confirmPublish gate');

  // Research → prepare → get listing (still no shopify gid)
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

  // Listing exists but not shopify-pushed (research externalId)
  const beforePush = await get(`${API}/api/v1/ai/operator/publish-shopify-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      confirmPublish: true,
      confirmPhrase: 'PUBLISH_ACTIVE',
    }),
  });
  if (beforePush.body?.status !== 'blocked_not_pushed') {
    fail(`pre-push status=${beforePush.body?.status}`);
  } else pass('blocked_not_pushed before DRAFT push');

  // Dry-run ACTIVE with fake gid (phrase/credentials path)
  const dry = await get(`${API}/api/v1/ai/operator/publish-shopify-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/999001',
      confirmPublish: true,
      dryRun: true,
    }),
  });
  if (dry.body?.status !== 'dry_run') fail(`dry status=${dry.body?.status}`);
  if (dry.body?.storefrontActive) fail('dry-run must not activate');
  const pr = dry.body?.publishReport;
  if (!pr?.headline || !Array.isArray(pr.checklist) || pr.checklist.length < 3) {
    fail('dry-run publishReport incomplete');
  } else pass(`dry-run report="${String(pr.headline).slice(0, 50)}"`);
  const storefront = pr.checklist.find((c) => c.id === 'storefront');
  if (!storefront || storefront.ok) fail('storefront check must be not-ok on dry-run');
  else pass('dry-run storefront not claimed active');

  // Live without phrase → blocked_phrase
  const noPhrase = await get(`${API}/api/v1/ai/operator/publish-shopify-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/999001',
      confirmPublish: true,
      dryRun: false,
    }),
  });
  if (noPhrase.body?.status !== 'blocked_phrase') {
    fail(`expected blocked_phrase got ${noPhrase.body?.status}`);
  } else pass('confirmPhrase gate');

  // Live with phrase → credentials or probe or shopify error (env dependent)
  const live = await get(`${API}/api/v1/ai/operator/publish-shopify-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      shopifyProductId: 'gid://shopify/Product/999001',
      confirmPublish: true,
      confirmPhrase: 'PUBLISH_ACTIVE',
      dryRun: false,
    }),
  });
  const allowed = new Set([
    'published_active',
    'blocked_credentials',
    'blocked_probe',
    'already_active',
    'shopify_error',
  ]);
  if (!allowed.has(live.body?.status)) fail(`live status=${live.body?.status}`);
  else pass(`live path status=${live.body.status}`);
  if (
    live.body?.status !== 'published_active' &&
    live.body?.status !== 'already_active' &&
    live.body?.storefrontActive
  ) {
    fail('non-success must not claim storefrontActive');
  } else {
    pass(`storefrontActive=${Boolean(live.body?.storefrontActive)}`);
  }

  const blob = JSON.stringify(dry.body) + JSON.stringify(live.body);
  if (/shpat_|shpss_|ACCESS_TOKEN\s*[:=]\s*['\"][^'\"]+/i.test(blob)) {
    fail('secret leakage');
  } else pass('no secrets');

  if (process.exitCode) {
    console.error('\nCycle 13 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 13 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
