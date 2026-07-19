'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import { ProcessAdvanceButton } from './process-actions';

type CaseSummary = {
  case: {
    id: string;
    currentStage: string;
    stageStatus: string;
    nextActionLabel?: string | null;
    nextHref?: string;
    journeyHref?: string;
    blockerMessage?: string | null;
  };
  handoffLabel?: string;
  nextHref?: string;
};

const NEXT_STAGE: Record<string, string> = {
  discover: 'evaluate',
  evaluate: 'qualify',
  qualify: 'prepare',
  prepare: 'approve',
  approve: 'publish',
  publish: 'sell',
  sell: 'source',
  source: 'fulfill',
  fulfill: 'reconcile',
  reconcile: 'learn',
  learn: 'closed',
};

/**
 * Process handoff strip — loads CommerceCase for a product and offers next-stage action.
 */
export function CaseHandoff({ productId }: { productId: string }) {
  const [data, setData] = useState<CaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/v1/commerce/cases/by-product/${productId}`,
          { credentials: 'include', headers: { Accept: 'application/json' } },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
        }
        if (!cancelled) setData(body as CaseSummary);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Case load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (error) {
    return (
      <p className="meta" style={{ marginTop: 12 }}>
        Process: {error}. Open <Link href="/terminal/process">Commerce Process</Link> to resync.
      </p>
    );
  }
  if (!data?.case) {
    return <p className="meta">Loading commerce case…</p>;
  }

  const c = data.case;
  const next = NEXT_STAGE[c.currentStage];
  /** Case object workspace is the primary OS surface */
  const journey = `/terminal/process/${c.id}`;

  return (
    <article className="panel wide" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Commerce Case (system of record)</h2>
      <p className="meta" style={{ margin: '0 0 8px' }}>
        Stage <strong>{c.currentStage}</strong> · {c.stageStatus}
        {c.blockerMessage ? ` · blocker: ${c.blockerMessage}` : ''}
      </p>
      <p style={{ margin: '0 0 12px' }}>
        Next action: <strong>{c.nextActionLabel ?? '—'}</strong>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Link className="btn primary" href={journey}>
          Open case workspace
        </Link>
        <Link className="btn ghost" href={`/terminal/objectives?caseId=${encodeURIComponent(c.id)}`}>
          AI on this case
        </Link>
        {c.nextHref ? (
          <Link className="btn ghost" href={c.nextHref}>
            Go to next destination
          </Link>
        ) : null}
        {next && !c.blockerMessage ? (
          <ProcessAdvanceButton
            caseId={c.id}
            toStage={next}
            label={data.handoffLabel || `Advance → ${next}`}
          />
        ) : null}
      </div>
    </article>
  );
}
