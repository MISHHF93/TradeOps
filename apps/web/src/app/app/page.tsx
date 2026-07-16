import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoutButton } from '../../components/auth-forms';
import { OrgSwitcher } from '../../components/org-switcher';
import { StatusBadge } from '../../components/status-badge';
import { fetchApiHealth } from '../../lib/api';
import { noIndexMeta } from '../../lib/seo';
import { getServerSession } from '../../lib/session';

export const metadata: Metadata = {
  ...noIndexMeta,
  title: 'Workspace',
};

export default async function AppHomePage() {
  const [session, health] = await Promise.all([getServerSession(), fetchApiHealth()]);

  return (
    <section className="hero">
      <div className="app-header">
        <div>
          <p className="pill">Authenticated workspace</p>
          <h1>Operations console</h1>
          <p className="lede">
            {session ? (
              <>
                Running as <strong>{session.user.displayName}</strong> ({session.user.email})
              </>
            ) : (
              <>
                No session. <Link href="/login">Sign in</Link> or{' '}
                <Link href="/register">register</Link>. Local dev may use{' '}
                <code>AUTH_BYPASS=true</code> after <code>setup:db</code>.
              </>
            )}
          </p>
        </div>
        <div className="app-actions">
          {session ? (
            <OrgSwitcher
              memberships={session.memberships}
              activeOrganizationId={session.activeOrganization?.id ?? null}
            />
          ) : null}
          <Link className="btn primary" href="/terminal">
            Open terminal
          </Link>
          {session ? <LogoutButton /> : null}
        </div>
      </div>

      <p className="meta">
        Public website is separate at <Link href="/">/</Link>. This surface holds private org data.{' '}
        <StatusBadge status="operational" /> when session/API healthy.
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
          ) : (
            <p className="meta">No organization loaded (seed the database for demo data).</p>
          )}
        </article>

        <article className="card">
          <h2>Platform health</h2>
          {health.ok ? (
            <>
              <div className="status-row">
                <span className={`badge ${health.data.status}`}>{health.data.status}</span>
              </div>
              <ul className="dep-list">
                {health.data.dependencies.map((dep) => (
                  <li key={dep.name}>
                    <strong>{dep.name}</strong>
                    <span>
                      {dep.status}
                      {typeof dep.latencyMs === 'number' ? ` · ${dep.latencyMs}ms` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="form-error">{health.error}</p>
          )}
        </article>

        <article className="card">
          <h2>Auth modes</h2>
          <p>
            Production: session cookies via <Link href="/login">sign in</Link> /{' '}
            <Link href="/register">register</Link>. Local development may also use{' '}
            <code>AUTH_BYPASS</code> (forced off when <code>NODE_ENV=production</code>).
          </p>
          <p className="meta">
            <Link href="/status">Capability status →</Link>
          </p>
        </article>
      </div>
    </section>
  );
}
