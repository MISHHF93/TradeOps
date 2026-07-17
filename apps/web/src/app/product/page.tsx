import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Product' };

const PILLARS: Array<{ title: string; body: string }> = [
  {
    title: '1. Commerce Intelligence',
    body: 'The brain: continuous product discovery, supplier analysis, landed cost, margins, risk, and proactive recommendations—not manual marketplace browsing.',
  },
  {
    title: '2. Commerce Operations',
    body: 'One lifecycle for every product: Discover → Evaluate → Source → List → Approve → Publish → Monitor → Optimize → Reconcile → Learn.',
  },
  {
    title: '3. Unified Connector Hub',
    body: 'Capability-based adapters for commerce, suppliers, logistics, marketing, and finance. Canonical data—not a separate source of truth per channel.',
  },
  {
    title: '4. AI Operator',
    body: 'An operational manager: discover, evaluate, draft, and explain. You review and approve consequential actions.',
  },
  {
    title: '5. SaaS Billing',
    body: 'Simple Stripe subscriptions for TradeOps access. No investment wallet. Shopper payments stay on your processors.',
  },
  {
    title: '6. Enterprise Layer',
    body: 'Multi-org, roles, approvals, audit, workflows, and governance as you scale—without becoming another storefront.',
  },
];

export default function ProductPage() {
  return (
    <section className="hero">
      <p className="pill">AI Commerce Operating System</p>
      <h1>Not another e-commerce platform</h1>
      <p className="lede">
        TradeOps sits <strong>above</strong> Shopify, Amazon, eBay, suppliers, and logistics. Merchants
        own stores and checkout. TradeOps provides intelligence, a single operations spine, connectors,
        and an AI operator—so you run commerce better.
      </p>
      <p className="meta">
        Guiding question: <em>How do I run my commerce business better?</em>
      </p>

      <div className="grid">
        {PILLARS.map((p) => (
          <article key={p.title} className="card">
            <h2>{p.title}</h2>
            <p>{p.body}</p>
          </article>
        ))}
      </div>

      <article className="card" style={{ marginTop: 24 }}>
        <h2>Proactive intelligence</h2>
        <p>
          Weak: <em>“Find products.”</em>
        </p>
        <p>
          Target: <em>“I found 14 products matching your criteria. Three exceed your 35% minimum
          margin.”</em>
        </p>
      </article>

      <div className="cta-row" style={{ marginTop: 24 }}>
        <Link className="btn primary" href="/register">
          Register
        </Link>
        <Link className="btn secondary" href="/how-it-works">
          How it works
        </Link>
        <Link className="btn ghost" href="/status">
          See what is operational
        </Link>
      </div>
    </section>
  );
}
