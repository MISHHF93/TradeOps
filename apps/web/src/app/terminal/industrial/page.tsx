import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { BootstrapIndustrialButton } from '../../../components/industrial/bootstrap-industrial-button';
import { terminalGet } from '../../../lib/terminal-api';

export default async function IndustrialOsHomePage() {
  const catalog = await terminalGet<{
    verticals?: Array<{ id: string; label: string }>;
    roles?: Array<{ id: string; label: string; mission: string; homeHref: string }>;
  }>('/api/v1/industrial/catalog');

  const products = await terminalGet<{
    items?: Array<{
      productId: string;
      title: string;
      manufacturer?: string;
      completeness?: { score: number };
      isFixture?: boolean;
    }>;
  }>('/api/v1/industrial/products?take=8');

  return (
    <section>
      <ProcessPageHeader
        pill="Industrial Commerce OS"
        title="Industrial AI Commerce"
        lede="Same TradeOps platform — manufacturers, distributors, procurement, MRO, and enterprise buyers. Reuses Product, Supplier, PO, and AI layers; industrial fields live on the digital twin."
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Workspace' },
          { label: 'Industrial' },
        ]}
      />
      <ProcessRelatedLinks primary="process" />

      <div className="detail-grid">
        <article className="panel">
          <h2>Hubs</h2>
          <ul className="meta">
            <li>
              <Link href="/terminal/industrial/products">Industrial catalog</Link> — OEM/MPN,
              specs, completeness
            </li>
            <li>
              <Link href="/terminal/industrial/procurement">Procurement engine</Link> — RFQ,
              quotes, substitutes
            </li>
            <li>
              <Link href="/terminal/industrial/twin">Digital twin</Link> — products, suppliers,
              POs, inventory graph
            </li>
            <li>
              <Link href="/terminal/connectors">Connectors</Link> — ERP / PIM / WMS / PLM registry
            </li>
            <li>
              <Link href="/terminal/ai">AI Operator</Link> — xAI + RAG over industrial knowledge
            </li>
          </ul>
          <BootstrapIndustrialButton />
        </article>

        <article className="panel">
          <h2>Role surfaces</h2>
          {!catalog.ok ? (
            <p className="form-error">{catalog.error}</p>
          ) : (
            <ul className="meta">
              {(catalog.data.roles ?? []).slice(0, 10).map((r) => (
                <li key={r.id}>
                  <Link href={`/terminal/industrial/roles/${r.id}`}>
                    <strong>{r.label}</strong>
                  </Link>
                  <div>{r.mission}</div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="panel" style={{ marginTop: 16 }}>
        <h2>Catalog snapshot</h2>
        {!products.ok ? (
          <p className="form-error">{products.error}</p>
        ) : (products.data.items ?? []).length === 0 ? (
          <p className="meta">
            No products yet. Import fixtures or live catalogs, then enrich{' '}
            <code>attributesJson.industrial</code>.
          </p>
        ) : (
          <table className="scanner-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Manufacturer</th>
                <th>Completeness</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(products.data.items ?? []).map((p) => (
                <tr key={p.productId}>
                  <td>
                    {p.title}
                    {p.isFixture ? (
                      <div className="meta">TEST FIXTURE</div>
                    ) : null}
                  </td>
                  <td>{p.manufacturer ?? '—'}</td>
                  <td>{p.completeness?.score ?? 0}%</td>
                  <td>
                    <Link href={`/terminal/industrial/products`}>Open catalog</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      {catalog.ok ? (
        <article className="panel" style={{ marginTop: 16 }}>
          <h2>Industry verticals</h2>
          <p className="meta">
            {(catalog.data.verticals ?? []).map((v) => v.label).join(' · ')}
          </p>
        </article>
      ) : null}
    </section>
  );
}
