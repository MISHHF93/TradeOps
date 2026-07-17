'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

export type CommerceStateClient = {
  caseId: string;
  productId: string;
  productTitle?: string;
  currentState: string;
  stageStatus: string;
  targetState: string;
  distanceToTarget: number;
  operationalFriction: number;
  executionReadiness: number;
  businessRisk: number;
  confidenceScore: number;
  opportunityScore: number;
  estimatedBusinessValueMinor: number | null;
  missingInformation: string[];
  blockers: Array<{ code: string; message: string; severity: string }>;
  recommendedTransformation: {
    code: string;
    label: string;
    description: string;
    score: number;
    estimatedFrictionDrop: number;
    aiCanPerform: boolean;
    approvalRequired: boolean;
    href: string;
    reason: string;
  } | null;
  rankedTransformations: Array<{
    code: string;
    label: string;
    score: number;
    href: string;
    aiCanPerform: boolean;
    approvalRequired: boolean;
  }>;
  screen: {
    whereAmI: string;
    currentStateLabel: string;
    evidence: string[];
    preventingCompletion: string[];
    optimalNext: string;
    aiCanPerform: boolean;
    businessValueHint: string;
  };
  friction: {
    totalFriction: number;
    topDrivers: string[];
    matchNote: string;
    matched: boolean;
  };
  matching: {
    alignmentScore: number;
    executable: boolean;
    note: string;
    sequence: string[];
  };
};

/**
 * State-centric panel: Where am I? What's blocking? Optimal next transform?
 */
export function CommerceStatePanel({
  state,
  compact,
}: {
  state: CommerceStateClient;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function apply(code: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/commerce/runtime/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: state.caseId,
          transformation: code,
          source: 'user',
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        frictionDelta?: number;
        applied?: string;
      };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      setMsg(
        `Applied ${body.applied ?? code}` +
          (body.frictionDelta != null ? ` · friction Δ ${body.frictionDelta}` : ''),
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Transform failed');
    } finally {
      setBusy(false);
    }
  }

  const rec = state.recommendedTransformation;

  return (
    <article className="panel" style={{ marginBottom: compact ? 12 : 16 }}>
      <h2 style={{ marginTop: 0 }}>Case state</h2>
      <p className="meta" style={{ marginTop: 0 }}>
        {state.screen.whereAmI} · target <strong>{state.targetState}</strong> · remaining{' '}
        {(state.distanceToTarget * 100).toFixed(0)}%
      </p>

      <ul className="kv">
        <li>
          <span>Friction</span>
          <strong>{state.operationalFriction.toFixed(0)}/100</strong>
        </li>
        <li>
          <span>Execution readiness</span>
          <strong>{state.executionReadiness}/100</strong>
        </li>
        <li>
          <span>Alignment</span>
          <strong>{state.matching.alignmentScore}/100</strong>
        </li>
        <li>
          <span>Business risk</span>
          <strong>{state.businessRisk}/100</strong>
        </li>
        <li>
          <span>Confidence</span>
          <strong>{state.confidenceScore}%</strong>
        </li>
        <li>
          <span>Opportunity</span>
          <strong>{state.opportunityScore}</strong>
        </li>
      </ul>

      <p className="meta">{state.friction.matchNote}</p>
      <p className="meta">{state.matching.note}</p>

      {state.blockers.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <strong>Blockers</strong>
          <ul>
            {state.blockers.map((b) => (
              <li key={b.code}>
                [{b.severity}] {b.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && state.missingInformation.length > 0 ? (
        <p className="meta">
          Missing: {state.missingInformation.slice(0, 8).join(', ')}
        </p>
      ) : null}

      {rec ? (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Next step</h3>
          <p style={{ margin: 0 }}>
            <strong>{rec.label}</strong> · score {rec.score}
            {rec.approvalRequired ? ' · approval required' : ''}
            {rec.aiCanPerform ? ' · AI can assist' : ' · human / connector'}
          </p>
          <p className="meta">{rec.description}</p>
          <p className="meta">{rec.reason}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void apply(rec.code)}
            >
              {busy ? 'Applying…' : 'Apply next step'}
            </button>
            <Link href={rec.href} className="btn secondary">
              Open work surface
            </Link>
            <Link href={`/terminal/ai?caseId=${state.caseId}`} className="btn ghost">
              AI on this case
            </Link>
          </div>
        </div>
      ) : null}

      {!compact && state.rankedTransformations.length > 1 ? (
        <div style={{ marginTop: 12 }}>
          <h3>Ranked transformations</h3>
          <ol style={{ paddingLeft: 18 }}>
            {state.rankedTransformations.map((t) => (
              <li key={t.code} style={{ marginBottom: 6 }}>
                <Link href={t.href}>
                  {t.label}
                </Link>{' '}
                <span className="meta">
                  score {t.score}
                  {t.aiCanPerform ? ' · AI' : ''}
                  {t.approvalRequired ? ' · approval' : ''}
                </span>
                <button
                  type="button"
                  className="button ghost"
                  style={{ marginLeft: 8, fontSize: '0.75rem' }}
                  disabled={busy}
                  onClick={() => void apply(t.code)}
                >
                  Apply
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {msg ? <p className="meta">{msg}</p> : null}
      {err ? <p className="form-error">{err}</p> : null}

      <p className="meta" style={{ marginTop: 12 }}>
        {state.screen.businessValueHint}
      </p>
    </article>
  );
}
