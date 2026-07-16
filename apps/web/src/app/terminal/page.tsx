import { ScannerTable } from '../../components/scanner-table';
import { TerminalToolbar } from '../../components/terminal-actions';
import { terminalGet, type ScannerRow } from '../../lib/terminal-api';

export default async function ScannerPage() {
  const result = await terminalGet<ScannerRow[]>('/api/v1/terminal/scanner');
  const rows = result.ok ? result.data : [];

  return (
    <section>
      <header className="terminal-header">
        <div>
          <h1>Market Scanner</h1>
          <p className="lede">
            Sortable opportunity book. Signals are commerce recommendations for physical products —
            not securities or investment advice. Optimize for contribution profit and cash, not vanity
            revenue.
          </p>
        </div>
        <TerminalToolbar />
      </header>

      {!result.ok ? (
        <p className="form-error">
          {result.error}. Ensure the local DB is up and seeded (
          <code>pnpm run db:pglite</code> then <code>pnpm run setup:db</code>), then restart the
          API.
        </p>
      ) : rows.length === 0 ? (
        <p className="meta">
          Scanner is empty. Run <code>pnpm run setup:db</code> or use <strong>Import fixtures</strong>{' '}
          in the toolbar.
        </p>
      ) : null}

      <ScannerTable rows={rows} />
      <p className="meta">
        * Expected profit = unit contribution × 14d demand forecast (baseline-ma-v1). Not realized
        P&amp;L. STALE = data older than 24h.
      </p>
    </section>
  );
}
