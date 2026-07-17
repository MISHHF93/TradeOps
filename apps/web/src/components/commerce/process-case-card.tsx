import Link from 'next/link';
import {
  PROCESS_LABELS,
  caseHref,
  stageStatusLabel,
  stageTitle,
} from '../../lib/process-ux';

export type ProcessCaseCardModel = {
  id: string;
  productTitle?: string;
  productId?: string;
  currentStage: string;
  stageStatus: string;
  opportunityScore?: number | null;
  expectedProfitLabel?: string | null;
  nextActionLabel?: string | null;
  nextHref?: string | null;
  blockerMessage?: string | null;
  friction?: number | null;
  readiness?: number | null;
};

/**
 * Unified case card for Process board, cockpit, and priority queues.
 */
export function ProcessCaseCard({
  case: c,
  compact,
}: {
  case: ProcessCaseCardModel;
  compact?: boolean;
}) {
  const blocked = c.stageStatus === 'blocked' || Boolean(c.blockerMessage);
  const href = caseHref(c.id);

  return (
    <li
      className={`process-case-card${blocked ? ' is-blocked' : ''}${compact ? ' is-compact' : ''}`}
    >
      <div className="process-case-card__head">
        <Link href={href} className="process-case-card__title">
          {c.productTitle ?? c.productId?.slice(0, 8) ?? c.id.slice(0, 8)}
        </Link>
        <span className="process-case-card__stage">
          {stageTitle(c.currentStage)}
          <span className="meta"> · {stageStatusLabel(c.stageStatus)}</span>
        </span>
      </div>

      {!compact ? (
        <p className="process-case-card__meta meta">
          {c.opportunityScore != null ? `Score ${c.opportunityScore}` : null}
          {c.opportunityScore != null && c.expectedProfitLabel ? ' · ' : null}
          {c.expectedProfitLabel ?? null}
          {c.friction != null ? ` · Friction ${Math.round(c.friction)}` : null}
          {c.readiness != null ? ` · Ready ${c.readiness}` : null}
        </p>
      ) : null}

      {c.blockerMessage ? (
        <p className="form-error process-case-card__blocker">{c.blockerMessage}</p>
      ) : null}

      <p className="process-case-card__next meta">
        {PROCESS_LABELS.nextStep}: {c.nextActionLabel ?? '—'}
      </p>

      <div className="process-case-card__actions">
        <Link className="btn ghost process-case-card__btn" href={href}>
          {PROCESS_LABELS.openCase}
        </Link>
        {c.nextHref ? (
          <Link className="btn secondary process-case-card__btn" href={c.nextHref}>
            {PROCESS_LABELS.nextStep}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
