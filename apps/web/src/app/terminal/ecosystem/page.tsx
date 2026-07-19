import Link from 'next/link';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
import { terminalGet } from '../../../lib/terminal-api';

type Partners = {
  partners: Array<{
    partnerKey: string;
    displayName: string;
    valueCreated: string[];
    status: string;
    honesty?: string;
    metrics: Record<string, unknown>;
  }>;
  ecosystemPrinciple: string;
  honesty: { note: string };
};

type Caps = {
  advertisements: Array<{
    providerKey: string;
    displayName: string;
    family: string;
    isFixture: boolean;
    status: string;
    businessCapabilities: string[];
    notes?: string;
  }>;
  honesty: { note: string };
};

type Graph = {
  nodeCount: number;
  edgeCount: number;
  nodes: Array<{ id: string; type: string; label: string }>;
  honesty: { note: string };
};

type Intel = {
  nextActions: Array<{
    whatHappened: string;
    why: string;
    next: string;
    who: string;
    aiCanAutomate: boolean;
    value: string;
    href: string;
  }>;
  emptyStateEducation: { title: string; body: string; cta: { label: string; href: string } } | null;
};

/**
 * Partner Success + capability + knowledge graph — ecosystem value, not a KPI silo.
 */
export default async function EcosystemPage() {
  const [partners, caps, graph, intel] = await Promise.all([
    terminalGet<Partners>('/api/v1/ecosystem/partners'),
    terminalGet<Caps>('/api/v1/ecosystem/capabilities'),
    terminalGet<Graph>('/api/v1/ecosystem/knowledge-graph'),
    terminalGet<Intel>('/api/v1/ecosystem/intelligence'),
  ]);

  return (
    <TerminalPageFrame
      pill="Platform · ecosystem"
      title="Partner success & knowledge graph"
      lede="TradeOps sits above the commerce ecosystem. Connectors create value for merchants, channels, suppliers, and processors — without competing with Shopify, Amazon, or Stripe."
      relatedPrimary="workspace"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { href: '/terminal/connectors', label: 'Connectors' },
        { label: 'Ecosystem' },
      ]}
      toolbar={
        <>
          <Link className="btn secondary" href="/terminal/process">
            Cases
          </Link>
          <Link className="btn ghost" href="/terminal/connectors">
            Connectors
          </Link>
        </>
      }
    >

      {intel.ok && intel.data.emptyStateEducation ? (
        <ProcessEmptyState
          title={intel.data.emptyStateEducation.title}
          body={intel.data.emptyStateEducation.body}
          stage="discover"
          primaryHref={intel.data.emptyStateEducation.cta.href}
          primaryLabel={intel.data.emptyStateEducation.cta.label}
          secondaryHref="/terminal/process"
          secondaryLabel="Open process"
        />
      ) : null}

      <h2>What should happen next</h2>
      {!intel.ok ? (
        <p className="form-error">{intel.error}</p>
      ) : (
        <div className="detail-grid">
          {intel.data.nextActions.map((a) => (
            <article className="panel" key={a.next + a.href}>
              <h3>{a.whatHappened}</h3>
              <ul className="kv">
                <li>
                  <span>Why</span>
                  <strong>{a.why}</strong>
                </li>
                <li>
                  <span>Next</span>
                  <strong>{a.next}</strong>
                </li>
                <li>
                  <span>Who</span>
                  <strong>{a.who}</strong>
                </li>
                <li>
                  <span>AI can automate</span>
                  <strong>{a.aiCanAutomate ? 'partial / assist' : 'no — approval'}</strong>
                </li>
                <li>
                  <span>Value</span>
                  <strong>{a.value}</strong>
                </li>
              </ul>
              <Link className="btn ghost" href={a.href}>
                Open
              </Link>
            </article>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 28 }}>Partner value</h2>
      {partners.ok ? <p className="meta">{partners.data.ecosystemPrinciple}</p> : null}
      {!partners.ok ? (
        <p className="form-error">{partners.error}</p>
      ) : (
        <div className="grid">
          {partners.data.partners.map((p) => (
            <article className="card" key={p.partnerKey}>
              <h3>{p.displayName}</h3>
              <p className="meta">
                Status: <code>{p.status}</code>
              </p>
              <ul>
                {p.valueCreated.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
              {p.honesty ? <p className="meta">{p.honesty}</p> : null}
            </article>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 28 }}>Business capabilities (not raw APIs)</h2>
      {caps.ok ? <p className="meta">{caps.data.honesty.note}</p> : null}
      {!caps.ok ? (
        <p className="form-error">{caps.error}</p>
      ) : (
        <table className="scanner-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Family</th>
              <th>Status</th>
              <th>Business capabilities</th>
            </tr>
          </thead>
          <tbody>
            {caps.data.advertisements.map((a) => (
              <tr key={a.providerKey}>
                <td>
                  {a.displayName}
                  {a.isFixture ? ' · fixture' : ''}
                </td>
                <td>{a.family}</td>
                <td>
                  <code>{a.status}</code>
                </td>
                <td style={{ fontSize: '0.75rem' }}>{a.businessCapabilities.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 28 }}>Commerce knowledge graph</h2>
      {!graph.ok ? (
        <p className="form-error">{graph.error}</p>
      ) : (
        <article className="panel">
          <p>
            Nodes: <strong>{graph.data.nodeCount}</strong> · Edges:{' '}
            <strong>{graph.data.edgeCount}</strong>
          </p>
          <p className="meta">{graph.data.honesty.note}</p>
          <ul className="meta">
            {graph.data.nodes.slice(0, 24).map((n) => (
              <li key={n.id}>
                <code>{n.type}</code> — {n.label}
              </li>
            ))}
          </ul>
          {graph.data.nodeCount === 0 ? (
            <ProcessEmptyState
              title="Graph is empty until you run commerce"
              body="Import products, create cases, listings, and orders. The knowledge graph projects relationships from the canonical model."
              stage="discover"
              primaryHref="/terminal"
              primaryLabel="Discover / import"
              secondaryHref="/terminal/process"
              secondaryLabel="Process"
            />
          ) : null}
        </article>
      )}
    </TerminalPageFrame>
  );
}
