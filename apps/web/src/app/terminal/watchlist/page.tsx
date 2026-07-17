import Link from 'next/link';
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
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Watchlist · org-scoped</p>
          <h1>Saved opportunities</h1>
          <p className="lede">
            Track products you are evaluating. Not a live marketplace alert feed — scores refresh
            when you rescore products.
          </p>
        </div>
        <div className="terminal-toolbar">
          <Link className="btn primary" href="/terminal">
            Scanner
          </Link>
        </div>
      </header>

      {!data.ok ? <p className="form-error">{data.error}</p> : null}
      <p className="meta">{data.ok ? data.data.note : null}</p>

      <table className="scanner-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Score</th>
            <th>Signal</th>
            <th>Price</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <span className="meta">
                  Empty. Open a product and use <strong>Watch</strong>, or run the scanner first.
                </span>
              </td>
            </tr>
          ) : (
            items.map((i) => (
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
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
