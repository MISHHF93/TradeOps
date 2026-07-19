import Link from 'next/link';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
import { terminalGet } from '../../../lib/terminal-api';

/**
 * Durable objective / OperatorRun history.
 * Launch new runs from the right AI Operator rail — this page is history + open full result only.
 */
export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; objective?: string }>;
}) {
  const sp = await searchParams;
  const presetNote =
    sp.objective?.trim() || sp.caseId?.trim()
      ? 'Use the AI Operator rail on the right to run the prefilled objective; completed runs appear below.'
      : null;

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

  const rows = runs.ok ? runs.data : [];

  return (
    <TerminalPageFrame
      pill="Objectives · execution history"
      title="Objectives"
      lede="Durable OperatorRun records. Each row is a user goal and outcome summary — system prompts stay server-side. Launch from the AI Operator rail; open a row for the full briefing, evidence, and plan."
      showRelatedNav={false}
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { label: 'Objectives' },
      ]}
      toolbar={
        <>
          <Link className="btn ghost" href="/terminal/live-examples">
            Live examples
          </Link>
          <Link className="btn ghost" href="/terminal/ai">
            AI platform
          </Link>
          <Link className="btn ghost" href="/terminal/process">
            Cases
          </Link>
        </>
      }
      error={runs.ok ? null : runs.error}
    >
      {presetNote ? (
        <p className="meta" style={{ marginBottom: 12 }}>
          {presetNote}
          {sp.objective?.trim() ? (
            <>
              {' '}
              Prefill: <strong>{sp.objective.trim().slice(0, 120)}</strong>
            </>
          ) : null}
        </p>
      ) : null}

      {rows.length === 0 && runs.ok ? (
        <ProcessEmptyState
          title="No runs yet"
          body="Use the AI Operator panel on the right to state an objective. History appears here for audit and full-result review."
          primaryHref="/terminal/process"
          primaryLabel="Open cases"
          secondaryHref="/terminal/live-examples"
          secondaryLabel="Live examples"
        />
      ) : null}

      {rows.length > 0 ? (
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
              {rows.map((r) => (
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
                      Full result
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </TerminalPageFrame>
  );
}
