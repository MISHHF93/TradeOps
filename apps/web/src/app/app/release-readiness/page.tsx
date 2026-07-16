import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge, type CapStatus } from '../../../components/status-badge';
import { noIndexMeta } from '../../../lib/seo';
import { getApiBaseUrl } from '../../../lib/api';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Release readiness',
};

type Cap = { id: string; name: string; status: CapStatus; description: string };

export default async function ReleaseReadinessPage() {
  let caps: Cap[] = [];
  let health: { status?: string } = {};
  try {
    const [cRes, hRes] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/v1/public/capabilities`, { cache: 'no-store' }),
      fetch(`${getApiBaseUrl()}/api/v1/health`, { cache: 'no-store' }),
    ]);
    if (cRes.ok) {
      const body = (await cRes.json()) as { entries?: Cap[] };
      caps = body.entries ?? [];
    }
    if (hRes.ok) health = (await hRes.json()) as { status?: string };
  } catch {
    /* show empty */
  }

  const criticalOpen = caps.filter((c) =>
    ['connector.shopify', 'connector.amazon', 'app.billing'].includes(c.id),
  );

  return (
    <section className="hero">
      <p className="pill">Internal · noindex</p>
      <h1>Release readiness</h1>
      <p className="lede">
        Do not mark public multichannel live launch ready while critical credential/product gaps
        remain. Version 0.1.0 · API health: <strong>{health.status ?? 'unknown'}</strong>
      </p>
      <div className="grid">
        <article className="card">
          <h2>Build</h2>
          <p>
            <StatusBadge status="operational" /> production Next + API tsc verified in CI path
          </p>
        </article>
        <article className="card">
          <h2>Auth</h2>
          <p>
            <StatusBadge status="operational" /> register/login sessions · rate limited
          </p>
          <p className="meta">Email verify: not built (blocker for broad launch)</p>
        </article>
        <article className="card">
          <h2>AI</h2>
          <p>
            <StatusBadge status="approval_controlled" /> operator + critic/auditor
          </p>
        </article>
        <article className="card">
          <h2>Live connectors</h2>
          <p>
            <StatusBadge status="credential_blocked" /> Shopify/Amazon/eBay/Google live
          </p>
        </article>
      </div>
      <h2>Capability feed</h2>
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Capability</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {caps.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.name}</strong>
                <div className="meta">{c.description}</div>
              </td>
              <td>
                <StatusBadge status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta" style={{ marginTop: 16 }}>
        Outstanding high-level blockers: {criticalOpen.map((c) => c.name).join(', ') || 'see audit'}.{' '}
        <Link href="/status">Public status</Link> ·{' '}
        <Link href="/docs">Docs</Link>
      </p>
    </section>
  );
}
