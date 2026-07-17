import Link from 'next/link';

export type RuntimeOrgView = {
  answer?: string;
  activeProcess?: {
    label?: string;
    currentState?: string;
    nextTransformation?: string | null;
    status?: string;
    commerceCaseId?: string;
  } | null;
  recommendation?: {
    label?: string;
    transformation?: string;
    href?: string;
    score?: number;
  } | null;
  metrics?: {
    openCases?: number;
    blockedCases?: number;
    pendingApprovals?: number;
    avgFriction?: number;
  };
  personaLabel?: string | null;
};

/**
 * Always answers: "What process is currently executing?"
 */
export function RuntimeBanner({ runtime }: { runtime: RuntimeOrgView | null }) {
  if (!runtime) return null;
  const proc = runtime.activeProcess;
  const rec = runtime.recommendation;

  return (
    <article className="panel runtime-banner" style={{ marginBottom: 16 }}>
      <p className="pill" style={{ marginTop: 0 }}>
        Commerce Runtime{runtime.personaLabel ? ` · ${runtime.personaLabel}` : ''}
      </p>
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>
        {runtime.answer ?? 'Runtime idle'}
      </h2>
      {proc ? (
        <p className="meta" style={{ margin: '4px 0 8px' }}>
          Active: <strong>{proc.label}</strong>
          {proc.status ? ` · ${proc.status}` : ''}
          {proc.nextTransformation ? ` · next ${proc.nextTransformation}` : ''}
        </p>
      ) : null}
      {runtime.metrics ? (
        <ul className="kv">
          <li>
            <span>Open cases</span>
            <strong>{runtime.metrics.openCases ?? 0}</strong>
          </li>
          <li>
            <span>Blocked</span>
            <strong>{runtime.metrics.blockedCases ?? 0}</strong>
          </li>
          <li>
            <span>Approvals</span>
            <strong>{runtime.metrics.pendingApprovals ?? 0}</strong>
          </li>
          <li>
            <span>Avg friction</span>
            <strong>{runtime.metrics.avgFriction ?? 0}</strong>
          </li>
        </ul>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {proc?.commerceCaseId ? (
          <Link className="btn primary" href={`/terminal/process/${proc.commerceCaseId}`}>
            Open active case
          </Link>
        ) : (
          <Link className="btn primary" href="/terminal">
            Start Discover
          </Link>
        )}
        {rec?.href ? (
          <Link className="btn secondary" href={rec.href}>
            Next: {rec.label ?? rec.transformation}
          </Link>
        ) : null}
        <Link className="btn ghost" href="/terminal/tasks">
          Tasks
        </Link>
      </div>
    </article>
  );
}
