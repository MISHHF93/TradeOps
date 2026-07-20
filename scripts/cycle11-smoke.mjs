#!/usr/bin/env node
/**
 * Cycle 11 smoke — media readiness in launchReport + optional imageUrl plan.
 * Does not require live Shopify; asserts honest media checklist.
 */
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';
const WEB = process.env.WEB_PUBLIC_URL || 'http://127.0.0.1:3000';

const SAMPLE_IMAGE =
  process.env.CYCLE11_IMAGE_URL ||
  'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

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
  console.log(`Cycle 11 smoke · API=${API} WEB=${WEB}`);

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
  else if (!/Launch to Shopify|media|price\/SKU|Merchant setup/i.test(home.text)) {
    fail('home missing Cycle 11 media/launch copy');
  } else pass('home wizard media/launch path');

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
  if (!golive.body?.goLivePack?.listing?.id) fail('prepare missing listing');
  const listingId = golive.body.goLivePack.listing.id;
  const approvalId = golive.body.goLivePack.approval?.id;
  pass(`listing=${String(listingId).slice(0, 8)}`);

  // Dry-run without image (research products usually have none)
  const dryNoImg = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
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
  if (dryNoImg.body?.status !== 'dry_run') fail(`dry status=${dryNoImg.body?.status}`);
  const lr0 = dryNoImg.body?.launchReport;
  const media0 = (lr0?.checklist || []).find((c) => c.id === 'media');
  if (!media0) fail('launchReport missing media check');
  else pass(`media check (no image): ${media0.detail?.slice(0, 60)}`);
  if (lr0.mediaAttached !== false) fail('mediaAttached must be false without image');
  if (dryNoImg.body?.media?.attached) fail('media.attached must be false');
  pass('honest no-media dry-run');

  // Dry-run with explicit public image URL
  const dryImg = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      approvalId,
      confirmPush: true,
      approveIfPending: true,
      dryRun: true,
      imageUrl: SAMPLE_IMAGE,
    }),
  });
  if (dryImg.body?.status !== 'dry_run') fail(`dry+img status=${dryImg.body?.status}`);
  const media1 = (dryImg.body?.launchReport?.checklist || []).find((c) => c.id === 'media');
  if (!media1?.detail || !/Planned|cdn\.shopify|https:/i.test(media1.detail)) {
    fail(`media plan missing: ${media1?.detail}`);
  } else pass(`media planned: ${media1.detail.slice(0, 70)}`);
  if (dryImg.body?.media?.sourceUrl !== SAMPLE_IMAGE) {
    fail(`media.sourceUrl=${dryImg.body?.media?.sourceUrl}`);
  } else pass('media.sourceUrl matches imageUrl');
  if (dryImg.body?.media?.attached || dryImg.body?.launchReport?.mediaAttached) {
    fail('dry-run must not attach media');
  } else pass('dry-run does not attach media');

  // Live path (credentials optional)
  const live = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      approvalId,
      confirmPush: true,
      approveIfPending: true,
      dryRun: false,
      imageUrl: SAMPLE_IMAGE,
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

  const liveMedia = (live.body?.launchReport?.checklist || []).find((c) => c.id === 'media');
  if (!liveMedia) fail('live launchReport missing media');
  else pass(`live media: ok=${liveMedia.ok} ${String(liveMedia.detail || '').slice(0, 50)}`);

  if (st === 'pushed' && live.body?.media?.attached) {
    pass(`media attached id=${live.body.media.mediaId || 'processing'}`);
  }
  if (st === 'blocked_credentials') {
    if (live.body?.media?.attached) fail('blocked cannot attach media');
    pass('blocked_credentials honest media');
  }

  const blob = JSON.stringify(dryImg.body) + JSON.stringify(live.body);
  if (/shpat_|shpss_|ACCESS_TOKEN\s*[:=]\s*['\"][^'\"]+/i.test(blob)) {
    fail('secret leakage');
  } else pass('no secrets');

  if (process.exitCode) {
    console.error('\nCycle 11 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 11 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
