import Link from 'next/link';
import { TerminalPageFrame } from '../../../components/commerce/process-chrome';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { terminalGet } from '../../../lib/terminal-api';

export default async function WatchlistPage() {
  const data = await terminalGet<{
    items?: Array<{
      id: string;
      productId: string;
      title: string;
      category: string;
      score: number | null;
      signal: string | null;
      isFixture: boolean;
      note: string | null;
      targetPriceMinor: number;
      currency: string;
    }>;
    note?: string;
  }>('/api/v1/watchlist');

  const items = data.ok ? data.data.items ?? [] : [];

  return (
    <TerminalPageFrame
      pill="Watchlist · org-scoped"
      title="Saved opportunities"
      lede="Track products you are evaluating. Not a live marketplace alert feed — scores refresh when you rescore products."
      showStageStrip
      currentStage="discover"
      relatedPrimary="opportunities"
      breadcrumbs={[
        { href: '/terminal/workspace', label: 'Workspace' },
        { label: 'Watchlist' },
      ]}
      toolbar={
        <>
          <Link className="btn primary" href="/terminal">
            Discover
          </Link>
          <Link className="btn ghost" href="/terminal/opportunities">
            Opportunities
          </Link>
        </>
      }
      error={data.ok ? null : data.error}
    >
      {data.ok && data.data.note ? <p className="meta">{data.data.note}</p> : null}

      {items.length === 0 && data.ok ? (
        <ProcessEmptyState
          title="Watchlist is empty"
          body="Open a product from Discover and use Watch, or run the scanner first. Saved items stay on this org for later evaluate."
          stage="discover"
          primaryHref="/terminal"
          primaryLabel="Discover products"
          secondaryHref="/terminal/process"
          secondaryLabel="Process board"
        />
      ) : null}

      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="scanner-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Score</th>
                <th>Signal</th>
                <th>Price</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.title}</strong>
                    <div className="meta">
                      {i.category}
                      {i.isFixture ? (
                        <>
                          {' '}
                          · <StatusBadge status="operational" /> FIXTURE
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td>{i.score ?? '—'}</td>
                  <td>{i.signal ?? '—'}</td>
                  <td>
                    {(i.targetPriceMinor / 100).toFixed(2)} {i.currency}
                  </td>
                  <td className="meta">{i.note ?? '—'}</td>
                  <td>
                    <Link href={`/terminal/products/${i.productId}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </TerminalPageFrame>
  );
}
