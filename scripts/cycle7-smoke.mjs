#!/usr/bin/env node
/**
 * Cycle 7 smoke — merchant decision brief + research → listing draft.
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
  console.log(`Cycle 7 smoke · API=${API} WEB=${WEB}`);

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
  else if (!/Decide \+ draft listing|Draft listing for #1|Merchant setup|First run · Cycle 6/i.test(home.text)) {
    fail('home missing Cycle 7 wizard copy');
  } else pass('home wizard decision+draft path');

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

  const md = op.body?.merchantDecision;
  if (!md?.headline || !md?.topPick?.product) {
    fail('missing merchantDecision.topPick');
  } else {
    pass(`decision="${String(md.headline).slice(0, 60)}"`);
    pass(`topPick=${md.topPick.product}`);
  }

  const brief = op.body?.listingBrief;
  if (!brief?.listingTitle || !Array.isArray(brief.bullets) || brief.bullets.length < 2) {
    fail('missing listingBrief bullets');
  } else {
    pass(`listingBrief bullets=${brief.bullets.length} retail=${brief.suggestedRetail || '—'}`);
  }

  if (op.body?.envelope?.artifactType !== 'merchant_decision' && comparison.length >= 2) {
    fail(`artifactType=${op.body?.envelope?.artifactType}`);
  } else if (comparison.length >= 2) {
    pass('artifactType=merchant_decision');
  }

  const draft = await get(`${API}/api/v1/ai/operator/research-to-listing-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      runId: op.body?.runId,
      products: comparison,
    }),
  });
  if (!draft.ok || draft.body?.error) {
    fail(`listing-draft ${draft.status} ${draft.body?.error || draft.body?.message || ''}`);
  } else if (!draft.body?.listingId || draft.body?.listingStatus !== 'draft') {
    fail(`listing status=${draft.body?.listingStatus} id=${draft.body?.listingId}`);
  } else {
    pass(
      `listing draft id=${String(draft.body.listingId).slice(0, 8)} status=${draft.body.listingStatus} created=${draft.body.created}`,
    );
    pass(`case=${String(draft.body.caseId || '').slice(0, 8)} note=${draft.body.note || ''}`);
  }

  // Honesty: never published
  if (draft.body && /publish/i.test(String(draft.body.listingStatus))) {
    fail('listing must not be published');
  } else if (draft.body?.listingId) {
    pass('listing remains draft (not published)');
  }

  if (process.exitCode) {
    console.error('\nCycle 7 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 7 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
