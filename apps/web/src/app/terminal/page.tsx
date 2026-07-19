import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../components/commerce/process-chrome';
import { ScannerTable } from '../../components/scanner-table';
import { TerminalToolbar } from '../../components/terminal-actions';
import { PROCESS_LABELS } from '../../lib/process-ux';
import { terminalGet, type ScannerRow } from '../../lib/terminal-api';

export default async function ScannerPage() {
  const result = await terminalGet<ScannerRow[]>('/api/v1/terminal/scanner');
  const rows = result.ok ? result.data : [];
  const withMedia = rows.filter((r) => r.primaryImageUrl).length;

  return (
    <section className="terminal-page discover-page">
      <ProcessPageHeader
        pill={PROCESS_LABELS.discoverPill}
        title={PROCESS_LABELS.discoverTitle}
        lede={PROCESS_LABELS.discoverLede}
        currentStage="discover"
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Workspace' },
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: PROCESS_LABELS.discoverTitle },
        ]}
        toolbar={<TerminalToolbar />}
      />

      <ProcessRelatedLinks primary="discover" />

      {!result.ok ? (
        <p className="form-error">
          {result.error}. Ensure the local DB is up and seeded, then restart the API.
        </p>
      ) : rows.length === 0 ? (
        <article className="panel">
          <p>
            No products in Discover yet. Import from a connected supplier or use{' '}
            <strong>Import fixtures</strong> to create Commerce Cases, then open the{' '}
            <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link> to evaluate them.
          </p>
        </article>
      ) : (
        <p className="meta discover-page__lede">
          {rows.length} opportunities · {withMedia} with media · Toggle <strong>Cards</strong> for
          a visual grid. Open a product twin, then continue on the{' '}
          <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>.
        </p>
      )}

      <ScannerTable rows={rows} />
      <p className="meta">
        * Expected profit = unit contribution times 14d demand forecast (baseline-ma-v1). Not
        realized P&amp;L. STALE = data older than 24h.
      </p>
    </section>
  );
}
