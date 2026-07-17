import type { Metadata } from 'next';
import Link from 'next/link';
import { publicPageMeta } from '../../../lib/seo';

export const metadata: Metadata = publicPageMeta({
  title: 'Plans & entitlements',
  description:
    'TradeOps subscription tiers with store, connector, AI evaluation, and workflow quotas enforced server-side.',
  path: '/platform/plans',
});

const PLANS = [
  {
    tier: 'Evaluation',
    who: 'New accounts',
    stores: 1,
    connectors: 2,
    products: 100,
    ai: 50,
    workflows: 30,
    clients: 0,
    note: 'Time-limited path — not a permanent free AI farm.',
  },
  {
    tier: 'Starter',
    who: 'Individuals',
    stores: 1,
    connectors: 2,
    products: 500,
    ai: 200,
    workflows: 100,
    clients: 0,
    note: 'Launch one commerce operation with honesty labels.',
  },
  {
    tier: 'Growth',
    who: 'SMB',
    stores: 5,
    connectors: 8,
    products: 5000,
    ai: 2000,
    workflows: 1000,
    clients: 0,
    note: 'Multichannel + procurement packs.',
  },
  {
    tier: 'Agency',
    who: 'Agencies',
    stores: 50,
    connectors: 50,
    products: 50000,
    ai: 10000,
    workflows: 5000,
    clients: 25,
    note: 'Parent/client org hierarchy.',
  },
  {
    tier: 'Business',
    who: 'Growing companies',
    stores: 20,
    connectors: 30,
    products: 25000,
    ai: 20000,
    workflows: 10000,
    clients: 0,
    note: 'Team governance and forecasting capacity.',
  },
  {
    tier: 'Enterprise',
    who: 'Corporations',
    stores: 1000,
    connectors: 1000,
    products: '1M+',
    ai: 'High',
    workflows: 'High',
    clients: 1000,
    note: 'Governance pack + siloed/bridge deployment modes. SSO and deep ERP remain roadmap depth.',
  },
];

export default function PlatformPlansPage() {
  return (
    <section className="hero">
      <p className="pill">Commercial model</p>
      <h1>Plans & server-side entitlements</h1>
      <p className="lede">
        Quotas for stores, connectors, products, seats, AI evaluations, and workflow runs are
        enforced in the API — never only in the UI. Failed platform operations are not metered as
        billable success.
      </p>
      <div className="hero-actions">
        <Link className="btn primary" href="/register">
          Register
        </Link>
        <Link className="btn ghost" href="/pricing">
          Pricing narrative
        </Link>
        <Link className="btn ghost" href="/platform">
          Platform overview
        </Link>
      </div>

      <table className="scanner-table" style={{ marginTop: 32 }}>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Customer</th>
            <th>Stores</th>
            <th>Connectors</th>
            <th>Products</th>
            <th>AI / mo</th>
            <th>Workflows / mo</th>
            <th>Client orgs</th>
          </tr>
        </thead>
        <tbody>
          {PLANS.map((p) => (
            <tr key={p.tier}>
              <td>
                <strong>{p.tier}</strong>
                <div className="meta">{p.note}</div>
              </td>
              <td>{p.who}</td>
              <td>{p.stores}</td>
              <td>{p.connectors}</td>
              <td>{p.products}</td>
              <td>{p.ai}</td>
              <td>{p.workflows}</td>
              <td>{p.clients}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="meta" style={{ marginTop: 16 }}>
        Billing ledger charges (Stripe etc.) are not fully wired — meters and hard limits exist for
        operational safety. Live connector capacity still requires your marketplace credentials.
      </p>
    </section>
  );
}
