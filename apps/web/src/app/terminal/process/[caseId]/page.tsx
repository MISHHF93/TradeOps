import Link from 'next/link';
import { AskAiButton } from '../../../../components/ai/ask-ai-button';
import {
  CommerceStatePanel,
  type CommerceStateClient,
} from '../../../../components/commerce/commerce-state-panel';
import {
  ObjectWorkspace,
  type ObjectWorkspaceDto,
} from '../../../../components/commerce/object-workspace';
import { AutoBootstrapMedia } from '../../../../components/commerce/auto-bootstrap-media';
import { ProductMediaWorkspace } from '../../../../components/commerce/product-media-workspace';
import { ProcessPageHeader } from '../../../../components/commerce/process-chrome';
import {
  ProcessAdvanceButton,
  ProcessSyncButton,
} from '../../../../components/terminal/process-actions';
import {
  PROCESS_LABELS,
  relatedStageHref,
  stageStatusLabel,
  stageTitle,
} from '../../../../lib/process-ux';
import { terminalGet } from '../../../../lib/terminal-api';

type Props = {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ section?: string }>;
};

const STAGE_ORDER = [
  'discover',
  'evaluate',
  'qualify',
  'prepare',
  'approve',
  'publish',
  'sell',
  'source',
  'fulfill',
  'reconcile',
  'learn',
] as const;

function nextStageOf(current: string): string | null {
  const i = STAGE_ORDER.indexOf(current as (typeof STAGE_ORDER)[number]);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1]!;
}

/**
 * Commerce Case object workspace — primary OS surface for one opportunity.
 * Loads case facets, state engine, product media twin, and contextual AI.
 */
export default async function CaseObjectWorkspacePage({ params, searchParams }: Props) {
  const { caseId } = await params;
  const { section } = await searchParams;

  const workspaceRes = await terminalGet<ObjectWorkspaceDto>(
    `/api/v1/commerce/cases/${caseId}/workspace`,
  );
  const detailRes = await terminalGet<{
    case: {
      id: string;
      productId: string;
      currentStage: string;
      stageStatus: string;
      nextActionLabel?: string | null;
      nextHref?: string;
      productHref: string;
    };
    handoffLabel: string;
  }>(`/api/v1/commerce/cases/${caseId}`);

  if (!workspaceRes.ok) {
    return (
      <section className="terminal-page">
        <p className="form-error">{workspaceRes.error}</p>
        <Link href="/terminal/process">← Commerce Process</Link>
      </section>
    );
  }

  const ws = workspaceRes.data;
  const c = detailRes.ok ? detailRes.data.case : null;
  const nextStage = c ? nextStageOf(c.currentStage) : null;
  const handoff = detailRes.ok ? detailRes.data.handoffLabel : 'Advance';

  const stateRes = await terminalGet<CommerceStateClient>(
    `/api/v1/commerce/cases/${caseId}/state`,
  );

  // Enrich workspace with product media for hero when product twin available
  let heroMedia: ObjectWorkspaceDto['heroMedia'];
  if (c?.productId) {
    const productRes = await terminalGet<{
      primaryImageUrl?: string | null;
      galleryImageUrlsJson?: string[];
      mediaJson?: Array<{ url?: string; purpose?: string }>;
    }>(`/api/v1/products/${c.productId}`);
    if (productRes.ok) {
      const pr = productRes.data;
      heroMedia = [];
      if (pr.primaryImageUrl) {
        heroMedia.push({
          id: 'primary',
          url: pr.primaryImageUrl,
          label: 'Primary',
          purpose: 'primary',
        });
      }
      for (const [i, u] of (pr.galleryImageUrlsJson ?? []).entries()) {
        heroMedia.push({ id: `gallery-${i}`, url: u, label: 'Gallery', purpose: 'gallery' });
      }
      for (const [i, m] of (pr.mediaJson ?? []).entries()) {
        if (m.url) {
          heroMedia.push({
            id: `media-${i}`,
            url: m.url,
            label: m.purpose ?? 'Media',
            purpose: m.purpose,
          });
        }
      }
    }
  }

  const workspace: ObjectWorkspaceDto = {
    ...ws,
    heroMedia,
    productId: c?.productId,
  };

  const aiObjective =
    ws.aiContext?.suggestedObjective ??
    ws.nextAction?.label ??
    `Resolve commerce case ${ws.title}`;

  return (
    <section className="terminal-page case-workspace-page">
      <ProcessPageHeader
        pill={`Commerce Case · ${ws.stage ? stageTitle(ws.stage) : '—'} · ${
          ws.stageStatus ? stageStatusLabel(ws.stageStatus) : '—'
        }`}
        title={ws.title}
        lede={ws.subtitle}
        currentStage={ws.stage}
        breadcrumbs={[
          { href: '/terminal/process', label: PROCESS_LABELS.boardTitle },
          {
            href: ws.stage ? relatedStageHref(ws.stage) : '/terminal/process',
            label: ws.stage ? stageTitle(ws.stage) : 'Case',
          },
          { label: ws.title },
        ]}
        toolbar={
          <>
            <ProcessSyncButton />
            <AskAiButton
              objective={aiObjective}
              commerceCaseId={caseId}
              label={PROCESS_LABELS.aiOnCase ?? 'Ask AI'}
            />
            {c ? (
              <Link className="btn secondary" href={c.productHref}>
                {PROCESS_LABELS.productTwin}
              </Link>
            ) : null}
            {ws.nextAction?.href ? (
              <Link className="btn primary" href={ws.nextAction.href}>
                {ws.nextAction.label ?? PROCESS_LABELS.nextStep}
              </Link>
            ) : null}
            {c && nextStage ? (
              <ProcessAdvanceButton
                caseId={c.id}
                toStage={nextStage}
                label={handoff || `Advance to ${stageTitle(nextStage)}`}
              />
            ) : null}
          </>
        }
      />

      {stateRes.ok ? <CommerceStatePanel state={stateRes.data} /> : null}

      {c?.productId ? <AutoBootstrapMedia productId={c.productId} /> : null}

      <ObjectWorkspace workspace={workspace} section={section} />

      {c?.productId ? (
        <div className="case-workspace-media">
          <ProductMediaWorkspace productId={c.productId} />
        </div>
      ) : null}
    </section>
  );
}
