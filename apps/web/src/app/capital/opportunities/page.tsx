import Link from 'next/link';
import { terminalGet } from '../../../lib/terminal-api';

/**
 * Public opportunities feed — blocked until PUBLIC_CAMPAIGNS_ENABLED.
 */
export default async function CapitalOpportunitiesPage() {
  const status = await terminalGet<{
    gates: Array<{ key: string; enabled: boolean; legalNote: string }>;
    honesty: { note: string };
  }>('/api/v1/capital/status');

  const publicGate = status.ok
    ? status.data.gates.find((g) => g.key === 'PUBLIC_CAMPAIGNS_ENABLED')
    : null;
  const enabled = publicGate?.enabled === true;

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Capital · opportunities</p>
          <h1>Investment opportunities</h1>
        </div>
        <Link className="btn ghost" href="/capital">
          Capital home
        </Link>
      </header>

      {!enabled ? (
        <article className="panel">
          <h2>Unavailable pending legal approval</h2>
          <p>
            Public campaign listings and investment solicitation are <strong>disabled</strong> (
            <code>PUBLIC_CAMPAIGNS_ENABLED=false</code>).
          </p>
          <p className="meta">
            {publicGate?.legalNote ??
              'Canadian securities crowdfunding typically requires a compliant portal and disclosures.'}
          </p>
          <p className="meta">{status.ok ? status.data.honesty.note : null}</p>
          <p>
            Use <Link href="/capital/campaigns">sandbox campaigns</Link> for operational design only.
          </p>
        </article>
      ) : (
        <article className="panel">
          <p>
            Public gate is enabled in configuration — still verify portal registration, disclosures,
            and custody before listing live opportunities.
          </p>
        </article>
      )}
    </section>
  );
}
