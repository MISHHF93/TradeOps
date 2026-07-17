import type { Metadata } from 'next';
import Link from 'next/link';
import { noIndexMeta } from '../../lib/seo';
import { terminalGet } from '../../lib/terminal-api';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Commerce Capital',
};

type CapitalStatus = {
  product: string;
  writeMode: string;
  isLicensedInvestmentPortal: boolean;
  domains: Array<{ id: string; name: string; status: string; description: string }>;
  gates: Array<{
    key: string;
    enabled: boolean;
    category: string;
    description: string;
    legalNote: string;
  }>;
  honesty: {
    note: string;
    operationalNote: string;
    neverClaims: string[];
  };
};

/**
 * Commerce Capital Network home — honesty-first.
 * Not a public investment portal unless legal status is obtained.
 */
export default async function CapitalHomePage() {
  const result = await terminalGet<CapitalStatus>('/api/v1/capital/status');

  if (!result.ok) {
    return (
      <section className="hero">
        <h1>Commerce Capital</h1>
        <p className="form-error">{result.error}</p>
      </section>
    );
  }

  const s = result.data;

  return (
    <section className="hero">
      <div className="app-header">
        <div>
          <p className="pill">Deferred capital architecture · not primary product</p>
          <h1>Capital sandbox (optional modules)</h1>
          <p className="lede">
            TradeOps&apos;s primary product is an AI Commerce Operating System: subscribe, connect
            channels, discover and operate commerce. This capital area is gated architecture only—
            not investment management. Public solicitation, custody, and profit-sharing stay disabled.
          </p>
        </div>
        <div className="app-actions">
          <Link className="btn primary" href="/capital/campaigns">
            Campaigns (sandbox)
          </Link>
          <Link className="btn ghost" href="/app/billing">
            SaaS billing
          </Link>
          <Link className="btn ghost" href="/terminal/finance/payments">
            Channel payments
          </Link>
        </div>
      </div>

      <article className="card" style={{ borderColor: 'var(--accent, #3b82f6)' }}>
        <h2>Current mode: {s.writeMode}</h2>
        <p>
          Licensed investment portal: <strong>{s.isLicensedInvestmentPortal ? 'yes' : 'no'}</strong>
        </p>
        <p className="meta">{s.honesty.operationalNote}</p>
        <p className="meta">{s.honesty.note}</p>
        <ul>
          {s.honesty.neverClaims.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </article>

      <h2 style={{ marginTop: 24 }}>Financial domains (strict separation)</h2>
      <div className="grid">
        {s.domains.map((d) => (
          <article className="card" key={d.id}>
            <h3>{d.name}</h3>
            <p className="meta">
              Status: <code>{d.status}</code>
            </p>
            <p>{d.description}</p>
          </article>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>Regulatory feature gates</h2>
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Gate</th>
            <th>Enabled</th>
            <th>Category</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {s.gates.map((g) => (
            <tr key={g.key}>
              <td>
                <code>{g.key}</code>
              </td>
              <td>{g.enabled ? 'yes' : 'no'}</td>
              <td>{g.category}</td>
              <td>
                {g.description}
                <div className="meta">{g.legalNote}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid" style={{ marginTop: 24 }}>
        <article className="card">
          <h3>Capital provider workspace</h3>
          <ul>
            <li>
              <Link href="/capital/opportunities">Opportunities</Link> (disabled until public gate)
            </li>
            <li>
              <Link href="/capital/campaigns">Campaigns</Link>
            </li>
            <li>
              <Link href="/capital/portfolio">Portfolio</Link>
            </li>
            <li>
              <Link href="/capital/transactions">Transactions</Link>
            </li>
            <li>
              <Link href="/capital/distributions">Distributions</Link>
            </li>
            <li>
              <Link href="/capital/documents">Documents</Link>
            </li>
          </ul>
        </article>
        <article className="card">
          <h3>Related operational finance</h3>
          <p className="meta">These are not capital investments.</p>
          <ul>
            <li>
              <Link href="/app/billing">SaaS subscription billing</Link>
            </li>
            <li>
              <Link href="/terminal/finance/payments">Channel shopper payments</Link>
            </li>
            <li>
              <Link href="/terminal/finance/reconciliation">Payout reconciliation</Link>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
