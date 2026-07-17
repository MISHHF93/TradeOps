import Link from 'next/link';
import {
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { formatMoney } from '../../../lib/money';
import {
  PROCESS_LABELS,
  stageStatusLabel,
  stageTitle,
} from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

/**
 * Listings stage view — cases in prepare / approve / publish.
 * Same CommerceCase records as Process; not a separate inventory.
 */
export default async function ListingsStagePage() {
  const result = await terminalGet<{
    byStage: Record<
      string,
      Array<{
        id: string;
        productTitle?: string;
        currentStage: string;
        stageStatus: string;
        opportunityScore?: number | null;
        expectedProfitMinor?: number | null;
        currency?: string;
        nextActionLabel?: string | null;
        journeyHref: string;
        productHref: string;
        blockerMessage?: string | null;
      }>
    >;
  }>('/api/v1/commerce/process');

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
      </section>
    );
  }

  const stages = ['prepare', 'approve', 'publish'] as const;
  const rows = stages.flatMap((s) => result.data.byStage[s] ?? []);

  return (
    <section>
      <ProcessPageHeader
        pill="Stage view · Prepare → Approve → Publish"
        title="Listings"
        lede="Listing drafts and published items as Commerce Cases. Prepare content on the product twin; approve on Approvals; publish stays credential-gated."
        currentStage="prepare"
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          { label: 'Listings' },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn ghost" href="/terminal/approvals">
              {PROCESS_LABELS.viewApprovals}
            </Link>
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      {rows.length === 0 ? (
        <article className="panel">
          <p>
            No cases in Prepare, Approve, or Publish. Qualify an opportunity on the{' '}
            <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>, then open the product
            twin to create a listing draft.
          </p>
        </article>
      ) : (
        <table className="compact">
          <thead>
            <tr>
              <th>Product</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Score</th>
              <th>Expected profit</th>
              <th>{PROCESS_LABELS.nextStep}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.productTitle ?? c.id.slice(0, 8)}</td>
                <td>{stageTitle(c.currentStage)}</td>
                <td>{stageStatusLabel(c.stageStatus)}</td>
                <td>{c.opportunityScore ?? '—'}</td>
                <td>
                  {c.expectedProfitMinor != null
                    ? formatMoney(c.expectedProfitMinor, c.currency ?? 'USD')
                    : '—'}
                </td>
                <td className="meta" style={{ whiteSpace: 'normal' }}>
                  {c.blockerMessage ?? c.nextActionLabel ?? '—'}
                </td>
                <td>
                  <Link href={c.journeyHref}>{PROCESS_LABELS.openCase}</Link>
                  {' · '}
                  <Link href={c.productHref}>{PROCESS_LABELS.productTwin}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
