import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '../../components/status-badge';
import { getApiBaseUrl } from '../../lib/api';

export const metadata: Metadata = { title: 'Integrations' };

type Feed = {
  providerKey: string;
  displayName: string;
  family: string;
  docsUrl: string;
  isFixture: boolean;
  authMode: string;
  notes: string;
  weekendAutomation?: boolean;
};

export default async function IntegrationsPage() {
  let feeds: Feed[] = [];
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/automation/feeds`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const body = (await res.json()) as { feeds?: Feed[] };
      feeds = body.feeds ?? [];
    }
  } catch {
    feeds = [];
  }

  return (
    <section className="hero">
      <h1>Supported integrations</h1>
      <p className="lede">
        Official API registry. Entries describe capabilities and docs — not claims of active live
        connection on this deployment.
      </p>
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Family</th>
            <th>Auth</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {feeds.length === 0 ? (
            <tr>
              <td className="empty" colSpan={5}>
                API feed registry unavailable. Start the API and refresh.
              </td>
            </tr>
          ) : (
            feeds.map((f) => (
              <tr key={f.providerKey}>
                <td>
                  <strong>{f.displayName}</strong>
                  <div className="meta">
                    <a href={f.docsUrl} target="_blank" rel="noreferrer">
                      {f.providerKey}
                    </a>
                  </div>
                </td>
                <td>{f.family}</td>
                <td>{f.authMode}</td>
                <td>
                  {f.isFixture ? (
                    <StatusBadge status="administrative" />
                  ) : (
                    <StatusBadge status="credential_blocked" />
                  )}
                </td>
                <td className="meta" style={{ whiteSpace: 'normal' }}>
                  {f.notes}
                  {f.weekendAutomation ? ' · Weekend automation supported (shadow default).' : ''}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="meta">
        <Link href="/status">Full capability matrix →</Link>
      </p>
    </section>
  );
}
