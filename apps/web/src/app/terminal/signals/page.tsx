import Link from 'next/link';
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
    <section>
      <h1>Signal feed</h1>
      <p className="lede">Operational commerce recommendations and warnings.</p>
      {!result.ok ? <p className="form-error">{result.error}</p> : null}
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
              <td>{r.rationale}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
