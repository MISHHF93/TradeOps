import Link from 'next/link';
import { AgencyClientForm } from '../../../components/agency-client-form';
import { terminalGet } from '../../../lib/terminal-api';

export default async function AgencyClientsPage() {
  const clients = await terminalGet<{
    clients?: Array<{
      id: string;
      name: string;
      slug: string;
      segment: string;
      planTier: string;
    }>;
    error?: string;
  }>('/api/v1/saas/agency/clients');

  const tenant = await terminalGet<{
    organization?: { segment?: string; planTier?: string; name?: string };
    quotas?: { /* client orgs shown under seats etc */ };
  }>('/api/v1/saas/tenant');

  const list = clients.ok ? clients.data.clients ?? [] : [];
  const isAgencyCapable =
    tenant.ok &&
    (tenant.data.organization?.segment === 'agency' ||
      tenant.data.organization?.planTier === 'agency' ||
      tenant.data.organization?.planTier === 'enterprise');

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Agency console · multi-tenant hierarchy</p>
          <h1>Client organizations</h1>
          <p className="lede">
            Parent/agency tenants can create isolated client organizations. Credentials and private
            data never cross client boundaries.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn ghost" href="/onboarding">
            Change segment
          </Link>
          <Link className="btn primary" href="/terminal/control-tower">
            Control tower
          </Link>
        </div>
      </header>

      {!clients.ok ? <p className="form-error">{clients.error}</p> : null}

      {!isAgencyCapable ? (
        <article className="card" style={{ marginBottom: 16 }}>
          <h2>Agency pack not active</h2>
          <p className="meta">
            Set segment to <strong>agency</strong> (or use agency/enterprise plan) in onboarding to
            create client orgs. Current:{' '}
            {tenant.ok
              ? `${tenant.data.organization?.segment} / ${tenant.data.organization?.planTier}`
              : 'unknown'}
          </p>
        </article>
      ) : (
        <AgencyClientForm />
      )}

      <h2 style={{ marginTop: 24 }}>Clients ({list.length})</h2>
      {list.length === 0 ? (
        <p className="meta">No client organizations yet.</p>
      ) : (
        <table className="scanner-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Segment</th>
              <th>Plan</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>{c.slug}</td>
                <td>{c.segment}</td>
                <td>{c.planTier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
