import Link from 'next/link';
import { PROCESS_LABELS } from '../../lib/process-ux';

/**
 * Process-aware empty state — always teaches the next operational step.
 */
export function ProcessEmptyState({
  title,
  body,
  stage,
  primaryHref,
  primaryLabel,
  secondaryHref = '/terminal/process',
  secondaryLabel = PROCESS_LABELS.openProcess,
}: {
  title: string;
  body: string;
  stage?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <article className="panel process-empty-state">
      {stage ? <p className="pill">Stage · {stage}</p> : null}
      <h2>{title}</h2>
      <p className="lede">{body}</p>
      <div className="cta-row process-empty-state__actions">
        <Link className="btn primary" href={primaryHref}>
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link className="btn ghost" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
