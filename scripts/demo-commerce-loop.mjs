#!/usr/bin/env node
/**
 * Fixture/demo commerce vertical slice (paper path).
 * For production-compatible operator + process path use instead:
 *   pnpm production:loop
 *   node scripts/production-commerce-loop.mjs
 *
 *   node scripts/demo-commerce-loop.mjs
 *   API_PUBLIC_URL=http://127.0.0.1:4000 node scripts/demo-commerce-loop.mjs
 */
const base = (process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

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
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const msg =
      typeof data?.message === 'string'
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join('; ')
          : `HTTP ${res.status}`;
    throw new Error(`${method} ${path}: ${msg}`);
  }
  return data;
}

function line(msg) {
  console.log(msg);
}

async function main() {
  line(`TradeOps demo loop → ${base}`);
  line('POST /api/v1/terminal/demo-loop …');

  const result = await api('POST', '/terminal/demo-loop');
  line(
    `Product: ${result.product?.title} · ${result.product?.signal} · score=${result.product?.score}`,
  );
  line(
    `sim=${result.simulationId} listingCreated=${result.listingCreated} approvals=${result.approvalsDecided} orders=${result.ordersIngested} fulfill=${result.fulfillmentsCompleted}`,
  );
  line(
    `Evaluate: model=${result.evaluation?.modelVersion} n=${result.evaluation?.sampleSize} · ${result.evaluation?.recommendation}`,
  );
  line('Pipeline:');
  for (const s of result.pipeline?.stages ?? []) {
    line(`   ${String(s.id).padEnd(18)} ${String(s.status).padEnd(12)} count=${s.count}`);
  }
  line('Done. Open http://localhost:3000/terminal/pipeline');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
