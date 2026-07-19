import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../../components/commerce/process-chrome';
import { terminalGet } from '../../../../lib/terminal-api';

export default async function IndustrialProductsPage() {
  const result = await terminalGet<{
    items?: Array<{
      productId: string;
      title: string;
      manufacturer?: string;
      oemPartNumber?: string;
      mpn?: string;
      sku?: string;
      inventoryQuantity?: number;
      completeness?: { score: number; missing: string[] };
      isFixture?: boolean;
      verticals?: string[];
    }>;
    honesty?: { note: string };
  }>('/api/v1/industrial/products?take=50');

  return (
    <section>
      <ProcessPageHeader
        pill="Industrial catalog"
        title="Industrial products"
        lede="OEM / MPN / specs / docs completeness — same Product twin as retail, industrial profile in attributesJson."
        breadcrumbs={[
          { href: '/terminal/industrial', label: 'Industrial' },
          { label: 'Products' },
        ]}
      />
      <ProcessRelatedLinks primary="process" />

      {!result.ok ? (
        <p className="form-error">{result.error}</p>
      ) : (
        <>
          <table className="scanner-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Manufacturer</th>
                <th>OEM / MPN</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Complete</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(result.data.items ?? []).map((p) => (
                <tr key={p.productId}>
                  <td>
                    {p.title}
                    {p.isFixture ? <div className="meta">TEST FIXTURE</div> : null}
                  </td>
                  <td>{p.manufacturer ?? '—'}</td>
                  <td>
                    {p.oemPartNumber ?? '—'} / {p.mpn ?? '—'}
                  </td>
                  <td>{p.sku ?? '—'}</td>
                  <td>{p.inventoryQuantity ?? 0}</td>
                  <td>
                    {p.completeness?.score ?? 0}%
                    {p.completeness?.missing?.length ? (
                      <div className="meta">{p.completeness.missing.slice(0, 3).join(', ')}</div>
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/terminal/products/${p.productId}`}>Twin</Link>
                    {' · '}
                    <Link
                      href={`/terminal/industrial/procurement?productId=${p.productId}`}
                    >
                      Procure
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.data.honesty?.note ? (
            <p className="meta">{result.data.honesty.note}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
