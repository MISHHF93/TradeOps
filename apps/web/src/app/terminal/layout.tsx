import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LogoutButton } from '../../components/auth-forms';
import { FounderMenu } from '../../components/founder-menu';
import { TerminalShell } from '../../components/layout/terminal-shell';
import { getAccessMode, isFounderDirectAccess } from '../../lib/access-mode';
import { noIndexMeta } from '../../lib/seo';
import { getServerSession } from '../../lib/session';
import { terminalGet } from '../../lib/terminal-api';
import type { ResolvedWorkspace } from '../../lib/workspace';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Terminal',
};

/**
 * Persona-driven shell: resolve workspace → dynamic sidebar + AI context.
 */
export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  const founder = isFounderDirectAccess();
  const mode = getAccessMode();

  const tenant = await terminalGet<{
    membership?: { workspacePersona?: string; role?: string };
    organization?: { segment?: string; planTier?: string; name?: string };
  }>('/api/v1/saas/tenant');

  const workspaceRes = await terminalGet<ResolvedWorkspace>('/api/v1/workspace');
  const workspace = workspaceRes.ok ? workspaceRes.data : null;

  const connectors = await terminalGet<Array<{ status?: string; isFixture?: boolean }>>(
    '/api/v1/connectors',
  );

  let connectorSummary = 'No connectors';
  if (connectors.ok && Array.isArray(connectors.data)) {
    const rows = connectors.data;
    const liveHealthy = rows.filter(
      (c) =>
        !c.isFixture &&
        (c.status === 'connected' || String(c.status).includes('sync')),
    ).length;
    const fixture = rows.filter((c) => c.isFixture).length;
    const needsCreds = rows.filter(
      (c) =>
        !c.isFixture &&
        (c.status === 'not_configured' ||
          c.status === 'credentials_required' ||
          String(c.status).includes('expir')),
    ).length;
    const parts: string[] = [];
    if (liveHealthy > 0) parts.push(`${liveHealthy} live healthy`);
    if (needsCreds > 0) parts.push(`${needsCreds} need credentials`);
    if (fixture > 0) parts.push(`${fixture} TEST FIXTURE`);
    if (parts.length === 0) parts.push(`${rows.length} installed`);
    connectorSummary = parts.join(' · ');
  }

  const orgName =
    session?.activeOrganization?.name ??
    workspace?.organizationName ??
    (tenant.ok ? tenant.data.organization?.name : null) ??
    (founder ? 'TradeOps Founder Workspace' : 'No org');
  const email =
    session?.user.email ??
    workspace?.userEmail ??
    (founder ? 'founder@tradeops.local' : 'No session');
  const role =
    session?.activeRole ??
    (tenant.ok ? tenant.data.membership?.role : null) ??
    (founder ? 'owner' : '—');

  return (
    <TerminalShell
      founderDirect={founder}
      orgName={orgName}
      email={email}
      role={String(role)}
      segment={tenant.ok ? tenant.data.organization?.segment : undefined}
      planTier={tenant.ok ? tenant.data.organization?.planTier : undefined}
      accessMode={mode}
      connectorSummary={connectorSummary}
      workspace={workspace}
      founderSlot={
        founder ? <FounderMenu email={email} orgName={orgName} /> : undefined
      }
      logoutSlot={!founder ? <LogoutButton /> : undefined}
    >
      {children}
    </TerminalShell>
  );
}
