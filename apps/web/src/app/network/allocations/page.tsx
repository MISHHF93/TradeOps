import Link from 'next/link';
import { formatMoney } from '../../../lib/money';
import { terminalGet } from '../../../lib/terminal-api';

export default async function NetworkAllocationsPage() {
  const result = await terminalGet<{
    allocations: Array<{
      id: string;
      status: string;
      amountReservedMinor: number;
      amountDeployedMinor: number;
      amountReturnedMinor: number;
      currency: string;
      productId: string | null;
      commerceCaseId: string | null;
      economicsJson: { label?: string };
    }>;
    labels: Record<string, string>;
  }>('/api/v1/network/allocations');

  const rows = result.ok ? result.data.allocations : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <p className="pill">Network · allocations</p>
          <h1>Capital allocations</h1>
          <p className="lede">
            Propose → approve → reserve → deploy. Must pass CommerceMandate. AI cannot transfer
            funds directly.
          </p>
        </div>
        <Link className="btn ghost" href="/network/portfolio">
          Portfolio
        </Link>
      </header>

      {!result.ok ? <p className="form-error">{result.error}</p> : null}

      <table className="scanner-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Reserved</th>
            <th>Deployed</th>
            <th>Returned</th>
            <th>Product / case</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.status}</td>
              <td>{formatMoney(a.amountReservedMinor, a.currency)}</td>
              <td>{formatMoney(a.amountDeployedMinor, a.currency)}</td>
              <td>{formatMoney(a.amountReturnedMinor, a.currency)}</td>
              <td>
                <code>{a.productId?.slice(0, 8) ?? '—'}</code> /{' '}
                <code>{a.commerceCaseId?.slice(0, 8) ?? '—'}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="meta">No allocations.</p> : null}
    </section>
  );
}
