import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LogoutButton } from '../../components/auth-forms';
import { SimulationBanner } from '../../components/commerce/provenance-meta';
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

  const tenancyCtx = await terminalGet<{
    organizationSlug?: string;
    organizationName?: string;
    workspaceSlug?: string;
    workspaceName?: string;
    commerceMode?: string;
    tenantId?: string;
    role?: string;
  }>('/api/v1/tenancy/context');

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
    (tenancyCtx.ok ? tenancyCtx.data.organizationName : null) ??
    workspace?.organizationName ??
    (tenant.ok ? tenant.data.organization?.name : null) ??
    (founder ? 'TradeOps Founder Workspace' : 'No org');
  const email =
    session?.user.email ??
    workspace?.userEmail ??
    (founder ? 'founder@tradeops.local' : 'No session');
  const role =
    session?.activeRole ??
    (tenancyCtx.ok ? tenancyCtx.data.role : null) ??
    (tenant.ok ? tenant.data.membership?.role : null) ??
    (founder ? 'owner' : '—');
  const tenantLabel =
    (tenancyCtx.ok ? tenancyCtx.data.organizationSlug : null) ??
    (tenancyCtx.ok && tenancyCtx.data.tenantId
      ? tenancyCtx.data.tenantId.slice(0, 8)
      : null);
  const workspaceLabel =
    (tenancyCtx.ok ? tenancyCtx.data.workspaceName || tenancyCtx.data.workspaceSlug : null) ??
    null;
  const commerceMode = tenancyCtx.ok ? tenancyCtx.data.commerceMode ?? null : null;

  const simulationMode =
    process.env.TRADEOPS_SIMULATION_MODE === '1' ||
    process.env.NEXT_PUBLIC_TRADEOPS_SIMULATION_MODE === '1';

  // Production workspace honesty: any installed fixture connector is labeled
  const hasFixtureConnectors =
    connectors.ok &&
    Array.isArray(connectors.data) &&
    connectors.data.some((c) => c.isFixture);

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
      tenantLabel={tenantLabel}
      workspaceLabel={workspaceLabel}
      commerceMode={commerceMode}
      founderSlot={
        founder ? <FounderMenu email={email} orgName={orgName} /> : undefined
      }
      logoutSlot={!founder ? <LogoutButton /> : undefined}
    >
      <SimulationBanner active={simulationMode} />
      {hasFixtureConnectors && !simulationMode ? (
        <p className="pill" style={{ margin: '0 0 12px' }}>
          TEST FIXTURE connectors installed — fixture products/orders are labeled and are not live
          marketplace data. Set TRADEOPS_SIMULATION_MODE=1 to mark the whole workspace as Simulation.
        </p>
      ) : null}
      {children}
    </TerminalShell>
  );
}
