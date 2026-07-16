import Link from 'next/link';
import { fetchApiHealth } from '../lib/api';
import { StatusBadge } from '../components/status-badge';

/**
 * Public marketing home — no private merchant data.
 * Entry to free tools + registration + authenticated workspace.
 */
export default async function HomePage() {
  const health = await fetchApiHealth();

  return (
    <section className="hero public-landing">
      <div>
        <p className="pill">Public website · free tools · merchant workspace</p>
        <h1>The AI operating system for multichannel physical commerce</h1>
        <p className="lede">
          TradeOps connects authorized storefronts, marketplaces, and suppliers into one canonical
          commerce world. Score real profit, run an interactive AI operator, automate weekend catalog
          work in shadow mode, and keep humans in the loop for money-risking actions.
        </p>
        <div className="cta-row">
          <Link className="btn primary" href="/register">
            Start free registration
          </Link>
          <Link className="btn ghost" href="/tools">
            Try free tools
          </Link>
          <Link className="btn ghost" href="/product">
            Product overview
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
            as official adapters — live only with your credentials.
          </p>
          <p className="meta">
            <Link href="/integrations">Integrations →</Link>
          </p>
        </article>
        <article className="card">
          <h2>Who it serves</h2>
          <p>
            Multichannel merchants, operators, and commerce teams who need real unit economics,
            supplier risk, and controlled automation — not vanity dashboards.
          </p>
          <p className="meta">
            <Link href="/how-it-works">How it works →</Link>
          </p>
        </article>
        <article className="card">
          <h2>Security first</h2>
          <p>
            Session cookies, multi-tenant isolation, permission gates, audit events, and fail-closed
            policy. Local AUTH_BYPASS is development-only and off in production.
          </p>
          <p className="meta">
            <Link href="/security">Security →</Link>
          </p>
        </article>
      </div>
    </section>
  );
}
