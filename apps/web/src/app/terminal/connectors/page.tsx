import { ConnectorStatus } from '../../../components/connectors/connector-status';
import { terminalGet } from '../../../lib/terminal-api';

export default async function ConnectorsPage() {
  const result = await terminalGet<
    Array<{
      providerKey: string;
      displayName: string;
      family: string;
      isFixture: boolean;
      status: string;
      capabilities: string[];
      lastHealthAt: string | null;
      lastError: string | null;
    }>
  >('/api/v1/connectors');

  const rows = result.ok ? result.data : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1 className="workspace-title-active">Connectors</h1>
          <p className="lede">
            Neutral cards with status indicators only. Accent marks connection/sync — never paints
            every connector cyan. Fixture sources stay labeled.
          </p>
        </div>
      </header>
      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      <div className="grid connector-grid">
        {rows.map((c) => {
          const s = String(c.status).toLowerCase();
          const linked = s === 'connected' || s.includes('sync');
          return (
          <article
            key={c.providerKey}
            className={`card connector-card ${linked ? 'connector-linked' : ''}`}
          >
            <div className="connector-card-head">
              <strong>{c.displayName}</strong>
              <ConnectorStatus status={c.status} />
            </div>
            <p className="meta" style={{ margin: '8px 0' }}>
              {c.family}
              {c.isFixture ? ' · FIXTURE' : ''}
            </p>
            <p className="meta" style={{ margin: 0, fontSize: '0.75rem' }}>
              {(c.capabilities as unknown as string[])?.join?.(', ') ??
                JSON.stringify(c.capabilities)}
            </p>
            <p className="meta" style={{ margin: '8px 0 0', fontSize: '0.7rem' }}>
              Health:{' '}
              {c.lastHealthAt ? new Date(c.lastHealthAt).toLocaleString() : '—'}
              {c.lastError ? ` · ${c.lastError}` : ''}
            </p>
          </article>
          );
        })}
      </div>
    </section>
  );
}
