'use client';

import { FormEvent, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

type ToolResult = { ok: boolean; result?: unknown; error?: string; disclaimer?: string };

async function postTool(path: string, body: Record<string, unknown>): Promise<ToolResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return (await res.json()) as ToolResult;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Request failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

function formatMoney(minor: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ProfitResult({ result }: { result: Record<string, unknown> }) {
  const currency = String(result.currency ?? 'USD');
  const profit = Number(result.contributionProfitMinor ?? 0);
  const marginBps = Number(result.netMarginBps ?? 0);
  const revenue = Number(result.revenueMinor ?? 0);
  const cash = Number(result.cashRequiredBeforePayoutMinor ?? 0);
  const positive = profit >= 0;

  return (
    <div className="tool-summary">
      <div className="tool-hero-metric">
        <span className="meta">Contribution profit</span>
        <strong className={positive ? 'signal-BUY' : 'signal-EXIT'} style={{ fontSize: '1.6rem' }}>
          {formatMoney(profit, currency)}
        </strong>
        <span className="meta">
          Margin {(marginBps / 100).toFixed(1)}% · Revenue {formatMoney(revenue, currency)} · Cash before
          payout {formatMoney(cash, currency)}
        </span>
      </div>
      <ul className="kv">
        <li>
          <span>COGS</span>
          <strong>{formatMoney(Number(result.cogsMinor ?? 0), currency)}</strong>
        </li>
        <li>
          <span>Fees</span>
          <strong>{formatMoney(Number(result.feesMinor ?? 0), currency)}</strong>
        </li>
        <li>
          <span>Logistics</span>
          <strong>{formatMoney(Number(result.logisticsMinor ?? 0), currency)}</strong>
        </li>
        <li>
          <span>Marketing</span>
          <strong>{formatMoney(Number(result.marketingMinor ?? 0), currency)}</strong>
        </li>
        <li>
          <span>Reserves / refunds</span>
          <strong>{formatMoney(Number(result.reservesAndRefundsMinor ?? 0), currency)}</strong>
        </li>
      </ul>
    </div>
  );
}

function ScoreResult({ result }: { result: Record<string, unknown> }) {
  const score = Number(result.score ?? 0);
  const explanation = String(result.explanation ?? '');
  const components = Array.isArray(result.components) ? result.components : [];

  return (
    <div className="tool-summary">
      <div className="tool-hero-metric">
        <span className="meta">Opportunity score</span>
        <strong style={{ fontSize: '1.6rem' }}>{score}/100</strong>
        <p className="meta" style={{ marginTop: 8 }}>
          {explanation}
        </p>
      </div>
      <ul className="kv">
        {components.slice(0, 8).map((c) => {
          if (!isRecord(c)) return null;
          return (
            <li key={String(c.key)}>
              <span>{String(c.label ?? c.key)}</span>
              <strong>
                {Number(c.raw)} · w{Number(c.weight)}
              </strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PolicyResult({ result }: { result: Record<string, unknown> }) {
  const outcome = String(result.outcome ?? 'unknown');
  const reasons = Array.isArray(result.reasons) ? result.reasons.map(String) : [];
  const flags = Array.isArray(result.riskFlags) ? result.riskFlags.map(String) : [];
  const blocked = outcome === 'blocked';
  const review = outcome === 'manual_review';

  return (
    <div className="tool-summary">
      <div className="tool-hero-metric">
        <span className="meta">Policy outcome</span>
        <strong
          className={blocked ? 'signal-BLOCKED' : review ? 'signal-HOLD' : 'signal-BUY'}
          style={{ fontSize: '1.4rem', textTransform: 'uppercase' }}
        >
          {outcome.replaceAll('_', ' ')}
        </strong>
        {flags.length > 0 ? (
          <p className="meta" style={{ marginTop: 8 }}>
            Flags: {flags.join(', ')}
          </p>
        ) : null}
      </div>
      <ul className="kv">
        {reasons.map((r) => (
          <li key={r}>
            <span>Reason</span>
            <strong style={{ textAlign: 'right', maxWidth: '70%' }}>{r}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultPanel({
  data,
  kind,
}: {
  data: ToolResult | null;
  kind: 'profit' | 'score' | 'policy';
}) {
  if (!data) return null;
  if (!data.ok) {
    return <p className="form-error">{data.error ?? 'Failed'}</p>;
  }
  const result = isRecord(data.result) ? data.result : null;
  return (
    <article className="card" style={{ marginTop: 16 }}>
      <h3>Result</h3>
      {result && kind === 'profit' ? <ProfitResult result={result} /> : null}
      {result && kind === 'score' ? <ScoreResult result={result} /> : null}
      {result && kind === 'policy' ? <PolicyResult result={result} /> : null}
      {!result ? <pre className="tool-result">{JSON.stringify(data.result, null, 2)}</pre> : null}
      {data.disclaimer ? <p className="meta">{data.disclaimer}</p> : null}
      <details style={{ marginTop: 12 }}>
        <summary className="meta" style={{ cursor: 'pointer' }}>
          Raw JSON
        </summary>
        <pre className="tool-result">{JSON.stringify(data.result, null, 2)}</pre>
      </details>
    </article>
  );
}

export function ProfitTool() {
  const [data, setData] = useState<ToolResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      sellingPriceMinor: Math.round(Number(fd.get('price')) * 100),
      marketplaceFeeMinor: Math.round(Number(fd.get('mktFee')) * 100),
      paymentFeeMinor: Math.round(Number(fd.get('payFee')) * 100),
      supplierCostMinor: Math.round(Number(fd.get('cost')) * 100),
      shippingCostMinor: Math.round(Number(fd.get('ship')) * 100),
      advertisingAllocationMinor: Math.round(Number(fd.get('ads')) * 100),
      returnReserveMinor: Math.round(Number(fd.get('returns')) * 100),
      currency: String(fd.get('currency') || 'USD'),
      units: Number(fd.get('units') || 1),
    };
    setData(await postTool('/api/v1/public/tools/unit-economics', body));
    setBusy(false);
  }

  return (
    <>
      <form className="card tool-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Selling price (major units)
          <input name="price" type="number" step="0.01" defaultValue={49.99} required />
        </label>
        <label>
          Marketplace fee
          <input name="mktFee" type="number" step="0.01" defaultValue={7.5} />
        </label>
        <label>
          Payment fee
          <input name="payFee" type="number" step="0.01" defaultValue={1.75} />
        </label>
        <label>
          Supplier cost
          <input name="cost" type="number" step="0.01" defaultValue={18} />
        </label>
        <label>
          Shipping cost
          <input name="ship" type="number" step="0.01" defaultValue={4.5} />
        </label>
        <label>
          Ad allocation
          <input name="ads" type="number" step="0.01" defaultValue={3} />
        </label>
        <label>
          Return reserve
          <input name="returns" type="number" step="0.01" defaultValue={1} />
        </label>
        <label>
          Units
          <input name="units" type="number" min={1} step={1} defaultValue={1} />
        </label>
        <label>
          Currency
          <input name="currency" defaultValue="USD" />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Calculating…' : 'Calculate contribution profit'}
        </button>
      </form>
      <ResultPanel data={data} kind="profit" />
    </>
  );
}

export function ScoreTool() {
  const [data, setData] = useState<ToolResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const keys = [
      'demandPotential',
      'trendMomentum',
      'netMarginPotential',
      'supplierQuality',
      'shippingReliability',
      'reviewHealth',
      'competition',
      'returnRisk',
      'policyRisk',
      'capitalRequirement',
      'dataConfidence',
    ] as const;
    const body: Record<string, number> = {};
    for (const k of keys) {
      body[k] = Number(fd.get(k) ?? 50);
    }
    setData(await postTool('/api/v1/public/tools/opportunity-score', body));
    setBusy(false);
  }

  const fields: Array<[string, string, number]> = [
    ['demandPotential', 'Demand potential', 60],
    ['trendMomentum', 'Trend momentum', 55],
    ['netMarginPotential', 'Net margin potential', 65],
    ['supplierQuality', 'Supplier quality', 70],
    ['shippingReliability', 'Shipping reliability', 70],
    ['reviewHealth', 'Review health', 75],
    ['competition', 'Competition (higher = worse)', 45],
    ['returnRisk', 'Return risk', 30],
    ['policyRisk', 'Policy risk', 15],
    ['capitalRequirement', 'Capital requirement', 40],
    ['dataConfidence', 'Data confidence', 80],
  ];

  return (
    <>
      <form className="card tool-form" onSubmit={(e) => void onSubmit(e)}>
        {fields.map(([name, label, def]) => (
          <label key={name}>
            {label} (0–100)
            <input name={name} type="number" min={0} max={100} defaultValue={def} />
          </label>
        ))}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Scoring…' : 'Calculate opportunity score'}
        </button>
      </form>
      <ResultPanel data={data} kind="score" />
    </>
  );
}

export function PolicyTool() {
  const [data, setData] = useState<ToolResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    setData(
      await postTool('/api/v1/public/tools/policy-check', {
        title: String(fd.get('title') ?? ''),
        description: String(fd.get('description') ?? ''),
        category: String(fd.get('category') ?? ''),
      }),
    );
    setBusy(false);
  }

  return (
    <>
      <form className="card tool-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Title
          <input name="title" defaultValue="Insulated Stainless Water Bottle 32oz" required />
        </label>
        <label>
          Description
          <textarea name="description" rows={3} defaultValue="BPA-free travel bottle" />
        </label>
        <label>
          Category
          <input name="category" defaultValue="Home & Kitchen" />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Run policy check'}
        </button>
      </form>
      <ResultPanel data={data} kind="policy" />
    </>
  );
}
