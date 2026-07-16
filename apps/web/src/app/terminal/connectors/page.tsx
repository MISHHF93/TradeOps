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
      <h1>Connectors</h1>
      <p className="lede">
        Capability-based integrations. Fixture connectors are labeled FIXTURE and do not claim live
        marketplace credentials.
      </p>
      {!result.ok ? <p className="form-error">{result.error}</p> : null}
      <table className="scanner-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Family</th>
            <th>Status</th>
            <th>Fixture</th>
            <th>Capabilities</th>
            <th>Last health</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.providerKey}>
              <td>{c.displayName}</td>
              <td>{c.family}</td>
              <td>{c.status}</td>
              <td>{c.isFixture ? 'YES — DEV' : 'no'}</td>
              <td className="caps">{(c.capabilities as unknown as string[]).join?.(', ') ?? JSON.stringify(c.capabilities)}</td>
              <td>{c.lastHealthAt ? new Date(c.lastHealthAt).toLocaleString() : '—'}</td>
              <td>{c.lastError ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
