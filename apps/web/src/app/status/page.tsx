import type { Metadata } from 'next';
import { StatusBadge, StatusLegend, type CapStatus } from '../../components/status-badge';
import { getApiBaseUrl } from '../../lib/api';

export const metadata: Metadata = { title: 'Capability status' };

type Cap = {
  id: string;
  surface: string;
  name: string;
  path: string;
  status: CapStatus;
  description: string;
  evidence: string;
};

export default async function StatusPage() {
  let entries: Cap[] = [];
  let note = '';
  let summary: { counts?: Record<string, number>; launchRule?: string } = {};
  let error: string | null = null;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/public/capabilities`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      error = `API HTTP ${res.status}`;
    } else {
      const body = (await res.json()) as {
        entries?: Cap[];
        note?: string;
        summary?: { counts?: Record<string, number>; launchRule?: string };
      };
      entries = body.entries ?? [];
      note = body.note ?? '';
      summary = body.summary ?? {};
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load capabilities';
  }

  return (
    <section className="hero">
      <h1>Capability status</h1>
      <p className="lede">
        Production verification board. Every primary control is classified. No capability is claimed
        operational without an executable path.
      </p>
      <StatusLegend />
      {summary.launchRule ? <p className="meta">{summary.launchRule}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {note ? <p className="meta">{note}</p> : null}

      <table className="scanner-table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Surface</th>
            <th>Capability</th>
            <th>Status</th>
            <th>Path</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{e.surface}</td>
              <td>
                <strong>{e.name}</strong>
                <div className="meta" style={{ whiteSpace: 'normal', maxWidth: 320 }}>
                  {e.description}
                </div>
              </td>
              <td>
                <StatusBadge status={e.status} />
              </td>
              <td>
                <code>{e.path}</code>
              </td>
              <td className="meta" style={{ whiteSpace: 'normal' }}>
                {e.evidence}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
