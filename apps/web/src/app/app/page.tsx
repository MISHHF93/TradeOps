import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoutButton } from '../../components/auth-forms';
import { FounderMenu } from '../../components/founder-menu';
import { WorkspaceSwitcher } from '../../components/forms/workspace-switcher';
import { OrgSwitcher } from '../../components/org-switcher';
import { StatusBadge } from '../../components/status-badge';
import { fetchApiHealth } from '../../lib/api';
import { FOUNDER_WORKSPACE_PATH, getAccessMode, isFounderDirectAccess } from '../../lib/access-mode';
import { noIndexMeta } from '../../lib/seo';
import { getServerSession } from '../../lib/session';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Workspace',
};

export default async function AppHomePage() {
  const [session, health] = await Promise.all([getServerSession(), fetchApiHealth()]);
  const founder = isFounderDirectAccess();
  const mode = getAccessMode();

  return (
    <section className="hero">
      <div className="app-header">
        <div>
          <p className="pill">
            {founder ? 'Founder workspace · direct access' : 'Authenticated workspace'}
          </p>
          <h1>Operations console</h1>
          <p className="lede">
            {session ? (
              <>
                Running as <strong>{session.user.displayName}</strong> ({session.user.email})
              </>
            ) : founder ? (
              <>
                Direct Founder Access active — identity is resolved server-side without a login form.
              </>
            ) : (
              <>
                No session. <Link href="/login">Sign in</Link> or{' '}
                <Link href="/register">register</Link>.
              </>
            )}
          </p>
        </div>
        <div className="app-actions">
          {session && !founder ? (
            <>
              <OrgSwitcher
                memberships={session.memberships}
                activeOrganizationId={session.activeOrganization?.id ?? null}
              />
              <WorkspaceSwitcher activeWorkspaceId={session.activeWorkspaceId ?? null} />
            </>
          ) : null}
          <Link className="btn primary" href={FOUNDER_WORKSPACE_PATH}>
            Open terminal
          </Link>
          {founder ? (
            <FounderMenu
              email={session?.user.email}
              orgName={session?.activeOrganization?.name}
            />
          ) : session ? (
            <LogoutButton />
          ) : null}
        </div>
      </div>

      <p className="meta">
        Access mode: <code>{mode}</code>. Tenant isolation (membership-validated) and audit
        ownership apply.{' '}
        <StatusBadge status="operational" /> when API healthy.
      </p>

      <div className="grid">
        <article className="card">
          <h2>Active organization</h2>
          {session?.activeOrganization ? (
            <>
              <p>
                <strong>{session.activeOrganization.name}</strong>
              </p>
              <p className="meta">
                slug <code>{session.activeOrganization.slug}</code> · role{' '}
                <strong>{session.activeRole}</strong>
              </p>
              <p className="meta">Permissions: {session.permissions.join(', ') || 'none'}</p>
            </>
          ) : founder ? (
            <p className="meta">
              Founder org loads via direct identity on API calls. Open the terminal if labels look
              empty after a cold start.
            </p>
          ) : (
            <p className="meta">No organization loaded.</p>
          )}
        </article>

        <article className="card">
          <h2>Billing &amp; finance</h2>
          <p className="meta">
            SaaS subscription (you pay TradeOps) is separate from channel shopper payments.
          </p>
          <p>
            <Link href="/app/billing">SaaS billing</Link>
            {' · '}
            <Link href="/terminal/finance/payments">Channel payments</Link>
            {' · '}
            <Link href="/terminal/finance/payouts">Payouts</Link>
            {' · '}
            <Link href="/terminal/finance/reconciliation">Reconciliation</Link>
          </p>
        </article>

        <article className="card">
          <h2>Platform health</h2>
          {health.ok ? (
            <>
              <div className="status-row">
                <StatusBadge
                  status={health.data.status === 'up' ? 'operational' : 'credential_blocked'}
                />
                <span className="meta">{health.data.status}</span>
              </div>
            </>
          ) : (
            <p className="form-error">{health.error}</p>
          )}
        </article>

        <article className="card">
          <h2>Access mode</h2>
          <p>
            <code>{mode}</code>
          </p>
          <p className="meta">
            Restore multi-user login later with{' '}
            <code>TRADEOPS_ACCESS_MODE=authenticated</code>. Auth models and RBAC remain in the
            codebase.
          </p>
        </article>

        <article className="card">
          <h2>Connectors</h2>
          <p className="meta">
            External OAuth/API credentials still required for live marketplaces. Founder identity
            owns connector installations — tokens never render in the browser.
          </p>
          <Link href="/terminal/connectors">Connector registry →</Link>
        </article>
      </div>
    </section>
  );
}
