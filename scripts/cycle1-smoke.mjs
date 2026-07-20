#!/usr/bin/env node
/**
 * Cycle 1 exit criteria smoke (TradeOps product scorecard).
 *
 * Usage (stack already up):
 *   node scripts/cycle1-smoke.mjs
 *
 * Exit 0 = all criteria pass.
 */
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';
const WEB = process.env.WEB_PUBLIC_URL || 'http://127.0.0.1:3000';

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body, text };
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`OK: ${msg}`);
}

function looksLikeProductTitle(t) {
  if (!t || typeof t !== 'string') return false;
  const s = t.trim();
  if (s.length < 6 || s.length > 80) return false;
  if (/^(commerce|procurement|research|search)\./i.test(s)) return false;
  if (
    /\b(how to|guide to|sites you can trust|products to sell online in \d{4}|high-demand and trending|best products to sell|what to sell|worth reselling|amazon fba|7-figures|best sellers are already)\b/i.test(
      s,
    )
  ) {
    return false;
  }
  if (/\?$/.test(s)) return false;
  // Prefer noun-ish product phrasing (letters + optional numbers), not pure meta fragments
  if (!/[A-Za-z]{3,}/.test(s)) return false;
  if (/^(worth|best|top|these|the trends)\b/i.test(s)) return false;
  return true;
}

async function main() {
  console.log(`Cycle 1 smoke · API=${API} WEB=${WEB}`);

  const health = await getJson(`${API}/api/v1/health`);
  if (!health.ok || health.body?.status !== 'up') {
    fail(`API health not up (${health.status})`);
  } else {
    const pg = (health.body.dependencies || []).find((d) => d.name === 'postgres');
    if (pg?.status !== 'up') fail(`postgres ${pg?.status}`);
    else pass('API + postgres up');
  }

  const ws = await getJson(`${API}/api/v1/workspace`);
  if (!ws.ok) fail(`workspace ${ws.status}`);
  else {
    const top = ws.body?.surface?.todaysPriorities?.[0]?.label || '';
    if (!/research live product/i.test(top)) {
      fail(`top priority expected research-first, got: ${top}`);
    } else pass(`top priority: ${top}`);
  }

  for (const path of ['/terminal', '/terminal/workspace', '/terminal/process']) {
    const page = await getJson(`${WEB}${path}`);
    if (!page.ok) fail(`page ${path} status ${page.status}`);
    else if (/fetch failed|API offline|workspace API offline/i.test(page.text || '')) {
      fail(`page ${path} still shows offline/fetch failed`);
    } else pass(`page ${path} clean`);
  }

  const op = await getJson(`${API}/api/v1/ai/operator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      objective:
        'Suggest 4 concrete USB-powered LED products worth reselling online with rough price bands',
      navigate: false,
    }),
  });
  if (!op.ok) fail(`operator ${op.status} ${JSON.stringify(op.body)?.slice(0, 200)}`);
  else {
    const path = op.body?.honesty?.path;
    if (path !== 'ecommerce_agent') fail(`operator path=${path}`);
    else pass(`operator path=${path}`);

    const recs = Array.isArray(op.body?.recommendations) ? op.body.recommendations : [];
    const productRecs = recs.filter((r) => looksLikeProductTitle(r?.title));
    if (productRecs.length < 3) {
      fail(
        `need ≥3 product-like recs, got ${productRecs.length}: ${recs
          .map((r) => r?.title)
          .join(' | ')}`,
      );
    } else {
      pass(`product-like recs=${productRecs.length}`);
      productRecs.slice(0, 4).forEach((r, i) => console.log(`  R${i + 1} ${r.title}`));
    }

    const sources = Array.isArray(op.body?.sources) ? op.body.sources : [];
    const tavily = sources.filter(
      (s) =>
        /tavily/i.test(String(s?.name || '')) ||
        /^https?:\/\//i.test(String(s?.detail || '')),
    );
    if (tavily.length < 1) fail('need ≥1 web/tavily source');
    else pass(`web sources=${tavily.length}`);
  }

  if (process.exitCode) {
    console.error('\nCycle 1 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 1 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
