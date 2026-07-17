import Link from 'next/link';
import { terminalGet } from '../../../lib/terminal-api';

export default async function CapitalDistributionsPage() {
  const status = await terminalGet<{
    gates: Array<{ key: string; enabled: boolean; legalNote: string }>;
  }>('/api/v1/capital/status');
  const dist = status.ok
    ? status.data.gates.find((g) => g.key === 'DISTRIBUTIONS_ENABLED')
    : null;

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Capital · distributions</p>
          <h1>Distributions</h1>
        </div>
        <Link className="btn ghost" href="/capital">
          Capital home
        </Link>
      </header>
      <article className="panel">
        <p>
          Execution enabled: <strong>{dist?.enabled ? 'yes' : 'no'}</strong> (
          <code>DISTRIBUTIONS_ENABLED</code>)
        </p>
        <p className="meta">{dist?.legalNote}</p>
        <p>
          Dry-run waterfall: <code>POST /api/v1/capital/waterfall/dry-run</code>. Calculated
          distributions can be stored on a campaign; <strong>paid</strong> status requires the gate
          and provider confirmation.
        </p>
      </article>
    </section>
  );
}
