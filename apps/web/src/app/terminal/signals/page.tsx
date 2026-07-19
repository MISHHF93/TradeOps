import Link from 'next/link';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
import { terminalGet } from '../../../lib/terminal-api';

export default async function SignalsPage() {
  const result = await terminalGet<
    Array<{
      id: string;
      signal: string;
      rationale: string;
      confidence: number;
      createdAt: string;
      product: { id: string; title: string } | null;
    }>
  >('/api/v1/terminal/signals');

  const rows = result.ok ? result.data : [];

  return (
    <TerminalPageFrame
      pill="Analyst · signal intelligence"
      title="Signal feed"
      lede="Operational commerce recommendations and warnings scored from products and opportunities — not a social feed."
      showStageStrip
      relatedPrimary="opportunities"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { label: 'Signals' },
      ]}
      toolbar={
        <>
          <Link className="btn primary" href="/terminal/opportunities">
            Opportunities
          </Link>
          <Link className="btn ghost" href="/terminal">
            Discover
          </Link>
        </>
      }
      error={result.ok ? null : result.error}
    >
      {rows.length === 0 && result.ok ? (
        <ProcessEmptyState
          title="No signals yet"
          body="Signals appear when products are scored (BUY / HOLD / BLOCKED). Import candidates on Discover or run AI research to generate opportunity scores."
          stage="evaluate"
          primaryHref="/terminal"
          primaryLabel="Discover products"
          secondaryHref="/terminal/objectives"
          secondaryLabel="AI research"
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="scanner-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Signal</th>
                <th>Product</th>
                <th>Confidence</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <span className={`signal signal-${r.signal}`}>{r.signal}</span>
                  </td>
                  <td>
                    {r.product ? (
                      <Link href={`/terminal/products/${r.product.id}`}>{r.product.title}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{(r.confidence * 100).toFixed(0)}%</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 360 }}>{r.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </TerminalPageFrame>
  );
}
