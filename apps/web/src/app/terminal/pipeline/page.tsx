import { PipelineActions } from '../../../components/pipeline-actions';
import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

type Stage = {
  id: string;
  title: string;
  description: string;
  status: string;
  count: number;
  detail?: string;
};

export default async function PipelinePage() {
  type OutcomeRow = {
    id: string;
    modelVersion: string;
    source: string;
    predictedUnits: number;
    actualUnits: number;
    predictedProfitMinor: number;
    actualProfitMinor: number;
    unitAbsoluteError: number;
    profitAbsoluteError: number;
    signalAtPrediction: string | null;
    signalCorrect: boolean | null;
    evaluatedAt: string;
    product: { id: string; title: string };
  };

  // Parallel SSR fetches — sequential was doubling PGlite wait time.
  const [pipeline, outcomes] = await Promise.all([
    terminalGet<{ stages: Stage[]; modelVersion: string }>('/api/v1/terminal/pipeline'),
    terminalGet<OutcomeRow[]>('/api/v1/terminal/prediction-outcomes'),
  ]);

  if (!pipeline.ok) {
    return <p className="form-error">{pipeline.error}</p>;
  }

  const stages = pipeline.data.stages;
  const rows = outcomes.ok ? outcomes.data : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1>Commerce pipeline</h1>
          <p className="lede">
            End-to-end loop from market data to prediction evaluation. Active model:{' '}
            <code>{pipeline.data.modelVersion}</code>. Signals are operational recommendations for
            physical products — not investment advice.
          </p>
        </div>
        <PipelineActions />
      </header>

      <ol className="pipeline-flow">
        {stages.map((s, i) => (
          <li key={s.id} className={`pipeline-stage status-${s.status}`}>
            <div className="pipeline-step">{i + 1}</div>
            <div>
              <strong>{s.title}</strong>
              <p>{s.description}</p>
              <p className="meta">
                <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span> · n={s.count}
                {s.detail ? ` · ${s.detail}` : ''}
              </p>
            </div>
            {i < stages.length - 1 ? <div className="pipeline-arrow" aria-hidden>
              ↓
            </div> : null}
          </li>
        ))}
      </ol>

      <h2>Prediction outcomes</h2>
      <p className="meta">
        Realized vs forecast after simulation evaluation or fulfilled customer orders.
      </p>
      <div className="table-wrap">
        <table className="scanner-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Product</th>
              <th>Source</th>
              <th>Pred units</th>
              <th>Actual units</th>
              <th>Pred profit</th>
              <th>Actual profit</th>
              <th>|Δ units|</th>
              <th>|Δ profit|</th>
              <th>Signal</th>
              <th>Hit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty">
                  No outcomes yet. Run simulation → Evaluate, or complete a fulfillment on an order.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.evaluatedAt).toLocaleString()}</td>
                  <td>{r.product.title}</td>
                  <td>{r.source}</td>
                  <td>{r.predictedUnits}</td>
                  <td>{r.actualUnits}</td>
                  <td>{formatMoney(r.predictedProfitMinor)}</td>
                  <td>{formatMoney(r.actualProfitMinor)}</td>
                  <td>{r.unitAbsoluteError}</td>
                  <td>{formatMoney(r.profitAbsoluteError)}</td>
                  <td>{r.signalAtPrediction ?? '—'}</td>
                  <td>
                    {r.signalCorrect == null ? '—' : r.signalCorrect ? 'yes' : 'no'}
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

function statusBadge(status: string): string {
  if (status === 'complete') return 'up';
  if (status === 'in_progress' || status === 'ready') return 'degraded';
  if (status === 'blocked') return 'down';
  return 'degraded';
}
