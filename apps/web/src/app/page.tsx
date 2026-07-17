import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusBadge } from '../components/status-badge';
import { fetchApiHealth } from '../lib/api';
import { FOUNDER_WORKSPACE_PATH, isFounderDirectAccess } from '../lib/access-mode';

/**
 * Root route.
 * founder_direct → terminal command center immediately.
 * authenticated / multi_tenant → public marketing home.
 */
export default async function HomePage() {
  if (isFounderDirectAccess()) {
    redirect(FOUNDER_WORKSPACE_PATH);
  }

  const health = await fetchApiHealth();

  return (
    <section className="hero public-landing">
      <div>
        <p className="pill">AI Commerce Operating System</p>
        <h1>Run commerce better—above every channel</h1>
        <p className="lede">
          TradeOps is not another storefront. It is the intelligent layer above Shopify, Amazon,
          eBay, suppliers, and logistics: discover opportunities, automate operations, and measure
          real profitability—while you keep your stores and payment processors.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/register">
            Open TradeOps
          </Link>
          <Link className="btn ghost" href="/product">
            Six pillars
          </Link>
          <Link className="btn ghost" href="/tools">
            Free tools
          </Link>
        </div>
        <p className="meta" style={{ marginTop: 14 }}>
          Platform health:{' '}
          {health.ok ? (
            <StatusBadge
              status={health.data.status === 'up' ? 'operational' : 'credential_blocked'}
            />
          ) : (
            <span className="form-error">{health.error}</span>
          )}{' '}
          · See full honesty board on <Link href="/status">/status</Link>
        </p>
      </div>

      <div className="grid">
        <article className="card">
          <h2>Product intelligence</h2>
          <p>
            Contribution profit, opportunity scores, and fail-closed policy gates — revenue is never
            labeled as profit.
          </p>
          <p className="meta">
            <Link href="/tools">Free tools →</Link>
          </p>
        </article>
        <article className="card">
          <h2>AI operator</h2>
          <p>
            Natural-language objectives become typed tool plans with critic and auditor passes —
            consequential steps queue for approval.
          </p>
          <p className="meta">
            <StatusBadge status="approval_controlled" /> after sign-in
          </p>
        </article>
        <article className="card">
          <h2>Workflow automation</h2>
          <p>
            Weekend Google Merchant feed preparation runs in shadow by default. Live posts require
            authorized OAuth — never fabricated.
          </p>
          <p className="meta">
            <StatusBadge status="credential_blocked" /> for live Google
          </p>
        </article>
        <article className="card">
          <h2>Marketplace orchestration</h2>
          <p>
            Shopify GraphQL Admin, Amazon SP-API, eBay, AliExpress, and Google Merchant are registered
            as live-capable adapters; fixtures stay labeled until you authorize real accounts.
          </p>
          <p className="meta">
            <Link href="/integrations">Integrations →</Link>
          </p>
        </article>
      </div>
    </section>
  );
}
