#!/usr/bin/env node
/**
 * Production commerce loop — Phase A (tools) + Phase B (generative).
 *
 * NOT the fixture demo-loop. Drives the real operator path against a running API:
 *   readiness → connectors honesty → process sync →
 *   AI operator forceShadow=false (Phase A tools + Phase B synthesis) →
 *   process re-sync → production readiness report
 *
 * Modes (honest):
 *   development     — production-compatible paths; sandbox / fixture-labeled data OK
 *   controlled_live — only when TRADEOPS_CONTROLLED_LIVE=1 AND live commerce connectors healthy
 *   automated_live  — never auto-entered by this script
 *
 * Usage:
 *   pnpm production:loop
 *   node scripts/production-commerce-loop.mjs
 *   API_PUBLIC_URL=http://127.0.0.1:4000 node scripts/production-commerce-loop.mjs
 *
 * Optional env:
 *   PRODUCTION_LOOP_OBJECTIVE  — override operator objective
 *   PRODUCTION_LOOP_SKIP_AI=1  — skip operator run (wiring check only)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv();

function line(msg) {
  console.log(msg);
}

function section(title) {
  line('');
  line(`══ ${title} ══`);
}

async function api(method, path, body) {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 400) };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

function mask(v) {
  if (!v || !String(v).trim()) return 'missing';
  return `set (len=${String(v).trim().length})`;
}

function timelineLines(timeline, pred, limit = 12) {
  const rows = (timeline ?? []).filter(pred);
  return rows.slice(-limit);
}

async function main() {
  line(`TradeOps PRODUCTION commerce loop → ${base}`);
  line('Path: Phase A (deterministic tools) + Phase B (generative synthesis).');
  line('Not fixture demo-loop. forceShadow=false. Honest blockers only.');

  // ── 1. Preflight ─────────────────────────────────────────────
  section('1. Preflight');
  const health = await api('GET', '/health');
  if (!health.ok) {
    throw new Error(`API health failed HTTP ${health.status}. Start API + DB first.`);
  }
  const deps = health.data?.dependencies ?? [];
  const pg = deps.find((d) => d.name === 'postgres');
  const redis = deps.find((d) => d.name === 'redis');
  line(`API status=${health.data?.status} postgres=${pg?.status ?? '?'} redis=${redis?.status ?? 'optional'}`);
  if (pg?.status !== 'up') {
    throw new Error('Postgres is not up — production loop requires a healthy database.');
  }

  line(`COHERE_API_KEY: ${mask(process.env.COHERE_API_KEY || process.env.CO_API_KEY)}`);
  line(`XAI_API_KEY:    ${mask(process.env.XAI_API_KEY)}`);
  line(`TAVILY_API_KEY: ${mask(process.env.TAVILY_API_KEY)}`);
  line(`SHOPIFY_TOKEN:  ${mask(process.env.SHOPIFY_ACCESS_TOKEN)}`);
  line(`SHOPIFY_DOMAIN: ${mask(process.env.SHOPIFY_SHOP_DOMAIN)}`);
  line(`TRADEOPS_FORCE_FIXTURE=${process.env.TRADEOPS_FORCE_FIXTURE ?? '0'}`);
  line(`TRADEOPS_SIMULATION_MODE=${process.env.TRADEOPS_SIMULATION_MODE ?? '0'}`);
  line(`TRADEOPS_CONTROLLED_LIVE=${process.env.TRADEOPS_CONTROLLED_LIVE ?? '0'}`);
  line(`TRADEOPS_ACCESS_MODE=${process.env.TRADEOPS_ACCESS_MODE ?? '(unset)'}`);

  if (process.env.TRADEOPS_FORCE_FIXTURE === '1') {
    throw new Error('TRADEOPS_FORCE_FIXTURE=1 — refuse production loop. Unset for production path.');
  }

  // ── 2. Generative AI readiness (Phase B prerequisite) ───────
  section('2. Generative AI readiness (Phase B)');
  const runtime = await api('GET', '/ai/runtime');
  if (!runtime.ok) throw new Error(`AI runtime HTTP ${runtime.status}`);
  const providers = runtime.data?.providers ?? [];
  for (const p of providers) {
    line(`  ${p.id}: configured=${p.configured} active=${p.active} (${p.role})`);
  }
  const webSearch = runtime.data?.webSearch ?? [];
  for (const w of webSearch) {
    line(`  web:${w.id}: configured=${w.configured} active=${w.active}`);
  }
  const activeGen = providers.find((p) => p.active && p.id !== 'none');
  if (!activeGen || activeGen.id !== 'cohere') {
    line('  WARN: Cohere not active — Phase B will use tool-ranked summaries only.');
    line('  Fix: set COHERE_API_KEY, then restart API. (XAI is not used for operator Phase B.)');
  } else {
    line(`  Active generative for Phase B: cohere (sole provider)`);
  }

  // ── 3. Connectors honesty ────────────────────────────────────
  section('3. Connectors (production honesty)');
  const conn = await api('GET', '/connectors');
  const rows = Array.isArray(conn.data) ? conn.data : conn.data?.connectors ?? [];
  let liveOk = 0;
  let fixture = 0;
  let needCreds = 0;
  /** Commerce-facing families only — observability "connected" must not count as live store */
  const commerceFamilies = new Set([
    'marketplace',
    'commerce',
    'payments',
    'shipping',
    'supplier',
    'store',
    'logistics',
    'channel',
  ]);
  for (const c of rows) {
    const isFix = Boolean(c.isFixture);
    const st = String(c.status ?? '');
    const family = String(c.family ?? '').toLowerCase();
    const key = String(c.providerKey ?? '').toLowerCase();
    const isCommerce =
      commerceFamilies.has(family) ||
      /shopify|amazon|ebay|woocommerce|supplier|stripe|easypost|marketplace/.test(key);
    if (isFix) fixture += 1;
    else if (isCommerce && (st === 'connected' || st.includes('sync'))) liveOk += 1;
    else if (isCommerce) needCreds += 1;
    else if (!isFix && st !== 'connected') needCreds += 1;
    line(
      `  ${c.providerKey}: ${st}${isFix ? ' [FIXTURE]' : ''}${!isCommerce && st === 'connected' ? ' [non-commerce]' : ''}${c.lastError ? ` — ${String(c.lastError).slice(0, 80)}` : ''}`,
    );
  }
  line(`Summary: live_commerce_healthy=${liveOk} fixture=${fixture} need_credentials=${needCreds}`);

  const controlledEnabled = process.env.TRADEOPS_CONTROLLED_LIVE === '1';
  const expectedMode =
    controlledEnabled && liveOk > 0
      ? 'controlled_live'
      : 'development';
  line(`Expected operator loop mode: ${expectedMode}`);
  if (controlledEnabled && liveOk === 0) {
    line(
      '  WARN: TRADEOPS_CONTROLLED_LIVE=1 but no live connectors healthy — will not escalate to controlled_live.',
    );
  }

  // ── 4. Process sync ──────────────────────────────────────────
  section('4. Commerce process sync (pre-run)');
  const sync = await api('POST', '/commerce/process/sync', {});
  if (!sync.ok) {
    line(`  WARN process sync HTTP ${sync.status}: ${JSON.stringify(sync.data)?.slice(0, 200)}`);
  } else {
    line(`  Sync ok: ${JSON.stringify(sync.data)?.slice(0, 280)}`);
  }

  const processBoard = await api('GET', '/commerce/process');
  if (processBoard.ok) {
    if (processBoard.data?.summary) {
      const s = processBoard.data.summary;
      line(
        `  Cases open=${s.totalOpen ?? s.open ?? '?'} blocked=${s.blocked ?? '?'} waiting=${s.waiting ?? '?'} approvals=${s.awaitingApproval ?? '?'}`,
      );
    } else {
      line(`  Process board loaded (${Object.keys(processBoard.data ?? {}).join(', ')})`);
    }
  }

  // ── 5. Production operator — Phase A + Phase B ───────────────
  section('5. AI operator — Phase A tools + Phase B synthesis');
  let runData = null;
  let phaseAOk = false;
  let phaseBOk = false;
  let phaseBBlocked = false;

  if (process.env.PRODUCTION_LOOP_SKIP_AI === '1') {
    line('  Skipped (PRODUCTION_LOOP_SKIP_AI=1)');
  } else {
    const objective =
      process.env.PRODUCTION_LOOP_OBJECTIVE?.trim() ||
      'Production evaluation: rank store products by contribution margin and policy risk; recommend production-safe next actions only. Prefer prepare listing draft when qualified. Do not publish; human approval remains required for any live marketplace action.';

    line(`  Objective: ${objective.slice(0, 180)}${objective.length > 180 ? '…' : ''}`);
    line('  POST /ai/operator/run  forceShadow=false  (production path)');

    const run = await api('POST', '/ai/operator/run', {
      objective,
      forceShadow: false,
    });

    if (!run.ok) {
      throw new Error(
        `Operator run failed HTTP ${run.status}: ${JSON.stringify(run.data)?.slice(0, 500)}`,
      );
    }

    runData = run.data;
    const d = runData;
    line(`  status=${d.status} loopMode=${d.loopMode} decision=${d.decision}`);
    line(`  objectiveType=${d.objectiveType} riskClass=${d.riskClass}`);
    line(`  runId=${d.runId}`);
    line(`  recs=${d.recommendations?.length ?? 0}`);
    if (d.recommendations?.[0]) {
      line(`  top=${d.recommendations[0].title}`);
    }
    if (d.candidateStats) {
      const cs = d.candidateStats;
      line(
        `  candidates retrieved=${cs.retrieved ?? '?'} normalized=${cs.normalized ?? '?'} ranked=${cs.ranked ?? d.recommendations?.length ?? '?'}`,
      );
    }

    // ── Phase A report ──
    section('5a. Phase A — deterministic tool ranking');
    const tl = d.timeline ?? [];
    const phaseASteps = timelineLines(
      tl,
      (t) =>
        /Phase A|Connector|Product candidates|normalized|evaluated|ranked|Recommendations completed|tool ranking|Public web research|Validating connected/i.test(
          String(t.step ?? ''),
        ),
    );
    if (phaseASteps.length === 0) {
      line('  (no Phase A timeline steps — older API binary?)');
    } else {
      for (const t of phaseASteps) {
        line(
          `  [${t.status}] ${t.step}${t.detail ? ` — ${String(t.detail).slice(0, 140)}` : ''}`,
        );
      }
    }
    const toolCount = Array.isArray(d.toolTrace)
      ? d.toolTrace.length
      : Array.isArray(d.tools)
        ? d.tools.length
        : null;
    if (toolCount != null) line(`  toolTrace count=${toolCount}`);
    phaseAOk =
      (d.recommendations?.length ?? 0) > 0 ||
      tl.some((t) => /Phase A complete|Recommendations completed|Candidates ranked/i.test(t.step));
    line(phaseAOk ? '  Phase A: OK (tools + ranking ran)' : '  Phase A: WEAK (no recs / timeline sparse)');

    // ── Phase B report ──
    section('5b. Phase B — generative synthesis');
    const phaseBSteps = timelineLines(
      tl,
      (t) => /Phase B|synthesis|Synthesiz/i.test(String(t.step ?? '') + String(t.detail ?? '')),
    );
    for (const t of phaseBSteps) {
      line(
        `  [${t.status}] ${t.step}${t.detail ? ` — ${String(t.detail).slice(0, 180)}` : ''}`,
      );
    }
    const synthProg = (d.liveProgress ?? []).find((p) =>
      /Synthesis|synthesiz|Phase B/i.test(String(p.step ?? '') + String(p.detail ?? '')),
    );
    if (synthProg) {
      line(
        `  progress: ${synthProg.step}${synthProg.detail ? ` — ${String(synthProg.detail).slice(0, 160)}` : ''}`,
      );
    }

    const summary = String(d.responseSummary || d.decisionNote || '');
    const tlBlob = JSON.stringify(tl);
    phaseBOk =
      (d.briefingSource === 'cohere' ||
        tl.some(
          (t) =>
            /Phase B/i.test(String(t.step)) && /provider=cohere/i.test(String(t.detail ?? '')),
        )) &&
      !/No fixed narrative was substituted|Generative briefing unavailable/i.test(summary);
    const usedXai =
      /provider=xai|xAI chat HTTP|console\.x\.ai/i.test(summary + tlBlob);
    const fixedLeak =
      /I evaluated \d+ supplier products|Strongest opportunity:|Tool evidence \(deterministic\)|Recommended next action: Compare suppliers/i.test(
        summary,
      );
    phaseBBlocked =
      d.briefingSource === 'blocked' ||
      /Generative briefing unavailable|No fixed narrative was substituted|COHERE_API_KEY/i.test(
        summary + tlBlob,
      ) ||
      usedXai ||
      fixedLeak;

    line(`  briefingSource=${d.briefingSource ?? '?'}`);
    if (fixedLeak) {
      line('  Phase B: POLICY ERROR — fixed product essay leaked into responseSummary');
    } else if (usedXai) {
      line('  Phase B: POLICY ERROR — xAI was used; operator must be Cohere-only. Rebuild/restart API.');
    } else if (phaseBOk && !phaseBBlocked) {
      line('  Phase B: OK — Cohere narrative only (no fixed template appendix)');
      line(`  briefing preview: ${summary.slice(0, 220).replace(/\n/g, ' ')}…`);
    } else if (phaseBBlocked) {
      line('  Phase B: BLOCKED honestly — no fixed essay substituted');
      line('  → Set COHERE_API_KEY, restart API, re-run pnpm production:loop');
      line(`  preview: ${summary.slice(0, 200).replace(/\n/g, ' ')}`);
    } else if (phaseBSteps.length === 0) {
      line('  Phase B: NOT OBSERVED in timeline (API may predate Phase B wiring)');
    } else {
      line('  Phase B: attempted — check timeline details above');
    }

    line(`  results: ${d.resultsPath ?? `/terminal/opportunities?runId=${d.runId}`}`);
    line(`  process: ${d.processPath ?? '/terminal/process'}`);
  }

  // ── 6. Second sync after operator ────────────────────────────
  section('6. Post-run process sync');
  const sync2 = await api('POST', '/commerce/process/sync', {});
  line(sync2.ok ? '  Sync ok' : `  WARN sync HTTP ${sync2.status}`);
  const board2 = await api('GET', '/commerce/process');
  if (board2.ok?.valueOf?.() !== false && board2.ok) {
    if (board2.data?.summary) {
      const s = board2.data.summary;
      line(
        `  Cases open=${s.totalOpen ?? s.open ?? '?'} blocked=${s.blocked ?? '?'} waiting=${s.waiting ?? '?'} approvals=${s.awaitingApproval ?? '?'}`,
      );
    }
    const cases = board2.data?.cases;
    if (Array.isArray(cases) && cases.length) {
      line(`  Latest cases (up to 5):`);
      for (const c of cases.slice(0, 5)) {
        line(
          `    • ${c.title ?? c.productTitle ?? c.id ?? '?'}  stage=${c.stage ?? c.status ?? '?'}  next=${c.nextAction ?? c.recommendedAction ?? '—'}`,
        );
      }
    }
  }

  // ── 7. Production readiness report ───────────────────────────
  section('7. Production readiness');
  const blockers = [];
  if (!activeGen || activeGen.id !== 'cohere') {
    blockers.push('Cohere not active — set COHERE_API_KEY (sole generative provider; XAI ignored)');
  }
  if (phaseBBlocked) {
    blockers.push('Phase B generative blocked on last run (missing/invalid COHERE_API_KEY)');
  }
  if (liveOk === 0) {
    blockers.push('No live commerce connectors — catalog is fixture-capable only (do not label live)');
  }
  if (fixture > 0) {
    blockers.push(`${fixture} FIXTURE connector(s) installed — never label as live marketplace truth`);
  }
  if (!process.env.TAVILY_API_KEY?.trim()) {
    blockers.push('TAVILY_API_KEY missing — public web research blocked');
  }
  if (
    !process.env.SHOPIFY_ACCESS_TOKEN?.trim() ||
    !process.env.SHOPIFY_SHOP_DOMAIN?.trim()
  ) {
    blockers.push('Shopify credentials missing — live catalog sync unavailable');
  }
  if (process.env.TRADEOPS_ACCESS_MODE === 'founder_direct') {
    blockers.push('TRADEOPS_ACCESS_MODE=founder_direct — not multi-tenant SaaS production auth');
  }
  if (controlledEnabled && liveOk === 0) {
    blockers.push('CONTROLLED_LIVE requested but no healthy live connectors');
  }

  line(`  Phase A tools:     ${phaseAOk ? 'PASS' : process.env.PRODUCTION_LOOP_SKIP_AI === '1' ? 'SKIPPED' : 'CHECK'}`);
  line(
    `  Phase B generative: ${
      process.env.PRODUCTION_LOOP_SKIP_AI === '1'
        ? 'SKIPPED'
        : phaseBOk && !phaseBBlocked
          ? 'PASS'
          : phaseBBlocked
            ? 'BLOCKED'
            : 'CHECK'
    }`,
  );
  line(`  Loop mode (run):   ${runData?.loopMode ?? expectedMode}`);
  line(`  forceShadow:       false (production path)`);

  if (blockers.length === 0) {
    line('  READY for controlled_live evaluation (human approval still required for publish/PO).');
  } else {
    line('  BLOCKERS before full multi-tenant / controlled_live production:');
    for (const b of blockers) line(`   • ${b}`);
  }

  line('');
  line('Open:');
  line('  http://localhost:3000/terminal/process');
  line('  http://localhost:3000/terminal/ai');
  line('  http://localhost:3000/terminal/opportunities');
  if (runData?.runId) {
    line(`  http://localhost:3000/terminal/opportunities?runId=${runData.runId}`);
  }
  line('');
  line('Done — production-compatible Phase A + Phase B path exercised (not demo-loop).');

  // Non-zero exit only on hard failure; Phase B blocked is reported but still exit 0
  // so CI/local can continue process verification. Hard failures already threw above.
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
