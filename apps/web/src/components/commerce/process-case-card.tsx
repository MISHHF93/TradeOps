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
  primaryImageUrl?: string | null;
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
 * Shows product thumbnail when media is available.
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
  const title = c.productTitle ?? c.productId?.slice(0, 8) ?? c.id.slice(0, 8);

  return (
    <li
      className={`process-case-card${blocked ? ' is-blocked' : ''}${compact ? ' is-compact' : ''}${
        c.primaryImageUrl ? ' has-thumb' : ''
      }`}
    >
      <div className="process-case-card__body">
        {c.primaryImageUrl ? (
          <Link href={href} className="process-case-card__thumb" tabIndex={-1} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.primaryImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </Link>
        ) : (
          <div className="process-case-card__thumb process-case-card__thumb--empty" aria-hidden>
            <span>{(title || '?').slice(0, 1).toUpperCase()}</span>
          </div>
        )}

        <div className="process-case-card__main">
          <div className="process-case-card__head">
            <Link href={href} className="process-case-card__title">
              {title}
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
            <p className="process-case-card__blocker meta" role="status">
              {c.blockerMessage}
            </p>
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
        </div>
      </div>
    </li>
  );
}
