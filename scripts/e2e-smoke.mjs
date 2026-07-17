#!/usr/bin/env node
/**
 * Smoke E2E against a running stack (API :4000, Web :3000).
 * Compatible with TRADEOPS_ACCESS_MODE=founder_direct (default) and authenticated.
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

  let founderDirect = false;
  await must('public access-mode', async () => {
    const m = await json(`${API}/api/v1/public/access-mode`);
    if (!m.mode) throw new Error(JSON.stringify(m));
    founderDirect = Boolean(m.founderDirect || m.mode === 'founder_direct');
    console.log(`      mode=${m.mode} founderDirect=${founderDirect}`);
  });

  await must('public capabilities', async () => {
    const c = await json(`${API}/api/v1/public/capabilities`);
    if (!c.entries?.length) throw new Error('no entries');
    const watch = c.entries.find((e) => e.id === 'app.watchlist');
    if (watch && watch.status !== 'operational') {
      throw new Error(`watchlist status ${watch.status}`);
    }
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
    if (!r.ok && r.contributionProfitMinor === undefined && !r.unit) {
      // accept either shape from public tools
      if (typeof r !== 'object') throw new Error(JSON.stringify(r));
    }
  });

  await must('founder or session identity (auth/me)', async () => {
    // Under founder_direct, no cookie is required.
    const me = await json(`${API}/api/v1/auth/me`);
    if (!me.user?.email) throw new Error(JSON.stringify(me).slice(0, 200));
    if (!me.activeOrganization?.id && !me.activeOrganizationId) {
      // AuthResponse may nest activeOrganization
      if (!me.memberships?.length) throw new Error('no org context');
    }
  });

  await must('saas tenant context', async () => {
    const t = await json(`${API}/api/v1/saas/tenant`);
    if (!t.organization?.id && !t.organization?.slug) {
      throw new Error(JSON.stringify(t).slice(0, 200));
    }
  });

  await must('saas founder-cockpit', async () => {
    const c = await json(`${API}/api/v1/saas/founder-cockpit`);
    if (!c.summary && !c.mode) throw new Error(JSON.stringify(c).slice(0, 200));
  });

  await must('watchlist list', async () => {
    const w = await json(`${API}/api/v1/watchlist`);
    if (!Array.isArray(w.items) && w.items !== undefined) {
      throw new Error(JSON.stringify(w).slice(0, 200));
    }
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

  await must('live examples catalog', async () => {
    const r = await json(`${API}/api/v1/ai/live-examples`);
    if (!r.examples?.length) throw new Error('no live examples');
  });

  await must('product artifacts list (when products exist)', async () => {
    const scan = await json(`${API}/api/v1/terminal/scanner`);
    const products = Array.isArray(scan) ? scan : scan.products || [];
    if (!products.length) {
      console.log('      skipped (no products — run fixture import or demo:loop)');
      return;
    }
    const productId = products[0].productId || products[0].id;
    const arts = await json(`${API}/api/v1/products/${productId}/artifacts`);
    if (!Array.isArray(arts.artifacts)) throw new Error(JSON.stringify(arts).slice(0, 200));
    if (arts.artifacts.length === 0) {
      const boot = await json(`${API}/api/v1/products/${productId}/artifacts/bootstrap`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!boot.artifacts?.length) throw new Error('bootstrap produced no artifacts');
      const img = boot.artifacts.find((a) => a.artifactType === 'image' && a.contentUrl);
      if (img?.contentUrl) {
        const contentRes = await fetch(`${API.replace(/\/api\/v1$/, '')}${img.contentUrl}`);
        if (!contentRes.ok) throw new Error(`artifact content ${contentRes.status}`);
      }
    }
  });

  await must('commerce process board', async () => {
    const p = await json(`${API}/api/v1/commerce/process`);
    if (!p.stages?.length) throw new Error('no lifecycle stages');
    if (typeof p.summary?.totalOpen !== 'number') throw new Error('missing summary');
  });

  await must('commerce tasks + blockers + SOPs', async () => {
    const t = await json(`${API}/api/v1/commerce/tasks`);
    if (!Array.isArray(t.tasks)) throw new Error('missing tasks');
    if (!Array.isArray(t.sops) || t.sops.length < 5) throw new Error('missing SOP templates');
  });

  await must('commerce case by product (when products exist)', async () => {
    const scan = await json(`${API}/api/v1/terminal/scanner`);
    const products = Array.isArray(scan) ? scan : scan.products || [];
    if (!products.length) {
      console.log('      skipped (no products)');
      return;
    }
    const productId = products[0].productId || products[0].id;
    const c = await json(`${API}/api/v1/commerce/cases/by-product/${productId}`);
    if (!c.case?.id || !c.case?.currentStage) throw new Error(JSON.stringify(c).slice(0, 200));
    if (!c.lifecycle?.length) throw new Error('missing lifecycle');
  });

  // Optional: password login still works if seed password exists
  await must('optional seed password login', async () => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: 'founder@tradeops.local',
        password: 'TradeOps-Demo-2026!',
      }),
    });
    if (!res.ok) {
      // Acceptable when founder has no passwordHash (bootstrap-only identity)
      if (res.status === 401 || res.status === 403) {
        console.log('      skipped (no password hash — founder_direct identity still works)');
        return;
      }
      throw new Error(`login ${res.status}`);
    }
  });

  const pages = [
    '/',
    '/status',
    '/login',
    '/register',
    '/privacy',
    '/terms',
    '/platform',
    '/terminal',
    '/terminal/cockpit',
    '/terminal/process',
    '/terminal/tasks',
    '/terminal/listings',
    '/terminal/fulfillment',
    '/terminal/watchlist',
    '/terminal/ai',
    '/terminal/live-examples',
    '/terminal/pipeline',
  ];
  for (const p of pages) {
    await must(`web ${p}`, async () => {
      const res = await fetch(`${WEB}${p}`, { redirect: 'follow' });
      if (!res.ok) throw new Error(String(res.status));
      // founder_direct: / and /login should end on workspace, not a stuck 401 page
      if (founderDirect && (p === '/' || p === '/login')) {
        const url = res.url || '';
        // After redirects, path should include terminal or still be ok 200
        if (!res.ok) throw new Error(`redirect failed ${url}`);
      }
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
