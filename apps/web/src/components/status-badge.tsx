import type { ReactNode } from 'react';

export type CapStatus =
  | 'operational'
  | 'approval_controlled'
  | 'credential_blocked'
  | 'coming_soon'
  | 'administrative'
  | 'unsupported';

const LABELS: Record<CapStatus, string> = {
  operational: 'Operational',
  approval_controlled: 'Approval-controlled',
  credential_blocked: 'Credential-blocked',
  coming_soon: 'Coming soon',
  administrative: 'Administrative',
  unsupported: 'Unsupported',
};

export function StatusBadge({ status }: { status: CapStatus }) {
  return <span className={`cap-badge cap-${status}`}>{LABELS[status]}</span>;
}

export function StatusLegend() {
  return (
    <div className="cap-legend">
      {(Object.keys(LABELS) as CapStatus[]).map((s) => (
        <span key={s} className="cap-legend-item">
          <StatusBadge status={s} />
        </span>
      ))}
    </div>
  );
}

export function ActionLabel({
  status,
  children,
}: {
  status: CapStatus;
  children: ReactNode;
}) {
  return (
    <span className="action-label">
      {children} <StatusBadge status={status} />
    </span>
  );
}
