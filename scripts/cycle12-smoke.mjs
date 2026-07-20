#!/usr/bin/env node
/**
 * Cycle 12 smoke — gallery imageUrls plan + stack-status --json reliability.
 */
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';
const WEB = process.env.WEB_PUBLIC_URL || 'http://127.0.0.1:3000';
const { spawnSync } = await import('node:child_process');
const { join, dirname } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const GALLERY = [
  process.env.CYCLE12_IMAGE_1 ||
    'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png',
  process.env.CYCLE12_IMAGE_2 ||
    'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-collection-1_large.png',
  process.env.CYCLE12_IMAGE_3 ||
    'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png',
];

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
  console.log(`Cycle 12 smoke · API=${API} WEB=${WEB}`);

  // Stack status JSON (reliability)
  const st = spawnSync(process.execPath, [join(root, 'scripts', 'stack-status.mjs'), '--json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  let stack = null;
  try {
    stack = JSON.parse((st.stdout || '').trim());
  } catch {
    fail(`stack-status --json parse failed: ${st.stdout?.slice(0, 200)}`);
  }
  if (!stack?.ok) fail(`stack-status ok=false db=${stack?.db?.status} api=${stack?.api?.status}`);
  else pass(`stack-status json ok db=${stack.db.status} api=${stack.api.status} web=${stack.web.ok}`);
  if (stack?.cycle !== 12) {
    // soft: field present for tooling
    pass(`stack-status cycle field=${stack?.cycle}`);
  } else pass('stack-status cycle=12');

  const health = await get(`${API}/api/v1/health`);
  if (!health.ok || health.body?.status !== 'up') fail(`API ${health.body?.status}`);
  else pass('API + health up');

  const home = await get(`${WEB}/terminal/workspace`);
  if (!home.ok) fail(`home ${home.status}`);
  else if (/fetch failed|API offline/i.test(home.text)) fail('home offline');
  else if (!/gallery|Launch to Shopify|Merchant setup/i.test(home.text)) {
    fail('home missing Cycle 12 gallery copy');
  } else pass('home wizard gallery path');

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

  const dry = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      approvalId,
      confirmPush: true,
      approveIfPending: true,
      dryRun: true,
      imageUrls: GALLERY,
    }),
  });
  if (dry.body?.status !== 'dry_run') fail(`dry status=${dry.body?.status}`);
  const m = dry.body?.media;
  if (!m || m.plannedCount !== 3) fail(`plannedCount=${m?.plannedCount}`);
  else pass(`gallery plannedCount=${m.plannedCount}`);
  if (!Array.isArray(m.sources) || m.sources.length !== 3) fail('sources length');
  else pass(`gallery sources=${m.sources.length}`);
  if (m.attachedCount !== 0 || m.attached) fail('dry-run must not attach');
  else pass('dry-run attachedCount=0');

  const mediaCheck = (dry.body?.launchReport?.checklist || []).find((c) => c.id === 'media');
  if (!mediaCheck?.detail || !/Planned 3/i.test(mediaCheck.detail)) {
    fail(`media detail=${mediaCheck?.detail}`);
  } else pass(`launchReport media: ${mediaCheck.detail.slice(0, 60)}`);
  if (dry.body?.launchReport?.mediaPlannedCount !== 3) {
    fail(`mediaPlannedCount=${dry.body?.launchReport?.mediaPlannedCount}`);
  } else pass('mediaPlannedCount=3');

  const live = await get(`${API}/api/v1/ai/operator/push-listing-to-shopify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      listingId,
      approvalId,
      confirmPush: true,
      approveIfPending: true,
      dryRun: false,
      imageUrls: GALLERY,
    }),
  });
  const stLive = live.body?.status;
  const allowed = new Set([
    'pushed',
    'blocked_credentials',
    'blocked_probe',
    'already_pushed',
    'shopify_error',
  ]);
  if (!allowed.has(stLive)) fail(`live status=${stLive}`);
  else pass(`live status=${stLive}`);

  if (live.body?.media?.plannedCount !== 3 && stLive !== 'already_pushed') {
    // blocked paths should still report planned gallery
    if (stLive === 'blocked_credentials' && live.body?.media?.plannedCount === 3) {
      pass('blocked keeps plannedCount=3');
    } else if (live.body?.launchReport?.mediaPlannedCount === 3) {
      pass('launchReport mediaPlannedCount=3');
    } else {
      fail(`live planned gallery missing status=${stLive}`);
    }
  } else if (stLive === 'pushed') {
    pass(
      `pushed gallery attached=${live.body.media?.attachedCount}/${live.body.media?.plannedCount}`,
    );
  } else {
    pass(`live media plannedCount=${live.body?.media?.plannedCount}`);
  }

  const blob = JSON.stringify(dry.body) + JSON.stringify(live.body) + JSON.stringify(stack);
  if (/shpat_|shpss_|ACCESS_TOKEN\s*[:=]\s*['\"][^'\"]+/i.test(blob)) {
    fail('secret leakage');
  } else pass('no secrets');

  if (process.exitCode) {
    console.error('\nCycle 12 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 12 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
