'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getApiBaseUrl } from '../lib/api';

type OperatorResponse = {
  runId?: string;
  loopMode?: string;
  decision?: string;
  decisionNote?: string;
  plan?: { interpretation?: string; steps?: string[]; toolsToCall?: string[] };
  critic?: { severity?: string; notes?: string; issues?: string[] };
  auditor?: { notes?: string; issues?: string[]; calculationOk?: boolean; policyOk?: boolean };
  recommendations?: Array<{
    rank: number;
    title: string;
    rationale: string;
    confidence: number;
    approvalRequired: boolean;
    policyRiskScore: number;
    calculation?: Record<string, unknown>;
    missingData?: string[];
  }>;
  honesty?: { note?: string; fixtureProductsPresent?: boolean; shadowByDefault?: boolean };
  message?: string;
};

const DEFAULT_OBJECTIVE =
  'Find products with a predicted margin above 25%, delivery under 12 days, at least 200 credible reviews, and low policy risk. Compare suppliers, prepare the three strongest listings, and place them in my approval queue.';

export function AiOperatorConsole() {
  const router = useRouter();
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OperatorResponse | null>(null);
  const [harm, setHarm] = useState<unknown>(null);

  async function runOperator(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/operator/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective, forceShadow: true }),
      });
      const body = (await res.json().catch(() => ({}))) as OperatorResponse;
      if (!res.ok) {
        setError(body.message ?? `HTTP ${res.status}`);
        return;
      }
      setResult(body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operator run failed');
    } finally {
      setBusy(false);
    }
  }

  async function runHarmonize() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/harmonize`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { message?: string }).message ?? `HTTP ${res.status}`);
        return;
      }
      setHarm(body);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Harmonization failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-console">
      <form className="card tool-form" style={{ maxWidth: '100%' }} onSubmit={(e) => void runOperator(e)}>
        <label>
          Objective (natural language)
          <textarea
            name="objective"
            rows={4}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            required
          />
        </label>
        <div className="terminal-toolbar">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Operator running…' : 'Run AI operator (shadow)'}
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => void runHarmonize()}>
            Resolve product identities
          </button>
        </div>
        <p className="meta">
          Shadow by default: real calculations + recommendations, consequential actions go to
          approvals. Fixture-sourced rows are labeled — never claimed as live marketplace data.
        </p>
      </form>

      {error ? <p className="form-error">{error}</p> : null}

      {result ? (
        <div className="detail-grid" style={{ marginTop: 16 }}>
          <article className="panel">
            <h2>Decision</h2>
            <ul className="kv">
              <li>
                <span>Run</span>
                <strong>{result.runId}</strong>
              </li>
              <li>
                <span>Loop mode</span>
                <strong>{result.loopMode}</strong>
              </li>
              <li>
                <span>Decision</span>
                <strong>{result.decision}</strong>
              </li>
            </ul>
            <p className="meta">{result.decisionNote}</p>
            {result.honesty?.note ? <p className="meta">{result.honesty.note}</p> : null}
          </article>
          <article className="panel">
            <h2>Plan</h2>
            <p className="meta">{result.plan?.interpretation}</p>
            <ol className="meta">
              {(result.plan?.steps ?? []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </article>
          <article className="panel">
            <h2>Critic</h2>
            <p>
              Severity: <strong>{result.critic?.severity ?? '—'}</strong>
            </p>
            <p className="meta">{result.critic?.notes}</p>
            {(result.critic?.issues ?? []).length > 0 ? (
              <ul className="meta">
                {result.critic!.issues!.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : null}
          </article>
          <article className="panel">
            <h2>Auditor</h2>
            <p className="meta">{result.auditor?.notes}</p>
            <ul className="kv">
              <li>
                <span>Calculation</span>
                <strong>{String(result.auditor?.calculationOk)}</strong>
              </li>
              <li>
                <span>Policy</span>
                <strong>{String(result.auditor?.policyOk)}</strong>
              </li>
            </ul>
          </article>
          <article className="panel wide">
            <h2>Recommendations</h2>
            {(result.recommendations ?? []).length === 0 ? (
              <p className="meta">No recommendations (filters/policy may have blocked all SKUs).</p>
            ) : (
              <table className="scanner-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Confidence</th>
                    <th>Policy risk</th>
                    <th>Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {result.recommendations!.map((r) => (
                    <tr key={`${r.rank}-${r.title}`}>
                      <td>{r.rank}</td>
                      <td>
                        <strong>{r.title}</strong>
                        <div className="meta">{r.rationale}</div>
                      </td>
                      <td>{(r.confidence * 100).toFixed(0)}%</td>
                      <td>{r.policyRiskScore}</td>
                      <td>{r.approvalRequired ? 'required' : 'optional'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </div>
      ) : null}

      {harm ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Identity resolution</h2>
          <pre className="tool-result">{JSON.stringify(harm, null, 2)}</pre>
        </article>
      ) : null}
    </div>
  );
}
