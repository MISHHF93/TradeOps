import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'How it works' };

const STEPS = [
  {
    t: 'Subscribe',
    d: 'Stripe Checkout for TradeOps SaaS—access and entitlements only. No investment wallet.',
  },
  {
    t: 'Connect systems',
    d: 'Attach commerce channels, suppliers, and later logistics/ads via the Unified Connector Hub (capabilities, not raw APIs).',
  },
  {
    t: 'Intelligence runs continuously',
    d: 'Discover products, estimate landed cost and margins, flag risks—proactive recommendations, not only search boxes.',
  },
  {
    t: 'One operations spine',
    d: 'Discover → Evaluate → Source → List → Approve → Publish → Monitor → Optimize → Reconcile → Learn.',
  },
  {
    t: 'AI Operator proposes; you approve',
    d: 'Typed tools draft listings and workflows. Consequential actions require human approval.',
  },
  {
    t: 'Measure realized results',
    d: 'Channel payments and costs reconcile into contribution profit—forecast vs realized, never vanity GMV alone.',
  },
];

export default function HowItWorksPage() {
  return (
    <section className="hero">
      <p className="pill">AI Commerce Operating System</p>
      <h1>How TradeOps works</h1>
      <p className="lede">
        TradeOps sits above your channels. One internal model, many adapters. AI operates on approved
        tools—you keep ownership of stores and checkout.
      </p>
      <ol className="pipeline-flow">
        {STEPS.map((s, i) => (
          <li key={s.t} className="pipeline-stage status-complete">
            <span className="pipeline-step">{i + 1}</span>
            <div>
              <strong>{s.t}</strong>
              <p className="meta" style={{ margin: '4px 0 0' }}>
                {s.d}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="meta">
        Loop modes: <strong>fixture</strong> · <strong>development</strong> · <strong>shadow</strong> ·{' '}
        <strong>controlled_live</strong> · <strong>automated_live</strong>.
      </p>
      <div className="cta-row">
        <Link className="btn primary" href="/product">
          Six pillars
        </Link>
        <Link className="btn ghost" href="/status">
          Capability status
        </Link>
      </div>
    </section>
  );
}
