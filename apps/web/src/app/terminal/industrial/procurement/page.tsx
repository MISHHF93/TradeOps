import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../../components/commerce/process-chrome';
import { ProcurementEvaluatePanel } from '../../../../components/industrial/procurement-evaluate-panel';
import { terminalGet } from '../../../../lib/terminal-api';

type Props = { searchParams: Promise<{ productId?: string }> };

export default async function IndustrialProcurementPage({ searchParams }: Props) {
  const sp = await searchParams;
  const productId = sp.productId?.trim();

  const products = await terminalGet<{
    items?: Array<{ productId: string; title: string; isFixture?: boolean }>;
  }>('/api/v1/industrial/products?take=30');

  return (
    <section>
      <ProcessPageHeader
        pill="AI Procurement"
        title="Procurement engine"
        lede="Match technical requirements, compare quotes, estimate landed cost, rank substitutes, and draft RFQs. Awards require human approval."
        breadcrumbs={[
          { href: '/terminal/industrial', label: 'Industrial' },
          { label: 'Procurement' },
        ]}
      />
      <ProcessRelatedLinks primary="process" />

      <article className="panel">
        <h2>Select product</h2>
        {!products.ok ? (
          <p className="form-error">{products.error}</p>
        ) : (
          <ul className="meta">
            {(products.data.items ?? []).map((p) => (
              <li key={p.productId}>
                <Link href={`/terminal/industrial/procurement?productId=${p.productId}`}>
                  {p.title}
                </Link>
                {p.isFixture ? ' · TEST FIXTURE' : ''}
                {productId === p.productId ? ' · selected' : ''}
              </li>
            ))}
          </ul>
        )}
      </article>

      {productId ? <ProcurementEvaluatePanel productId={productId} /> : null}
    </section>
  );
}
