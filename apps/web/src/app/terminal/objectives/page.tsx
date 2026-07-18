import Link from 'next/link';
import { terminalGet } from '../../../lib/terminal-api';

/**
 * Durable objective / OperatorRun history — survives refresh.
 */
export default async function ObjectivesPage() {
  const runs = await terminalGet<
    Array<{
      id: string;
      objective: string;
      description?: string | null;
      status: string;
      decision: string | null;
      decisionNote: string | null;
      startedAt: string;
      completedAt: string | null;
      recommendations: Array<{ title: string; rank: number }>;
    }>
  >('/api/v1/ai/runs?take=30');

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1 className="workspace-title-active">Objectives</h1>
          <p className="lede">
            Durable Execution Navigator records. Each row is a user goal and outcome summary —
            system prompts stay server-side and never appear as the objective text.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn secondary" href="/terminal/live-examples">
            Live examples
          </Link>
          <Link className="btn ghost" href="/terminal/ai">
            AI workspace
          </Link>
        </div>
      </header>

      {!runs.ok ? <p className="form-error">{runs.error}</p> : null}

      <div className="table-wrap">
        <table className="scanner-table" aria-label="Objective executions">
          <thead>
            <tr>
              <th>Started</th>
              <th>Status</th>
              <th>Decision</th>
              <th>Objective</th>
              <th>Description</th>
              <th>Recs</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {(runs.ok ? runs.data : []).length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  No objectives yet. Run a live example or open the AI panel.
                </td>
              </tr>
            ) : (
              (runs.ok ? runs.data : []).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.startedAt).toLocaleString()}</td>
                  <td>
                    <strong className="text-accent">{r.status}</strong>
                  </td>
                  <td>{r.decision ?? '—'}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 280 }}>
                    <strong>{(r.objective || '—').slice(0, 120)}</strong>
                    {(r.objective?.length ?? 0) > 120 ? '…' : ''}
                  </td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 280 }} className="meta">
                    {(r.description ?? r.decisionNote ?? '—').slice(0, 140)}
                    {(r.description ?? r.decisionNote ?? '').length > 140 ? '…' : ''}
                  </td>
                  <td>{r.recommendations?.length ?? 0}</td>
                  <td>
                    <Link className="btn ghost" href={`/terminal/objectives/${r.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
