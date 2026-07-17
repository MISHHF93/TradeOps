import Link from 'next/link';
import { ProcessCaseCard } from '../../../components/commerce/process-case-card';
import {
  ProcessKpiStrip,
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import { PROCESS_LABELS, stageTitle } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

/**
 * Command center — process control, not a KPI museum.
 * Primary CTAs always return to Process / Tasks / Approvals.
 */
export default async function FounderCockpitPage() {
  const tenant = await terminalGet<{
    organization?: {
      name: string;
      segment: string;
      planTier: string;
      onboardingComplete: boolean;
      onboardingStep: string;
    };
    membership?: { workspacePersona: string; role: string };
    quotas?: Record<string, { current: number; limit: number; ok: boolean }>;
  }>('/api/v1/saas/tenant');

  const cockpit = await terminalGet<{
    summary?: {
      products: number;
      orders: number;
      pendingApprovals: number;
      listings: number;
      topOpportunityExpectedProfitMinor: number;
      topOpportunityCashRequiredMinor: number;
    };
    topOpportunities?: Array<{
      productId: string;
      title: string;
      score: number;
      signal: string;
      expectedProfitMinor: number;
      expectedMarginBps: number;
      isFixture: boolean;
    }>;
    urgentActions?: string[];
    note?: string;
  }>('/api/v1/saas/founder-cockpit');

  const agentic = await terminalGet<{ averageScore?: number; sampleSize?: number; note?: string }>(
    '/api/v1/saas/agentic-readiness',
  );

  const process = await terminalGet<{
    summary?: {
      totalOpen: number;
      blocked: number;
      waiting: number;
      awaitingApproval: number;
      awaitingSource: number;
    };
    stages?: Array<{ id: string; title: string; count: number }>;
    urgent?: Array<{
      id: string;
      productTitle?: string;
      currentStage: string;
      stageStatus: string;
      nextActionLabel?: string | null;
      journeyHref: string;
      blockerMessage?: string | null;
    }>;
  }>('/api/v1/commerce/process/terminal-summary');

  const org = tenant.ok ? tenant.data.organization : null;

  return (
    <section>
      <ProcessPageHeader
        pill={`Command center · ${org?.segment ?? '—'} · ${org?.planTier ?? '—'}`}
        title="Command center"
        lede="Process control for the commerce lifecycle. Open cases, blockers, and next steps — not a KPI museum."
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Workspace' },
          { label: 'Command center' },
        ]}
        toolbar={
          <>
            <Link className="btn primary" href="/terminal/process">
              {PROCESS_LABELS.openProcess}
            </Link>
            <Link className="btn secondary" href="/terminal">
              {PROCESS_LABELS.discoverTitle}
            </Link>
            <Link className="btn ghost" href="/terminal/tasks">
              {PROCESS_LABELS.viewTasks}
            </Link>
            <Link className="btn ghost" href="/terminal/ai">
              AI Operator
            </Link>
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      {!tenant.ok ? <p className="form-error">{tenant.error}</p> : null}
      {!cockpit.ok ? <p className="form-error">{cockpit.error}</p> : null}

      {process.ok ? (
        <ProcessKpiStrip
          items={[
            {
              label: 'Open cases',
              value: process.data.summary?.totalOpen ?? 0,
              href: '/terminal/process',
            },
            {
              label: 'Blocked / waiting',
              value:
                (process.data.summary?.blocked ?? 0) + (process.data.summary?.waiting ?? 0),
              warn:
                (process.data.summary?.blocked ?? 0) + (process.data.summary?.waiting ?? 0) > 0,
              href: '/terminal/tasks',
            },
            {
              label: 'Awaiting approval',
              value: process.data.summary?.awaitingApproval ?? 0,
              href: '/terminal/approvals',
            },
            {
              label: 'Need sourcing',
              value: process.data.summary?.awaitingSource ?? 0,
              href: '/terminal/orders',
            },
          ]}
        />
      ) : null}

      {process.ok && process.data.urgent && process.data.urgent.length > 0 ? (
        <article className="panel wide" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Urgent process work</h2>
          <ul className="process-board-col__list">
            {process.data.urgent.map((u) => (
              <ProcessCaseCard
                key={u.id}
                case={{
                  id: u.id,
                  productTitle: u.productTitle,
                  currentStage: u.currentStage,
                  stageStatus: u.stageStatus,
                  nextActionLabel: u.nextActionLabel,
                  blockerMessage: u.blockerMessage,
                }}
              />
            ))}
          </ul>
        </article>
      ) : null}

      <div className="detail-grid">
        <article className="panel">
          <h2>Tenant</h2>
          {org ? (
            <ul className="kv">
              <li>
                <span>Org</span>
                <strong>{org.name}</strong>
              </li>
              <li>
                <span>Persona</span>
                <strong>
                  {tenant.ok ? tenant.data.membership?.workspacePersona : '—'}
                </strong>
              </li>
              <li>
                <span>Onboarding</span>
                <strong>
                  {org.onboardingComplete ? 'complete' : org.onboardingStep}
                </strong>
              </li>
            </ul>
          ) : (
            <p className="meta">Tenant context unavailable.</p>
          )}
          <p>
            <Link href="/terminal/workspace">Switch persona</Link>
          </p>
        </article>

        <article className="panel">
          <h2>Portfolio snapshot</h2>
          {cockpit.ok && cockpit.data.summary ? (
            <ul className="kv">
              <li>
                <span>Products</span>
                <strong>{cockpit.data.summary.products}</strong>
              </li>
              <li>
                <span>Listings</span>
                <strong>{cockpit.data.summary.listings}</strong>
              </li>
              <li>
                <span>Orders</span>
                <strong>{cockpit.data.summary.orders}</strong>
              </li>
              <li>
                <span>Pending approvals</span>
                <strong>{cockpit.data.summary.pendingApprovals}</strong>
              </li>
            </ul>
          ) : (
            <p className="meta">Import products to populate.</p>
          )}
        </article>

        <article className="panel">
          <h2>Agentic readiness</h2>
          {agentic.ok ? (
            <ul className="kv">
              <li>
                <span>Avg score</span>
                <strong>{agentic.data.averageScore ?? '—'}</strong>
              </li>
              <li>
                <span>Sample</span>
                <strong>{agentic.data.sampleSize ?? 0}</strong>
              </li>
            </ul>
          ) : (
            <p className="meta">—</p>
          )}
          <p className="meta">{agentic.ok ? agentic.data.note : null}</p>
        </article>
      </div>

      {cockpit.ok && cockpit.data.topOpportunities && cockpit.data.topOpportunities.length > 0 ? (
        <article className="panel wide" style={{ marginTop: 16 }}>
          <h2>Top opportunities</h2>
          <table className="compact">
            <thead>
              <tr>
                <th>Product</th>
                <th>Score</th>
                <th>Signal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cockpit.data.topOpportunities.map((o) => (
                <tr key={o.productId}>
                  <td>
                    {o.title}
                    {o.isFixture ? ' · FIXTURE' : ''}
                  </td>
                  <td>{o.score}</td>
                  <td>{o.signal}</td>
                  <td>
                    <Link href={`/terminal/products/${o.productId}`}>
                      {PROCESS_LABELS.productTwin}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      {process.ok && process.data.stages ? (
        <article className="panel wide" style={{ marginTop: 16 }}>
          <h2>Stage load</h2>
          <p className="meta">
            Cases per procedure stage.{' '}
            <Link href="/terminal/process">{PROCESS_LABELS.openProcess}</Link>
          </p>
          <ul className="kv">
            {process.data.stages.map((s) => (
              <li key={s.id}>
                <span>{stageTitle(s.id)}</span>
                <strong>{s.count}</strong>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
