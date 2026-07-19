import Link from 'next/link';
import { ProcessCaseCard } from '../../../components/commerce/process-case-card';
import {
  ProcessKpiStrip,
  ProcessPageHeader,
  ProcessRelatedLinks,
} from '../../../components/commerce/process-chrome';
import {
  RuntimeBanner,
  type RuntimeOrgView,
} from '../../../components/commerce/runtime-banner';
import { ProcessEmptyState } from '../../../components/feedback/process-empty-state';
import { ProcessSyncButton } from '../../../components/terminal/process-actions';
import { formatMoney } from '../../../lib/money';
import { PROCESS_LABELS, stageTitle } from '../../../lib/process-ux';
import { terminalGet } from '../../../lib/terminal-api';

type CaseDto = {
  id: string;
  productId: string;
  productTitle?: string;
  primaryImageUrl?: string | null;
  currentStage: string;
  stageStatus: string;
  opportunityScore?: number | null;
  expectedProfitMinor?: number | null;
  currency?: string;
  nextActionLabel?: string | null;
  nextHref?: string;
  blockerMessage?: string | null;
  journeyHref: string;
};

type ProcessResponse = {
  stages: Array<{ id: string; title: string; description: string; handoffLabel: string }>;
  summary: {
    totalOpen: number;
    blocked: number;
    waiting: number;
    awaitingApproval: number;
    awaitingSource: number;
  };
  byStage: Record<string, CaseDto[]>;
  honesty?: { note?: string };
};

export default async function CommerceProcessPage() {
  const result = await terminalGet<ProcessResponse>('/api/v1/commerce/process');
  const runtimeRes = await terminalGet<RuntimeOrgView>('/api/v1/commerce/runtime');
  const stateBoard = await terminalGet<{
    summary?: {
      total: number;
      avgFriction: number;
      avgReadiness: number;
      blocked: number;
    };
    cases?: Array<{
      caseId: string;
      productTitle?: string;
      currentState: string;
      stageStatus?: string;
      operationalFriction: number;
      executionReadiness: number;
      recommendedTransformation?: { code: string; label: string; href: string } | null;
    }>;
  }>('/api/v1/commerce/state');

  if (!result.ok) {
    return (
      <section>
        <p className="form-error">{result.error}</p>
        <ProcessEmptyState
          title="Process board unavailable"
          body="Ensure the API and database are running, then sync Commerce Cases."
          primaryHref="/terminal"
          primaryLabel={PROCESS_LABELS.discoverTitle}
        />
      </section>
    );
  }

  const data = result.data;
  const stages = data.stages ?? [];
  const engine = stateBoard.ok ? stateBoard.data : null;
  const runtime = runtimeRes.ok ? runtimeRes.data : null;

  return (
    <section>
      <ProcessPageHeader
        pill="Commerce Runtime · process board"
        title={PROCESS_LABELS.boardTitle}
        lede="Every case is a process under the Commerce Runtime. Ask: what is executing? What is the next valid transformation?"
        breadcrumbs={[
          { href: '/terminal/workspace', label: 'Workspace' },
          { label: PROCESS_LABELS.boardTitle },
        ]}
        toolbar={
          <>
            <ProcessSyncButton />
            <Link className="btn secondary" href="/terminal">
              {PROCESS_LABELS.discoverTitle}
            </Link>
            <Link className="btn ghost" href="/terminal/tasks">
              {PROCESS_LABELS.viewTasks}
            </Link>
            <Link className="btn ghost" href="/terminal/approvals">
              {PROCESS_LABELS.viewApprovals}
            </Link>
          </>
        }
      />

      <ProcessRelatedLinks primary="process" />

      <RuntimeBanner runtime={runtime} />

      <ProcessKpiStrip
        items={[
          {
            label: 'Open cases',
            value: data.summary.totalOpen,
            href: undefined,
          },
          {
            label: 'Blocked',
            value: data.summary.blocked,
            warn: data.summary.blocked > 0,
            href: '/terminal/tasks',
          },
          {
            label: 'Waiting / approval',
            value: data.summary.waiting + data.summary.awaitingApproval,
            href: '/terminal/approvals',
          },
          {
            label: 'Need sourcing',
            value: data.summary.awaitingSource,
            href: '/terminal/orders',
          },
        ]}
      />

      {engine?.summary && (engine.cases?.length ?? 0) > 0 ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Priority queue</h2>
          <p className="meta" style={{ marginTop: 0 }}>
            Ranked by blockers and friction · avg friction {engine.summary.avgFriction}/100 · avg
            readiness {engine.summary.avgReadiness}/100
          </p>
          <ul className="process-board-col__list">
            {engine.cases!.slice(0, 5).map((s) => (
              <ProcessCaseCard
                key={s.caseId}
                compact
                case={{
                  id: s.caseId,
                  productTitle: s.productTitle,
                  currentStage: s.currentState,
                  stageStatus: s.stageStatus ?? 'ready',
                  nextActionLabel: s.recommendedTransformation?.label,
                  nextHref: s.recommendedTransformation?.href,
                  friction: s.operationalFriction,
                  readiness: s.executionReadiness,
                }}
              />
            ))}
          </ul>
        </article>
      ) : null}

      {data.honesty?.note ? <p className="meta">{data.honesty.note}</p> : null}

      {data.summary.totalOpen === 0 ? (
        <ProcessEmptyState
          title="No Commerce Cases yet"
          body={`Import products in ${PROCESS_LABELS.discoverTitle} (fixture or live supplier). Each product becomes one case on this board.`}
          stage="Discover"
          primaryHref="/terminal"
          primaryLabel={`Go to ${PROCESS_LABELS.discoverTitle}`}
          secondaryHref="/terminal/tasks"
          secondaryLabel={PROCESS_LABELS.viewTasks}
        />
      ) : null}

      <div className="process-board-grid">
        {stages.map((stage) => {
          const rows = data.byStage[stage.id] ?? [];
          return (
            <article
              key={stage.id}
              id={`stage-${stage.id}`}
              className="panel process-board-col"
            >
              <h2 style={{ margin: '0 0 4px', fontSize: 14 }}>
                {stageTitle(stage.id)} <span className="meta">({rows.length})</span>
              </h2>
              <p className="meta" style={{ margin: '0 0 10px', fontSize: 11 }}>
                {stage.description}
              </p>
              {rows.length === 0 ? (
                <p className="meta" style={{ fontSize: 11 }}>
                  Empty — cases arrive when earlier stages complete.
                </p>
              ) : (
                <ul className="process-board-col__list">
                  {rows.map((c) => (
                    <ProcessCaseCard
                      key={c.id}
                      case={{
                        id: c.id,
                        productId: c.productId,
                        productTitle: c.productTitle,
                        primaryImageUrl: c.primaryImageUrl,
                        currentStage: c.currentStage,
                        stageStatus: c.stageStatus,
                        opportunityScore: c.opportunityScore,
                        expectedProfitLabel:
                          c.expectedProfitMinor != null
                            ? formatMoney(c.expectedProfitMinor, c.currency ?? 'USD')
                            : null,
                        nextActionLabel: c.nextActionLabel,
                        nextHref: c.nextHref,
                        blockerMessage: c.blockerMessage,
                      }}
                    />
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
