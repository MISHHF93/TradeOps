import Link from 'next/link';
import { AgencyClientForm } from '../../../components/agency-client-form';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
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
  }>('/api/v1/saas/tenant');

  const list = clients.ok ? clients.data.clients ?? [] : [];
  const isAgencyCapable =
    tenant.ok &&
    (tenant.data.organization?.segment === 'agency' ||
      tenant.data.organization?.planTier === 'agency' ||
      tenant.data.organization?.planTier === 'enterprise');

  return (
    <TerminalPageFrame
      pill="Agency · multi-tenant"
      title="Client organizations"
      lede="Parent/agency tenants create isolated client organizations. Credentials and private data never cross client boundaries."
      relatedPrimary="workspace"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { label: 'Agency' },
      ]}
      toolbar={
        <>
          <Link className="btn ghost" href="/onboarding">
            Change segment
          </Link>
          <Link className="btn primary" href="/terminal/workspace/administrator">
            Admin home
          </Link>
        </>
      }
      error={clients.ok ? null : clients.error}
    >
      {!isAgencyCapable ? (
        <ProcessEmptyState
          title="Agency pack not active"
          body={`Set segment to agency (or agency/enterprise plan) in onboarding to create client orgs. Current: ${
            tenant.ok
              ? `${tenant.data.organization?.segment} / ${tenant.data.organization?.planTier}`
              : 'unknown'
          }`}
          primaryHref="/onboarding"
          primaryLabel="Onboarding"
          secondaryHref="/terminal/workspace/administrator"
          secondaryLabel="Admin home"
        />
      ) : (
        <AgencyClientForm />
      )}

      {isAgencyCapable ? (
        <>
          <h2 style={{ marginTop: 24 }}>Clients ({list.length})</h2>
          {list.length === 0 ? (
            <p className="meta">No client organizations yet — create one above.</p>
          ) : (
            <div className="table-wrap">
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
            </div>
          )}
        </>
      ) : null}
    </TerminalPageFrame>
  );
}
