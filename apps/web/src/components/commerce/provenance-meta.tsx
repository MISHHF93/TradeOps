/**
 * Provenance chip — every KPI must show origin or be explicitly unavailable.
 */

export type ProvenanceView = {
  origin?: string;
  sourceLabel?: string;
  sourceConnector?: string | null;
  observedAt?: string;
  syncStatus?: string;
  confidence?: number;
  lineage?: string;
  isLiveOperational?: boolean;
  simulationLabel?: string | null;
  refreshHint?: string | null;
};

export function ProvenanceMeta({
  provenance,
  compact,
}: {
  provenance?: ProvenanceView | null;
  compact?: boolean;
}) {
  if (!provenance) return null;

  const sim = provenance.simulationLabel;
  const unavailable = provenance.origin === 'unavailable' || provenance.isLiveOperational === false;

  return (
    <div className={`provenance-meta${compact ? ' is-compact' : ''}`}>
      {sim ? (
        <p className="pill provenance-sim" style={{ margin: '4px 0' }}>
          {sim}
        </p>
      ) : null}
      <p className="meta" style={{ margin: '2px 0 0', fontSize: 11 }}>
        Source: {provenance.sourceLabel ?? provenance.origin ?? '—'}
        {provenance.sourceConnector ? ` · ${provenance.sourceConnector}` : ''}
        {provenance.syncStatus ? ` · ${provenance.syncStatus}` : ''}
        {typeof provenance.confidence === 'number'
          ? ` · conf ${(provenance.confidence * 100).toFixed(0)}%`
          : ''}
      </p>
      {!compact && provenance.lineage ? (
        <p className="meta" style={{ margin: '2px 0 0', fontSize: 10 }}>
          Lineage: {provenance.lineage}
        </p>
      ) : null}
      {!compact && provenance.observedAt ? (
        <p className="meta" style={{ margin: '2px 0 0', fontSize: 10 }}>
          Observed: {new Date(provenance.observedAt).toLocaleString()}
        </p>
      ) : null}
      {unavailable && provenance.refreshHint ? (
        <p className="meta" style={{ margin: '4px 0 0', fontSize: 11 }}>
          {provenance.refreshHint}
        </p>
      ) : null}
    </div>
  );
}

export function LiveEmptyState({
  title,
  reason,
  actionHref,
  actionLabel,
}: {
  title: string;
  reason: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="live-empty-state">
      <p className="pill">Data unavailable</p>
      <strong>{title}</strong>
      <p className="meta">{reason}</p>
      {actionHref && actionLabel ? (
        <p>
          <a href={actionHref}>{actionLabel}</a>
        </p>
      ) : null}
    </div>
  );
}

export function SimulationBanner({ active }: { active?: boolean }) {
  if (!active) return null;
  return (
    <p className="pill" style={{ marginBottom: 12 }}>
      SIMULATION MODE — values may include fixture or modeled data. Not live production commerce.
    </p>
  );
}
