import { WeekendGoogleActions } from '../../../components/weekend-google-actions';
import { terminalGet } from '../../../lib/terminal-api';

export default async function AutomationsPage() {
  const status = await terminalGet<{
    providerKey: string;
    connectorStatus: string;
    hasCredentials: boolean;
    isWeekend: boolean;
    nextWeekendMorning: string;
    lastRunKey: string | null;
    lastResult: {
      mode: string;
      preparedCount: number;
      postedCount: number;
      livePostSucceeded: boolean;
      status: string;
      message: string;
      scheduledFor: string;
      errors: string[];
    } | null;
    schedule: string;
  }>('/api/v1/automation/google/weekend/status');

  const feeds = await terminalGet<{
    feeds: Array<{
      providerKey: string;
      displayName: string;
      family: string;
      docsUrl: string;
      authMode: string;
      isFixture: boolean;
      weekendAutomation: boolean;
      notes: string;
    }>;
  }>('/api/v1/automation/feeds');

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1>Automations</h1>
          <p className="lede">
            Weekend Google Merchant feed preparation and live-feed registry. Shadow mode is the
            default — live posts require authorized OAuth credentials and never fabricate success.
          </p>
        </div>
        <WeekendGoogleActions />
      </header>

      {!status.ok ? <p className="form-error">{status.error}</p> : null}

      {status.ok ? (
        <div className="detail-grid">
          <article className="panel">
            <h2>Google weekend feed</h2>
            <ul className="kv">
              <li>
                <span>Provider</span>
                <strong>{status.data.providerKey}</strong>
              </li>
              <li>
                <span>Connector status</span>
                <strong>{status.data.connectorStatus}</strong>
              </li>
              <li>
                <span>Credentials</span>
                <strong>{status.data.hasCredentials ? 'configured' : 'missing (shadow only)'}</strong>
              </li>
              <li>
                <span>Weekend now</span>
                <strong>{status.data.isWeekend ? 'yes' : 'no'}</strong>
              </li>
              <li>
                <span>Next window</span>
                <strong>{new Date(status.data.nextWeekendMorning).toLocaleString()}</strong>
              </li>
              <li>
                <span>Schedule</span>
                <strong>{status.data.schedule}</strong>
              </li>
              <li>
                <span>Last run</span>
                <strong>{status.data.lastRunKey ?? 'none yet'}</strong>
              </li>
            </ul>
            {status.data.lastResult ? (
              <p className="meta">
                Last result: mode={status.data.lastResult.mode}, prepared=
                {status.data.lastResult.preparedCount}, live=
                {String(status.data.lastResult.livePostSucceeded)} —{' '}
                {status.data.lastResult.message}
              </p>
            ) : null}
          </article>
          <article className="panel">
            <h2>Mode honesty</h2>
            <p>
              <strong>Shadow</strong> prepares a Google Merchant feed and records audit evidence
              without calling Google.
            </p>
            <p>
              <strong>Live</strong> only when <code>GOOGLE_MERCHANT_ACCESS_TOKEN</code> and{' '}
              <code>GOOGLE_MERCHANT_ID</code> are set. Fixture-sourced products are never posted as
              live catalog.
            </p>
          </article>
        </div>
      ) : null}

      <h2>Live-feed registry</h2>
      <p className="lede">
        Official API registry for harmonization targets. Entries are not claims of active
        connection.
      </p>
      {!feeds.ok ? <p className="form-error">{feeds.error}</p> : null}
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Family</th>
            <th>Auth</th>
            <th>Fixture</th>
            <th>Weekend</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {(feeds.ok ? feeds.data.feeds : []).map((f) => (
            <tr key={f.providerKey}>
              <td>
                <strong>{f.displayName}</strong>
                <div className="meta">
                  <a href={f.docsUrl} target="_blank" rel="noreferrer">
                    {f.providerKey}
                  </a>
                </div>
              </td>
              <td>{f.family}</td>
              <td>{f.authMode}</td>
              <td>{f.isFixture ? 'FIXTURE' : 'live-capable'}</td>
              <td>{f.weekendAutomation ? 'yes' : '—'}</td>
              <td className="meta">{f.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
