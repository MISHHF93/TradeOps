#!/usr/bin/env node
/**
 * Cycle 2 exit criteria smoke.
 * Usage: node scripts/cycle2-smoke.mjs  (stack up)
 */
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';
const WEB = process.env.WEB_PUBLIC_URL || 'http://127.0.0.1:3000';

async function get(url) {
  const res = await fetch(url);
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function fail(m) {
  console.error(`FAIL: ${m}`);
  process.exitCode = 1;
}
function pass(m) {
  console.log(`OK: ${m}`);
}

async function main() {
  console.log(`Cycle 2 smoke · API=${API} WEB=${WEB}`);

  const health = await get(`${API}/api/v1/health`);
  let body;
  try {
    body = JSON.parse(health.text);
  } catch {
    body = null;
  }
  if (!health.ok || body?.status !== 'up') fail(`API health ${health.status}`);
  else {
    const pg = (body.dependencies || []).find((d) => d.name === 'postgres');
    if (pg?.status !== 'up') fail(`postgres ${pg?.status}`);
    else pass('API + postgres up');
  }

  const pages = [
    ['/terminal/workspace', [/Show \d+ demo case/i, /Demo cases|What do you want to do/i]],
    ['/terminal/connectors', [/Go live when you are ready|Live mode|Connections/i, /Go live|Research with AI/i]],
    ['/terminal/process', [/Cases|Research with AI/i]],
  ];

  for (const [path, patterns] of pages) {
    const page = await get(`${WEB}${path}`);
    if (!page.ok) {
      fail(`page ${path} ${page.status}`);
      continue;
    }
    if (/fetch failed|API offline|workspace API offline/i.test(page.text)) {
      fail(`page ${path} offline chrome`);
      continue;
    }
    const hit = patterns.some((re) => re.test(page.text));
    if (!hit) fail(`page ${path} missing expected copy`);
    else pass(`page ${path} ok`);
  }

  // Home should not force-open demo case grid by default (toggle present when demo)
  const home = await get(`${WEB}/terminal/workspace`);
  if (home.ok && /Tactical Weapon Holster|USB LED Strip Light Kit with Remote/i.test(home.text)) {
    // titles may still appear in RSC payload for collapsed data — warn only if "Policy blocked" flood
    if ((home.text.match(/Policy blocked/g) || []).length > 3) {
      fail('Home still floods Policy blocked copy');
    } else {
      pass('Home demo noise controlled');
    }
  } else if (home.ok) {
    pass('Home no fixture SKU flood in HTML');
  }

  if (process.exitCode) {
    console.error('\nCycle 2 smoke FAILED');
    process.exit(1);
  }
  console.log('\nCycle 2 smoke PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
