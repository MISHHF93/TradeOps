/**
 * Object Workspace builder — each business object is an operating surface.
 * Commerce Case is the hub; product twin is a facet of the case.
 */

import {
  COMMERCE_CASE_SECTIONS,
  type BusinessObjectRef,
  type ObjectWorkspaceSection,
  type ObjectWorkspaceSectionId,
} from './business-objects';
import type { CommerceStage, CommerceStageStatus } from './commerce-lifecycle';
import {
  projectCaseKnowledgeGraph,
  type KnowledgeGraphProjection,
} from './knowledge-graph';

export type ObjectWorkspacePanel = {
  id: ObjectWorkspaceSectionId;
  label: string;
  description: string;
  empty?: boolean;
  items?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    href?: string;
    meta?: Record<string, unknown>;
  }>;
  summary?: Record<string, unknown>;
};

export type ObjectWorkspaceView = {
  objectType: 'commerce_case' | 'product';
  objectId: string;
  title: string;
  subtitle: string;
  stage?: CommerceStage;
  stageStatus?: CommerceStageStatus;
  nextAction?: { code?: string | null; label?: string | null; href?: string | null };
  blocker?: { code?: string | null; message?: string | null };
  sections: ObjectWorkspaceSection[];
  panels: ObjectWorkspacePanel[];
  related: BusinessObjectRef[];
  graph: KnowledgeGraphProjection;
  aiContext: {
    preamble: string;
    suggestedObjective: string;
    tools: string[];
  };
  honesty: { note: string; isFixtureSource: boolean };
  computedAt: string;
};

export type CaseWorkspaceInput = {
  caseId: string;
  productId: string;
  productTitle: string;
  productCategory?: string;
  sourcePlatform?: string | null;
  currentStage: string;
  stageStatus: string;
  nextActionCode?: string | null;
  nextActionLabel?: string | null;
  nextHref?: string | null;
  blockerCode?: string | null;
  blockerMessage?: string | null;
  opportunityScore?: number | null;
  expectedProfitMinor?: number | null;
  currency?: string;
  confidence?: number | null;
  opportunity?: {
    id?: string;
    score: number;
    explanation?: string;
    currentSignal?: string;
  } | null;
  policy?: { outcome: string; reasons?: string[] } | null;
  listings?: Array<{ id: string; status: string; priceMinor?: number }>;
  offers?: Array<{
    id?: string;
    supplierId?: string;
    supplierName: string;
    costMinor: number;
    shippingCostMinor: number;
  }>;
  artifacts?: Array<{ id: string; artifactType: string; purpose: string; title?: string | null }>;
  orders?: Array<{ id: string; status: string; externalId?: string | null }>;
  payments?: Array<{ id: string; status?: string }>;
  shipments?: Array<{ id: string; status?: string }>;
  approvals?: Array<{ id: string; status: string; kind?: string }>;
  signals?: Array<{ id: string; signal: string; rationale?: string }>;
  history?: Array<{ stage: string; status: string; at: string; note?: string }>;
  connectors?: Array<{ key: string; isFixture?: boolean }>;
  aiRuns?: Array<{ id: string; objective: string; status: string }>;
  inventory?: {
    quantity?: number | null;
    atpNote?: string;
  };
  economics?: {
    supplierCostMinor?: number;
    shippingCostMinor?: number;
    targetPriceMinor?: number;
    contributionProfitMinor?: number | null;
  };
};

function panel(
  section: ObjectWorkspaceSection,
  items: ObjectWorkspacePanel['items'],
  summary?: Record<string, unknown>,
): ObjectWorkspacePanel {
  return {
    id: section.id,
    label: section.label,
    description: section.description,
    empty: !items?.length && !summary,
    items,
    summary,
  };
}

/**
 * Build the unified Commerce Case object workspace.
 */
export function buildCaseObjectWorkspace(input: CaseWorkspaceInput): ObjectWorkspaceView {
  const isFixture = Boolean(input.sourcePlatform?.startsWith('fixture'));
  const stage = input.currentStage as CommerceStage;
  const stageStatus = input.stageStatus as CommerceStageStatus;

  const graph = projectCaseKnowledgeGraph({
    caseId: input.caseId,
    caseLabel: input.productTitle,
    productId: input.productId,
    productTitle: input.productTitle,
    productSourcePlatform: input.sourcePlatform,
    supplierIds: (input.offers ?? []).map((o, i) => ({
      id: o.supplierId ?? `supplier-${i}`,
      name: o.supplierName,
    })),
    listingIds: (input.listings ?? []).map((l) => ({ id: l.id, status: l.status })),
    opportunityIds: input.opportunity?.id ? [input.opportunity.id] : [],
    orderIds: input.orders,
    paymentIds: (input.payments ?? []).map((p) => p.id),
    shipmentIds: (input.shipments ?? []).map((s) => s.id),
    artifactIds: (input.artifacts ?? []).map((a) => ({
      id: a.id,
      kind: a.artifactType,
    })),
    approvalIds: (input.approvals ?? []).map((a) => a.id),
    connectorKeys: input.connectors,
    aiRunIds: (input.aiRuns ?? []).map((r) => r.id),
    signalIds: (input.signals ?? []).map((s) => s.id),
  });

  const sections = COMMERCE_CASE_SECTIONS;
  const byId = Object.fromEntries(sections.map((s) => [s.id, s])) as Record<
    ObjectWorkspaceSectionId,
    ObjectWorkspaceSection
  >;

  const panels: ObjectWorkspacePanel[] = [
    panel(byId.overview, undefined, {
      caseId: input.caseId,
      productId: input.productId,
      stage: input.currentStage,
      stageStatus: input.stageStatus,
      opportunityScore: input.opportunityScore,
      expectedProfitMinor: input.expectedProfitMinor,
      currency: input.currency,
      confidence: input.confidence,
      isFixtureSource: isFixture,
    }),
    panel(byId.lifecycle, undefined, {
      currentStage: input.currentStage,
      stageStatus: input.stageStatus,
    }),
    panel(
      byId.next_action,
      input.nextActionLabel
        ? [
            {
              id: 'next',
              title: input.nextActionLabel,
              subtitle: input.nextActionCode ?? undefined,
              href: input.nextHref ?? `/terminal/process/${input.caseId}`,
            },
          ]
        : [],
      {
        blockerCode: input.blockerCode,
        blockerMessage: input.blockerMessage,
      },
    ),
    panel(byId.research, undefined, {
      category: input.productCategory,
      sourcePlatform: input.sourcePlatform,
      policy: input.policy?.outcome ?? null,
      policyReasons: input.policy?.reasons ?? [],
      confidence: input.confidence,
    }),
    panel(
      byId.suppliers,
      (input.offers ?? []).map((o, i) => ({
        id: o.id ?? `offer-${i}`,
        title: o.supplierName,
        subtitle: `cost ${o.costMinor} + ship ${o.shippingCostMinor}`,
      })),
    ),
    panel(byId.pricing, undefined, {
      ...(input.economics ?? {}),
      expectedProfitMinor: input.expectedProfitMinor,
      currency: input.currency,
    }),
    panel(
      byId.media,
      (input.artifacts ?? []).map((a) => ({
        id: a.id,
        title: a.title || a.artifactType,
        subtitle: a.purpose,
        href: `/terminal/products/${input.productId}`,
      })),
    ),
    panel(
      byId.opportunities,
      input.opportunity
        ? [
            {
              id: input.opportunity.id ?? 'opp',
              title: `Score ${input.opportunity.score}`,
              subtitle: input.opportunity.currentSignal ?? input.opportunity.explanation,
              href: '/terminal/opportunities',
            },
          ]
        : [],
    ),
    panel(
      byId.listings,
      (input.listings ?? []).map((l) => ({
        id: l.id,
        title: l.status,
        subtitle: l.priceMinor != null ? String(l.priceMinor) : undefined,
        href: '/terminal/listings',
      })),
    ),
    panel(byId.inventory, undefined, {
      quantity: input.inventory?.quantity ?? null,
      note: input.inventory?.atpNote ?? null,
    }),
    panel(
      byId.orders,
      (input.orders ?? []).map((o) => ({
        id: o.id,
        title: o.externalId ?? o.id.slice(0, 8),
        subtitle: o.status,
        href: '/terminal/orders',
      })),
    ),
    panel(
      byId.shipments,
      (input.shipments ?? []).map((s) => ({
        id: s.id,
        title: s.id.slice(0, 8),
        subtitle: s.status,
        href: '/terminal/fulfillment',
      })),
    ),
    panel(
      byId.payments,
      (input.payments ?? []).map((p) => ({
        id: p.id,
        title: p.id.slice(0, 8),
        subtitle: p.status,
        href: '/terminal/finance/payments',
      })),
    ),
    panel(
      byId.ai,
      (input.aiRuns ?? []).map((r) => ({
        id: r.id,
        title: r.objective.slice(0, 60),
        subtitle: r.status,
        href: `/terminal/objectives/${r.id}`,
      })),
      {
        suggestedObjective: `Resolve case for ${input.productTitle} at stage ${input.currentStage}.`,
      },
    ),
    panel(
      byId.approvals,
      (input.approvals ?? []).map((a) => ({
        id: a.id,
        title: a.kind ?? 'approval',
        subtitle: a.status,
        href: '/terminal/approvals',
      })),
    ),
    panel(
      byId.signals,
      (input.signals ?? []).map((s) => ({
        id: s.id,
        title: s.signal,
        subtitle: s.rationale,
        href: '/terminal/signals',
      })),
    ),
    panel(byId.documents, (input.artifacts ?? [])
      .filter((a) => a.artifactType === 'document' || a.purpose?.includes('manual'))
      .map((a) => ({
        id: a.id,
        title: a.title || a.artifactType,
        subtitle: a.purpose,
      }))),
    panel(byId.analytics, undefined, {
      opportunityScore: input.opportunityScore,
      expectedProfitMinor: input.expectedProfitMinor,
      confidence: input.confidence,
    }),
    panel(byId.workflows, [], { note: 'Workflow runs linked via AI/operator history.' }),
    panel(
      byId.connectors,
      (input.connectors ?? []).map((c) => ({
        id: c.key,
        title: c.key,
        subtitle: c.isFixture ? 'TEST FIXTURE' : 'live',
        href: '/terminal/connectors',
      })),
    ),
    panel(
      byId.relationships,
      graph.nodes.slice(0, 24).map((n) => ({
        id: `${n.type}:${n.id}`,
        title: n.label,
        subtitle: n.type,
        href: n.href,
      })),
      { edgeCount: graph.edges.length, nodeCount: graph.nodes.length },
    ),
    panel(
      byId.history,
      (input.history ?? []).map((h, i) => ({
        id: `h-${i}`,
        title: `${h.stage} · ${h.status}`,
        subtitle: h.note ?? h.at,
      })),
    ),
  ];

  const related: BusinessObjectRef[] = [
    {
      type: 'product',
      id: input.productId,
      label: input.productTitle,
      href: `/terminal/products/${input.productId}`,
      isFixture,
      sourcePlatform: input.sourcePlatform,
    },
    {
      type: 'commerce_case',
      id: input.caseId,
      label: 'Commerce Case',
      href: `/terminal/process/${input.caseId}`,
      isFixture,
    },
  ];

  const tools = [
    ...new Set(
      sections.flatMap((s) => s.aiTools ?? []).concat(['searchConnectedProducts', 'listConnectorCapabilities']),
    ),
  ];

  return {
    objectType: 'commerce_case',
    objectId: input.caseId,
    title: input.productTitle,
    subtitle: `${input.productCategory ?? 'product'} · ${input.currentStage} · ${input.stageStatus}${
      isFixture ? ' · TEST FIXTURE' : ''
    }`,
    stage,
    stageStatus,
    nextAction: {
      code: input.nextActionCode,
      label: input.nextActionLabel,
      href: input.nextHref ?? `/terminal/process/${input.caseId}`,
    },
    blocker: {
      code: input.blockerCode,
      message: input.blockerMessage,
    },
    sections,
    panels,
    related,
    graph,
    aiContext: {
      preamble: [
        `Commerce Case ${input.caseId} for product "${input.productTitle}".`,
        `Stage: ${input.currentStage} (${input.stageStatus}).`,
        input.nextActionLabel ? `Next action: ${input.nextActionLabel}.` : null,
        input.blockerMessage ? `Blocker: ${input.blockerMessage}.` : null,
        isFixture ? 'Source is TEST FIXTURE — never claim live marketplace truth.' : null,
        'Operate only through TradeOps tools and connector capabilities — never vendor-specific APIs.',
      ]
        .filter(Boolean)
        .join(' '),
      suggestedObjective:
        input.nextActionLabel ??
        `Advance commerce case for ${input.productTitle} from ${input.currentStage}.`,
      tools,
    },
    honesty: {
      note: 'Object workspace is the OS surface for this Commerce Case. Stage list pages are filters over the same spine.',
      isFixtureSource: isFixture,
    },
    computedAt: new Date().toISOString(),
  };
}
