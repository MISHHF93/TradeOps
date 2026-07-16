import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '../../components/status-badge';

export const metadata: Metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <section className="hero">
      <h1>Pricing</h1>
      <p className="lede">
        Public free tools are available without an account. Merchant workspace registration is open
        for controlled launch. Paid billing is not yet operational.
      </p>
      <div className="grid">
        <article className="card">
          <h2>Free tools</h2>
          <p>Unit economics, opportunity score, policy gate.</p>
          <p className="meta">
            <StatusBadge status="operational" /> · no credit card
          </p>
          <p className="meta">
            <Link href="/tools">Open tools →</Link>
          </p>
        </article>
        <article className="card">
          <h2>Merchant workspace</h2>
          <p>Terminal, AI operator, approvals, automation, multi-tenant orgs.</p>
          <p className="meta">
            <StatusBadge status="operational" /> registration · self-serve
          </p>
          <p className="meta">
            <Link href="/register">Register →</Link>
          </p>
        </article>
        <article className="card">
          <h2>Paid plans / billing</h2>
          <p>Invoices, seats, and usage metering.</p>
          <p className="meta">
            <StatusBadge status="coming_soon" /> — not sold yet; no fake checkout
          </p>
        </article>
      </div>
    </section>
  );
}
