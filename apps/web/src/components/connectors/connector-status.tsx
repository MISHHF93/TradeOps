/**
 * Connector visual language (§8)
 * Connected: neutral + small accent indicator
 * Syncing: animated accent line
 * Disconnected: neutral | Expired: warning | Failed: negative
 * Never flood cards with cyan.
 */

export type ConnectorStatusKind =
  | 'connected'
  | 'synchronizing'
  | 'disconnected'
  | 'not_configured'
  | 'expired'
  | 'authorization_expired'
  | 'failed'
  | 'unhealthy'
  | 'permission_limited'
  | 'rate_limited'
  | string;

function normalize(status: string): {
  kind: string;
  label: string;
  className: string;
} {
  const s = status.toLowerCase();
  if (s === 'connected') {
    return { kind: 'connected', label: 'Connected', className: 'conn-status conn-connected' };
  }
  if (s.includes('sync') || s === 'running') {
    return { kind: 'synchronizing', label: 'Synchronizing', className: 'conn-status conn-sync' };
  }
  if (s.includes('expir') || s === 'authorization_expired') {
    return { kind: 'expired', label: 'Expired', className: 'conn-status conn-expired' };
  }
  if (
    s === 'failed' ||
    s === 'unhealthy' ||
    s.includes('error') ||
    s === 'permission_limited' ||
    s === 'rate_limited'
  ) {
    return { kind: 'failed', label: status, className: 'conn-status conn-failed' };
  }
  if (s === 'not_configured' || s === 'disconnected' || s === 'disabled') {
    return { kind: 'disconnected', label: status, className: 'conn-status conn-disconnected' };
  }
  return { kind: 'neutral', label: status, className: 'conn-status conn-disconnected' };
}

export function ConnectorStatus({ status }: { status: ConnectorStatusKind }) {
  const n = normalize(String(status));
  return (
    <span className={n.className} title={n.label}>
      <span className="conn-dot" aria-hidden />
      <span className="conn-label">{n.label}</span>
      {n.kind === 'synchronizing' ? <span className="conn-sync-line" aria-hidden /> : null}
    </span>
  );
}
