import Link from 'next/link';
import { OrgSwitcher } from '../../components/org-switcher';
import { fetchApiHealth } from '../../lib/api';
import { getServerSession } from '../../lib/session';

export default async function AppHomePage() {
  const [session, health] = await Promise.all([getServerSession(), fetchApiHealth()]);

  return (
    <section className="hero">
      <div className="app-header">
        <div>
          <h1>Operations console</h1>
          <p className="lede">
            {session ? (
              <>
                Running as <strong>{session.user.displayName}</strong> ({session.user.email})
              </>
            ) : (
              <>
                No local identity yet. Run <code>pnpm run setup:db</code> with{' '}
                <code>AUTH_BYPASS=true</code>.
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
        </div>
      </div>

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
          <h3>Local mode</h3>
          <p>
            Login and registration are disabled. The API uses auth bypass as the seeded demo owner
            so you can work in the terminal without accounts.
          </p>
          <p className="meta">
            <Link href="/terminal">Commerce terminal</Link>
          </p>
        </article>
      </div>
    </section>
  );
}
