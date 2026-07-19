import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../../components/commerce/process-chrome';
import { terminalGet } from '../../../../lib/terminal-api';

export default async function IndustrialTwinPage() {
  const twin = await terminalGet<{
    nodes?: Array<{ id: string; kind: string; label: string; isFixture?: boolean }>;
    edges?: Array<{ id: string; kind: string; from: string; to: string }>;
    summary?: {
      nodeCounts?: Record<string, number>;
      edgeCounts?: Record<string, number>;
      fixtureNodes?: number;
    };
    honesty?: { note: string };
  }>('/api/v1/industrial/twin');

  return (
    <section>
      <ProcessPageHeader
        pill="Digital twin"
        title="Operational digital twin"
        lede="Products, suppliers, inventory, POs, orders, and artifacts as a relationship graph for AI reasoning."
        breadcrumbs={[
          { href: '/terminal/industrial', label: 'Industrial' },
          { label: 'Twin' },
        ]}
      />
      <ProcessRelatedLinks primary="process" />

      {!twin.ok ? (
        <p className="form-error">{twin.error}</p>
      ) : (
        <>
          <div className="detail-grid">
            <article className="panel">
              <h2>Node counts</h2>
              <ul className="kv">
                {Object.entries(twin.data.summary?.nodeCounts ?? {}).map(([k, v]) => (
                  <li key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </li>
                ))}
                <li>
                  <span>Fixture nodes</span>
                  <strong>{twin.data.summary?.fixtureNodes ?? 0}</strong>
                </li>
              </ul>
            </article>
            <article className="panel">
              <h2>Edge counts</h2>
              <ul className="kv">
                {Object.entries(twin.data.summary?.edgeCounts ?? {}).map(([k, v]) => (
                  <li key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="panel" style={{ marginTop: 16 }}>
            <h2>Nodes (sample)</h2>
            <table className="scanner-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Label</th>
                  <th>Id</th>
                </tr>
              </thead>
              <tbody>
                {(twin.data.nodes ?? []).slice(0, 40).map((n) => (
                  <tr key={n.id}>
                    <td>{n.kind}</td>
                    <td>
                      {n.label}
                      {n.isFixture ? <div className="meta">TEST FIXTURE</div> : null}
                    </td>
                    <td>
                      <code>{n.id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {twin.data.honesty?.note ? (
              <p className="meta">{twin.data.honesty.note}</p>
            ) : null}
          </article>

          <p className="meta" style={{ marginTop: 12 }}>
            <Link href="/terminal/industrial">← Industrial home</Link>
          </p>
        </>
      )}
    </section>
  );
}
