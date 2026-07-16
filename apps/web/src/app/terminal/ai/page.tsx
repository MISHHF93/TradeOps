import { AiOperatorConsole } from '../../../components/ai-operator-console';
import { terminalGet } from '../../../lib/terminal-api';
import { getApiBaseUrl } from '../../../lib/api';

export default async function AiWorkspacePage() {
  const tools = await terminalGet<{
    tools: Array<{ name: string; description: string; actionClass: string; approvalRequired: boolean }>;
    loopModes: Array<{ mode: string; meaning: string }>;
    note: string;
  }>('/api/v1/ai/tools');

  const runs = await terminalGet<
    Array<{
      id: string;
      objective: string;
      status: string;
      loopMode: string;
      decision: string | null;
      startedAt: string;
      recommendations: Array<{ title: string; rank: number }>;
    }>
  >('/api/v1/ai/runs?take=10');

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1>AI Operator</h1>
          <p className="lede">
            Interactive commerce operator — not a decorative chatbot. Issues objectives, runs typed
            tools against the canonical store, critic + auditor passes, then queues consequential
            work for approval. Shadow mode is live evaluation, not a fake demo.
          </p>
        </div>
      </header>

      <AiOperatorConsole />

      <h2 style={{ marginTop: 28 }}>Loop modes</h2>
      {!tools.ok ? <p className="form-error">{tools.error}</p> : null}
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Mode</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {(tools.ok ? tools.data.loopModes : []).map((m) => (
            <tr key={m.mode}>
              <td>
                <strong>{m.mode}</strong>
              </td>
              <td className="meta" style={{ whiteSpace: 'normal' }}>
                {m.meaning}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 28 }}>Tool registry</h2>
      <p className="meta">{tools.ok ? tools.data.note : null}</p>
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Class</th>
            <th>Approval</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {(tools.ok ? tools.data.tools : []).map((t) => (
            <tr key={t.name}>
              <td>
                <code>{t.name}</code>
              </td>
              <td>{t.actionClass}</td>
              <td>{t.approvalRequired ? 'yes' : 'no'}</td>
              <td className="meta" style={{ whiteSpace: 'normal' }}>
                {t.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 28 }}>Recent operator runs</h2>
      {!runs.ok ? <p className="form-error">{runs.error}</p> : null}
      <table className="scanner-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Status</th>
            <th>Mode</th>
            <th>Decision</th>
            <th>Objective</th>
          </tr>
        </thead>
        <tbody>
          {(runs.ok ? runs.data : []).length === 0 ? (
            <tr>
              <td className="empty" colSpan={5}>
                No runs yet. Submit an objective above.
              </td>
            </tr>
          ) : (
            (runs.ok ? runs.data : []).map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.startedAt).toLocaleString()}</td>
                <td>{r.status}</td>
                <td>{r.loopMode}</td>
                <td>{r.decision ?? '—'}</td>
                <td className="meta" style={{ whiteSpace: 'normal', maxWidth: 360 }}>
                  {r.objective.slice(0, 160)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="meta" style={{ marginTop: 16 }}>
        API base: <code>{getApiBaseUrl()}</code> · Tools catalog also at{' '}
        <code>/api/v1/ai/tools</code>
      </p>
    </section>
  );
}
