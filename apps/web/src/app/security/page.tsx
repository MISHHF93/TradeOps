import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Security' };

export default function SecurityPage() {
  return (
    <section className="hero">
      <h1>Security</h1>
      <p className="lede">
        TradeOps is multi-tenant by design. Public pages never read private catalogs. Consequential
        marketplace actions require permissions and human approval.
      </p>
      <ul className="dep-list">
        <li>
          <strong>Session auth</strong>
          <span>HttpOnly cookies · hashed passwords · server-side sessions</span>
        </li>
        <li>
          <strong>Authorization</strong>
          <span>RBAC permissions on API routes · fail closed</span>
        </li>
        <li>
          <strong>Tenancy</strong>
          <span>organizationId on business rows · membership isolation</span>
        </li>
        <li>
          <strong>Audit</strong>
          <span>Operator actions and weekend feeds write audit events</span>
        </li>
        <li>
          <strong>Policy</strong>
          <span>Restricted goods blocked before listing paths</span>
        </li>
        <li>
          <strong>Local AUTH_BYPASS</strong>
          <span>Development only · forced off when NODE_ENV=production</span>
        </li>
        <li>
          <strong>Secrets</strong>
          <span>Connector credentials via env / vault path — never returned in public APIs</span>
        </li>
      </ul>
      <p className="meta">
        <Link href="/status">Capability honesty board →</Link>
      </p>
    </section>
  );
}
