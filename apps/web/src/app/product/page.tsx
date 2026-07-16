import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Product' };

export default function ProductPage() {
  return (
    <section className="hero">
      <h1>What TradeOps is</h1>
      <p className="lede">
        A commerce operating system: ingest events, harmonize product identity, evaluate profit and
        risk, recommend actions, require approval for consequence, and learn from outcomes.
      </p>
      <div className="grid">
        {[
          ['Predictive commerce', 'Baseline demand forecasts with transparent evaluation against outcomes.'],
          ['Supplier intelligence', 'Landed-cost aware offers with reliability and policy risk.'],
          ['Marketplace orchestration', 'Canonical listings mapped to channel adapters — not SDK sprawl in the UI.'],
          ['Cash-flow management', 'Cash required before payout and contribution profit, not vanity GMV.'],
          ['Workflow automation', 'Shadow and scheduled jobs with audit trails.'],
          ['AI workspace', 'Interactive operator with typed tools — not a chatbot over static charts.'],
        ].map(([t, b]) => (
          <article key={t} className="card">
            <h2>{t}</h2>
            <p>{b}</p>
          </article>
        ))}
      </div>
      <div className="cta-row">
        <Link className="btn primary" href="/register">
          Register
        </Link>
        <Link className="btn ghost" href="/status">
          See what is operational
        </Link>
      </div>
    </section>
  );
}
