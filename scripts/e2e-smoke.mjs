#!/usr/bin/env node
/**
 * Smoke E2E against a running stack (API :4000, Web :3000).
 * Usage: node scripts/e2e-smoke.mjs
 */
const API = (process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const WEB = (process.env.WEB_ORIGIN || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function must(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

async function json(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`${res.status} ${url} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function main() {
  await must('health live', async () => {
    const h = await json(`${API}/api/v1/health/live`);
    if (h.status !== 'up') throw new Error(JSON.stringify(h));
  });

  await must('public capabilities', async () => {
    const c = await json(`${API}/api/v1/public/capabilities`);
    if (!c.entries?.length) throw new Error('no entries');
  });

  await must('public unit economics', async () => {
    const r = await json(`${API}/api/v1/public/tools/unit-economics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellingPriceMinor: 4999,
        marketplaceFeeMinor: 750,
        paymentFeeMinor: 175,
        supplierCostMinor: 1800,
        shippingCostMinor: 450,
        currency: 'USD',
      }),
    });
    if (!r.ok) throw new Error(JSON.stringify(r));
  });

  await must('login seed user', async () => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: 'founder@tradeops.local',
        password: 'TradeOps-Demo-2026!',
      }),
    });
    if (!res.ok) throw new Error(`login ${res.status}`);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    const me = await fetch(`${API}/api/v1/auth/me`, {
      headers: { Cookie: cookie, Accept: 'application/json' },
    });
    if (!me.ok) throw new Error(`me ${me.status}`);
  });

  await must('AI operator shadow', async () => {
    const r = await json(`${API}/api/v1/ai/operator/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective: 'Find products with margin above 15% and low policy risk',
        forceShadow: true,
      }),
    });
    if (!r.decision) throw new Error(JSON.stringify(r).slice(0, 200));
  });

  await must('workflow templates', async () => {
    const r = await json(`${API}/api/v1/automation/workflows/templates`);
    if (!r.templates?.length) throw new Error('no templates');
  });

  const pages = ['/', '/status', '/login', '/register', '/privacy', '/terms', '/terminal'];
  for (const p of pages) {
    await must(`web ${p}`, async () => {
      const res = await fetch(`${WEB}${p}`);
      if (!res.ok) throw new Error(String(res.status));
    });
  }

  if (process.exitCode) {
    console.error('Smoke failed');
    process.exit(process.exitCode);
  }
  console.log('All smoke checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
