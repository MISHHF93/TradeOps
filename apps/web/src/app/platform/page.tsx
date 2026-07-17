import type { Metadata } from 'next';
import Link from 'next/link';
import { publicPageMeta } from '../../lib/seo';

export const metadata: Metadata = publicPageMeta({
  title: 'Platform — multi-tenant commerce intelligence',
  description:
    'TradeOps multi-tenant SaaS foundation: segments, entitlements, persona workspaces, control tower, and agentic readiness.',
  path: '/platform',
});

const CAPABILITIES = [
  {
    title: 'Tenant isolation',
    body: 'Every private record is organization-scoped. Parent/client hierarchy for agencies. Deployment modes: pooled, siloed, bridge.',
  },
  {
    title: 'Capability packs & plans',
    body: 'Commerce Starter, Multichannel, AI Intelligence, Procurement, Agency Console, Enterprise Governance — with server-side quotas.',
  },
  {
    title: 'Persona workspaces',
    body: 'Founder, Operator, Analyst, Procurement, Finance, Executive, Agency, Auditor — same data, different priorities.',
  },
  {
    title: 'Control tower',
    body: 'Revenue proxies, contribution profit, connector health, approvals, AI issues, delayed fulfillments in one org view.',
  },
  {
    title: 'ATP & channel profit',
    body: 'Available-to-promise inventory math and contribution-margin channel recommendations per product.',
  },
  {
    title: 'Agentic readiness',
    body: 'Catalog structure, identifiers, freshness, and policy clarity scores — not a false live UCP/ACP claim.',
  },
];

export default function PlatformPage() {
  return (
    <section className="hero">
      <p className="pill">Platform</p>
      <h1>Commerce Intelligence SaaS foundation</h1>
      <p className="lede">
        TradeOps is built as multi-tenant infrastructure for individuals, SMBs, agencies, and
        enterprises — not a single-user demo shell. Live marketplace posts remain credential-blocked
        until you connect accounts.
      </p>
      <div className="hero-actions">
        <Link className="btn primary" href="/register">
          Start free evaluation
        </Link>
        <Link className="btn ghost" href="/platform/plans">
          Plans & entitlements
        </Link>
        <Link className="btn ghost" href="/status">
          Capability honesty board
        </Link>
      </div>

      <div className="grid" style={{ marginTop: 32 }}>
        {CAPABILITIES.map((c) => (
          <article key={c.title} className="card">
            <h2>{c.title}</h2>
            <p className="meta">{c.body}</p>
          </article>
        ))}
      </div>

      <h2 style={{ marginTop: 40 }}>Customer segments</h2>
      <ul className="dep-list">
        <li>
          <strong>
            <Link href="/solutions/individual-sellers">Individuals</Link>
          </strong>
          <span>Founder cockpit, scanner, profit, draft listings</span>
        </li>
        <li>
          <strong>
            <Link href="/solutions/small-business">SMB</Link>
          </strong>
          <span>Team seats, multichannel packs, workflows</span>
        </li>
        <li>
          <strong>
            <Link href="/solutions/agencies">Agencies</Link>
          </strong>
          <span>Client org hierarchy and usage isolation</span>
        </li>
        <li>
          <strong>
            <Link href="/solutions/enterprise">Enterprise</Link>
          </strong>
          <span>Governance packs, deployment modes, control tower</span>
        </li>
      </ul>
    </section>
  );
}
