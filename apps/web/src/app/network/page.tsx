import type { Metadata } from 'next';
import Link from 'next/link';
import { noIndexMeta } from '../../lib/seo';
import { terminalGet } from '../../lib/terminal-api';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Commerce Network',
};

type NetworkStatus = {
  productMode: string;
  catalog: {
    positioning: {
      product: string;
      not: string[];
      language: { preferred: string[]; avoid: string[] };
    };
    rails: Array<{ id: string; description: string }>;
    honesty: { note: string };
  };
  hardBlocks: {
    pooledInvestmentEnabled: boolean;
    guaranteedReturnsEnabled: boolean;
    internalCustodyEnabled: boolean;
  };
  honesty: { note: string; balanceSourceOfTruth: string };
};

export default async function NetworkHomePage() {
  const result = await terminalGet<NetworkStatus>('/api/v1/network/status');

  if (!result.ok) {
    return (
      <section className="hero">
        <h1>Commerce Network</h1>
        <p className="form-error">{result.error}</p>
      </section>
    );
  }

  const s = result.data;

  return (
    <section className="hero">
      <div className="app-header">
        <div>
          <p className="pill">Optional capital modules · sandbox / deferred</p>
          <h1>Capital architecture (not primary product)</h1>
          <p className="lede">
            TradeOps&apos;s primary product is an <strong>AI Commerce Operating System</strong>: SaaS
            intelligence and execution. Merchants own stores and payment processors. This area is
            reserved for optional future capital modules (mode <code>{s.productMode}</code>)—not
            investment management or fund custody.
          </p>
        </div>
        <div className="app-actions">
          <Link className="btn primary" href="/network/portfolio">
            Portfolio
          </Link>
          <Link className="btn secondary" href="/network/capital">
            Operating capital
          </Link>
          <Link className="btn ghost" href="/app/billing">
            SaaS billing
          </Link>
        </div>
      </div>

      <article className="card">
        <h2>Boundary</h2>
        <p className="meta">{s.honesty.note}</p>
        <p className="meta">{s.honesty.balanceSourceOfTruth}</p>
        <p>
          Hard blocks — pooled:{' '}
          <strong>{s.hardBlocks.pooledInvestmentEnabled ? 'ON' : 'OFF'}</strong> · guaranteed
          returns: <strong>{s.hardBlocks.guaranteedReturnsEnabled ? 'ON' : 'OFF'}</strong> ·
          internal custody: <strong>{s.hardBlocks.internalCustodyEnabled ? 'ON' : 'OFF'}</strong>
        </p>
        <ul>
          {s.catalog.positioning.not.map((n) => (
            <li key={n}>Not: {n}</li>
          ))}
        </ul>
      </article>

      <h2 style={{ marginTop: 24 }}>Financial rails</h2>
      <div className="grid">
        {s.catalog.rails.map((r) => (
          <article className="card" key={r.id}>
            <h3>
              <code>{r.id}</code>
            </h3>
            <p>{r.description}</p>
          </article>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>Workspace</h2>
      <ul>
        <li>
          <Link href="/network/portfolio">Portfolio</Link>
        </li>
        <li>
          <Link href="/network/capital">Capital &amp; mandate</Link>
        </li>
        <li>
          <Link href="/network/allocations">Allocations</Link>
        </li>
        <li>
          <Link href="/network/performance">Performance</Link>
        </li>
        <li>
          <Link href="/network/payouts">Payouts</Link>
        </li>
        <li>
          <Link href="/capital">Campaign capital (sandbox / gated)</Link>
        </li>
      </ul>

      <p className="meta" style={{ marginTop: 16 }}>
        Preferred terms: {s.catalog.positioning.language.preferred.join(', ')}. Avoid:{' '}
        {s.catalog.positioning.language.avoid.join(', ')}.
      </p>
    </section>
  );
}
