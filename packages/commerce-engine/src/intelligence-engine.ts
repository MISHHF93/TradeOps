/**
 * Operational Intelligence Engine — makes TradeOps a smart Commerce OS.
 *
 * Pure functions: live org signals → ranked insights → focus objective →
 * adaptive priorities. No fabricated metrics; every insight has evidence + confidence.
 *
 * Used by Workspace Resolver, AI Operator preamble, and proactive UI chips.
 */

import type { OperatingPersona } from './workspace';

// ─── Signal inputs (host loads from DB / connectors) ─────────────────────────

export type IntelligenceSignals = {
  persona: OperatingPersona;
  organizationName?: string;
  /** Counts */
  pendingApprovals: number;
  openTasks: number;
  openBlockers: number;
  activeCaseCount: number;
  connectorIssues: number;
  productCount: number;
  fixtureProductCount: number;
  liveProductCount: number;
  /** Orders awaiting fulfillment-like action */
  openOrderCount: number;
  /** Cases stuck (blocked / waiting) */
  stalledCaseCount: number;
  /** High-score opportunities ready for evaluate/prepare */
  highOpportunityCount: number;
  /** Top opportunity score 0–100 if any */
  topOpportunityScore: number | null;
  /** Live-connected non-fixture connectors */
  liveConnectorCount: number;
  /** Recent operator runs (knowledge) */
  recentObjectiveCount: number;
  /** Failed AI runs */
  failedRunCount: number;
  /** Commerce signals (buy/watch/blocked) if available */
  signalBuyCount: number;
  signalBlockedCount: number;
  /** Simulation mode */
  simulationMode: boolean;
  /** Active cases with titles for narrative */
  caseHints?: Array<{
    caseId: string;
    title: string;
    stage: string;
    status: string;
    nextAction?: string | null;
  }>;
  now?: Date;
};

export type InsightKind =
  | 'blocker'
  | 'approval'
  | 'fulfillment'
  | 'connector'
  | 'opportunity'
  | 'stalled_case'
  | 'data_quality'
  | 'learning'
  | 'healthy'
  | 'simulation';

export type RankedInsight = {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  /** 0–100 urgency for ranking */
  urgencyScore: number;
  confidence: number;
  href: string;
  personaRelevance: number;
  evidence: string[];
  suggestedObjective: string;
  suggestedAiQuery?: string;
};

export type IntelligenceBrief = {
  generatedAt: string;
  attentionScore: number;
  healthLabel: 'critical' | 'attention' | 'stable' | 'opportunity';
  narrative: string;
  focusObjective: string;
  insights: RankedInsight[];
  topInsight: RankedInsight | null;
  recommendedActions: Array<{
    label: string;
    href: string;
    reason: string;
    urgencyScore: number;
  }>;
  kpis: Array<{
    id: string;
    label: string;
    value: number | string;
    tone: 'neutral' | 'positive' | 'warning' | 'critical';
    href?: string;
  }>;
  learningHints: string[];
  honesty: {
    note: string;
    liveSignals: number;
    derivedSignals: number;
  };
};

// ─── Persona weights (what this role cares about) ────────────────────────────

const PERSONA_WEIGHTS: Record<
  OperatingPersona,
  Partial<Record<InsightKind, number>>
> = {
  executive: {
    approval: 1.4,
    blocker: 1.3,
    opportunity: 0.9,
    stalled_case: 1.0,
    connector: 0.6,
    fulfillment: 0.8,
    data_quality: 0.7,
    learning: 0.5,
    healthy: 0.4,
    simulation: 0.8,
  },
  operator: {
    blocker: 1.5,
    fulfillment: 1.4,
    approval: 1.2,
    stalled_case: 1.3,
    opportunity: 0.7,
    connector: 0.5,
    data_quality: 0.6,
    learning: 0.4,
    healthy: 0.3,
    simulation: 0.7,
  },
  researcher: {
    opportunity: 1.5,
    data_quality: 1.2,
    stalled_case: 0.8,
    blocker: 0.7,
    connector: 0.9,
    approval: 0.4,
    fulfillment: 0.3,
    learning: 0.8,
    healthy: 0.4,
    simulation: 0.9,
  },
  analyst: {
    opportunity: 1.3,
    learning: 1.4,
    data_quality: 1.1,
    stalled_case: 0.9,
    blocker: 0.8,
    approval: 0.5,
    fulfillment: 0.4,
    connector: 0.6,
    healthy: 0.5,
    simulation: 0.8,
  },
  developer: {
    connector: 1.6,
    blocker: 1.0,
    data_quality: 1.1,
    learning: 0.9,
    stalled_case: 0.7,
    opportunity: 0.4,
    approval: 0.3,
    fulfillment: 0.3,
    healthy: 0.4,
    simulation: 0.7,
  },
  administrator: {
    connector: 1.2,
    approval: 0.8,
    data_quality: 1.0,
    learning: 0.7,
    blocker: 0.9,
    healthy: 0.6,
    simulation: 1.0,
    opportunity: 0.3,
    fulfillment: 0.3,
    stalled_case: 0.5,
  },
};

function weight(persona: OperatingPersona, kind: InsightKind): number {
  return PERSONA_WEIGHTS[persona][kind] ?? 1;
}

// ─── Insight generation ──────────────────────────────────────────────────────

export function generateInsights(signals: IntelligenceSignals): RankedInsight[] {
  const insights: RankedInsight[] = [];
  const p = signals.persona;

  if (signals.openBlockers > 0) {
    insights.push({
      id: 'ins-blockers',
      kind: 'blocker',
      title: `${signals.openBlockers} critical blocker${signals.openBlockers === 1 ? '' : 's'}`,
      detail: 'Process tasks are blocked — commerce cases cannot advance until resolved.',
      urgencyScore: Math.min(100, 70 + signals.openBlockers * 8),
      confidence: 0.95,
      href: '/terminal/tasks',
      personaRelevance: weight(p, 'blocker'),
      evidence: [`openBlockers=${signals.openBlockers}`],
      suggestedObjective: `Resolve the ${signals.openBlockers} open process blockers and recommend the next unblocked case action.`,
      suggestedAiQuery: 'What blockers should I clear first?',
    });
  }

  if (signals.pendingApprovals > 0) {
    insights.push({
      id: 'ins-approvals',
      kind: 'approval',
      title: `${signals.pendingApprovals} approval${signals.pendingApprovals === 1 ? '' : 's'} waiting`,
      detail: 'Consequential actions (publish/PO) need a human decision.',
      urgencyScore: Math.min(100, 60 + signals.pendingApprovals * 10),
      confidence: 1,
      href: '/terminal/approvals',
      personaRelevance: weight(p, 'approval'),
      evidence: [`pendingApprovals=${signals.pendingApprovals}`],
      suggestedObjective: `Review pending approvals and decide which listings or POs to approve, reject, or request more evidence for.`,
      suggestedAiQuery: 'What should I approve today?',
    });
  }

  if (signals.openOrderCount > 0) {
    insights.push({
      id: 'ins-orders',
      kind: 'fulfillment',
      title: `${signals.openOrderCount} open order${signals.openOrderCount === 1 ? '' : 's'}`,
      detail: 'Customer orders need source/fulfill attention.',
      urgencyScore: Math.min(100, 55 + signals.openOrderCount * 6),
      confidence: 0.9,
      href: '/terminal/orders',
      personaRelevance: weight(p, 'fulfillment'),
      evidence: [`openOrderCount=${signals.openOrderCount}`],
      suggestedObjective: `Prioritize open customer orders: identify fulfillment risks and next operator actions.`,
      suggestedAiQuery: 'Show orders needing fulfillment',
    });
  }

  if (signals.connectorIssues > 0) {
    insights.push({
      id: 'ins-connectors',
      kind: 'connector',
      title: `${signals.connectorIssues} connector issue${signals.connectorIssues === 1 ? '' : 's'}`,
      detail: 'Credentials missing, expired, or unhealthy — live sync may be stalled.',
      urgencyScore: Math.min(100, 50 + signals.connectorIssues * 12),
      confidence: 0.92,
      href: '/terminal/connectors',
      personaRelevance: weight(p, 'connector'),
      evidence: [
        `connectorIssues=${signals.connectorIssues}`,
        `liveConnectors=${signals.liveConnectorCount}`,
      ],
      suggestedObjective: `Diagnose connector health: which providers need credentials, and what live sync would unlock?`,
      suggestedAiQuery: 'Review connector health',
    });
  }

  if (signals.stalledCaseCount > 0) {
    const hint = signals.caseHints?.find((c) => /block|wait/i.test(c.status));
    insights.push({
      id: 'ins-stalled',
      kind: 'stalled_case',
      title: `${signals.stalledCaseCount} stalled Commerce Case${signals.stalledCaseCount === 1 ? '' : 's'}`,
      detail: hint
        ? `Example: ${hint.title} at ${hint.stage}/${hint.status}`
        : 'Cases waiting or blocked without progress.',
      urgencyScore: Math.min(100, 48 + signals.stalledCaseCount * 7),
      confidence: 0.85,
      href: hint ? `/terminal/process/${hint.caseId}` : '/terminal/process',
      personaRelevance: weight(p, 'stalled_case'),
      evidence: [`stalledCaseCount=${signals.stalledCaseCount}`],
      suggestedObjective: `Unstick stalled Commerce Cases: identify stage blockers and the next transformation for each.`,
      suggestedAiQuery: 'Which commerce cases are stuck?',
    });
  }

  if (signals.highOpportunityCount > 0 || (signals.topOpportunityScore ?? 0) >= 60) {
    const score = signals.topOpportunityScore ?? 0;
    insights.push({
      id: 'ins-opps',
      kind: 'opportunity',
      title:
        score > 0
          ? `Top opportunity score ${score}`
          : `${signals.highOpportunityCount} strong opportunities`,
      detail: 'Scored candidates ready for deeper evaluate or prepare handoff.',
      urgencyScore: Math.min(90, 35 + score * 0.4 + signals.highOpportunityCount * 5),
      confidence: 0.75,
      href: '/terminal/opportunities',
      personaRelevance: weight(p, 'opportunity'),
      evidence: [
        `highOpportunityCount=${signals.highOpportunityCount}`,
        `topScore=${score}`,
      ],
      suggestedObjective: `Rank the strongest product opportunities by contribution margin and policy risk; recommend next research or prepare steps.`,
      suggestedAiQuery: 'Find products worth evaluating',
    });
  }

  if (signals.signalBlockedCount > 0) {
    insights.push({
      id: 'ins-policy',
      kind: 'blocker',
      title: `${signals.signalBlockedCount} policy/blocked signal${signals.signalBlockedCount === 1 ? '' : 's'}`,
      detail: 'Products or actions blocked by policy — review before capital or publish.',
      urgencyScore: Math.min(95, 55 + signals.signalBlockedCount * 8),
      confidence: 0.88,
      href: '/terminal/signals',
      personaRelevance: weight(p, 'blocker'),
      evidence: [`signalBlockedCount=${signals.signalBlockedCount}`],
      suggestedObjective: `Explain blocked commerce signals and whether any can be remediated safely.`,
      suggestedAiQuery: 'Explain blocked signals',
    });
  }

  // Data quality / empty store
  if (signals.productCount === 0) {
    insights.push({
      id: 'ins-empty',
      kind: 'data_quality',
      title: 'No products in catalog',
      detail: 'Import supplier data or connect a live storefront to unlock evaluation.',
      urgencyScore: 40,
      confidence: 1,
      href: '/terminal',
      personaRelevance: weight(p, 'data_quality'),
      evidence: ['productCount=0'],
      suggestedObjective:
        'Guide product import: fixture for rehearsal or live connector credentials for production data.',
      suggestedAiQuery: 'How do I import products?',
    });
  } else if (
    signals.fixtureProductCount > 0 &&
    signals.liveProductCount === 0
  ) {
    insights.push({
      id: 'ins-fixture-only',
      kind: 'data_quality',
      title: 'Catalog is fixture-only',
      detail: `${signals.fixtureProductCount} TEST FIXTURE products — not live marketplace truth.`,
      urgencyScore: 32,
      confidence: 1,
      href: '/terminal/connectors',
      personaRelevance: weight(p, 'data_quality'),
      evidence: [
        `fixtureProductCount=${signals.fixtureProductCount}`,
        'liveProductCount=0',
      ],
      suggestedObjective:
        'Connect a live supplier or storefront so KPIs move off fixture data; label simulation until then.',
      suggestedAiQuery: 'Connect live Shopify products',
    });
  }

  if (signals.liveConnectorCount === 0 && signals.connectorIssues === 0) {
    insights.push({
      id: 'ins-no-live',
      kind: 'connector',
      title: 'No live connectors connected',
      detail: 'Registry may list vendors, but none are live-connected for this org.',
      urgencyScore: 28,
      confidence: 0.9,
      href: '/terminal/connectors',
      personaRelevance: weight(p, 'connector'),
      evidence: ['liveConnectorCount=0'],
      suggestedObjective:
        'List which production connectors to connect first for this persona mission and required env credentials.',
      suggestedAiQuery: 'Which connectors should I connect first?',
    });
  }

  if (signals.failedRunCount > 0) {
    insights.push({
      id: 'ins-failed-ai',
      kind: 'learning',
      title: `${signals.failedRunCount} failed AI objective run${signals.failedRunCount === 1 ? '' : 's'}`,
      detail: 'Recent operator runs failed — review for tool or data issues.',
      urgencyScore: Math.min(70, 25 + signals.failedRunCount * 10),
      confidence: 0.8,
      href: '/terminal/objectives',
      personaRelevance: weight(p, 'learning'),
      evidence: [`failedRunCount=${signals.failedRunCount}`],
      suggestedObjective: 'Diagnose failed AI objective runs and propose a recovery path.',
      suggestedAiQuery: 'Why did my last AI run fail?',
    });
  }

  if (signals.simulationMode) {
    insights.push({
      id: 'ins-sim',
      kind: 'simulation',
      title: 'Simulation mode active',
      detail: 'TRADEOPS_SIMULATION_MODE — fixture/synthetic data may appear; label all outputs.',
      urgencyScore: 20,
      confidence: 1,
      href: '/terminal/workspace',
      personaRelevance: weight(p, 'simulation'),
      evidence: ['TRADEOPS_SIMULATION_MODE'],
      suggestedObjective:
        'Operate in simulation: only recommend fixture-safe actions and never claim live marketplace publish.',
    });
  }

  // Healthy baseline when quiet
  if (insights.length === 0) {
    insights.push({
      id: 'ins-healthy',
      kind: 'healthy',
      title: 'Operations look stable',
      detail: 'No critical blockers, approvals, or connector failures detected.',
      urgencyScore: 10,
      confidence: 0.7,
      href: personaHome(p),
      personaRelevance: weight(p, 'healthy'),
      evidence: [
        `activeCases=${signals.activeCaseCount}`,
        `tasks=${signals.openTasks}`,
        `products=${signals.productCount}`,
      ],
      suggestedObjective: defaultMissionObjective(p, signals),
      suggestedAiQuery: defaultMissionObjective(p, signals),
    });
  }

  // Rank by urgency × persona relevance
  return insights
    .map((i) => ({
      ...i,
      urgencyScore: Math.round(i.urgencyScore * i.personaRelevance * 10) / 10,
    }))
    .sort((a, b) => b.urgencyScore - a.urgencyScore);
}

function personaHome(p: OperatingPersona): string {
  return `/terminal/workspace/${p}`;
}

function defaultMissionObjective(p: OperatingPersona, s: IntelligenceSignals): string {
  switch (p) {
    case 'executive':
      return `Summarize portfolio health for ${s.organizationName ?? 'this org'}: ${s.activeCaseCount} cases, ${s.pendingApprovals} approvals, cash and risk posture. Recommend board-level actions only.`;
    case 'operator':
      return `Focus on open Commerce Cases ready to prepare, approve, publish, or fulfill. ${s.activeCaseCount} active cases, ${s.openOrderCount} open orders.`;
    case 'researcher':
      return `Discover and rank product candidates with economics and policy risk. Store has ${s.productCount} products (${s.liveProductCount} live).`;
    case 'analyst':
      return `Explain signals and portfolio composition. Highlight learning from recent outcomes (${s.recentObjectiveCount} recent AI runs).`;
    case 'developer':
      return `Inspect connector health and capability readiness. ${s.liveConnectorCount} live, ${s.connectorIssues} issues. Prefer diagnostics and shadow runs.`;
    case 'administrator':
      return `Review org setup, seats, billing, and access posture. Flag simulation or fixture data if present.`;
  }
}

// ─── Brief assembly ──────────────────────────────────────────────────────────

export function buildIntelligenceBrief(signals: IntelligenceSignals): IntelligenceBrief {
  const now = signals.now ?? new Date();
  const insights = generateInsights(signals);
  const top = insights[0] ?? null;

  const attentionScore = Math.min(
    100,
    Math.round(
      (signals.openBlockers * 18 +
        signals.pendingApprovals * 12 +
        signals.stalledCaseCount * 8 +
        signals.connectorIssues * 10 +
        signals.openOrderCount * 6 +
        (signals.productCount === 0 ? 15 : 0) +
        signals.failedRunCount * 5) /
        1.2,
    ),
  );

  const healthLabel: IntelligenceBrief['healthLabel'] =
    attentionScore >= 70
      ? 'critical'
      : attentionScore >= 40
        ? 'attention'
        : (signals.topOpportunityScore ?? 0) >= 70 || signals.highOpportunityCount >= 3
          ? 'opportunity'
          : 'stable';

  const focusObjective =
    top?.suggestedObjective ?? defaultMissionObjective(signals.persona, signals);

  const narrativeParts = [
    `${signals.organizationName ?? 'Workspace'} · ${signals.persona} intelligence.`,
    top
      ? `Top signal: ${top.title} (urgency ${top.urgencyScore}, confidence ${(top.confidence * 100).toFixed(0)}%).`
      : 'No ranked signals.',
    `${signals.activeCaseCount} cases · ${signals.openTasks} tasks · ${signals.openBlockers} blockers · ${signals.liveConnectorCount} live connectors · ${signals.productCount} products (${signals.liveProductCount} live).`,
    healthLabel === 'critical'
      ? 'Attention required before new expansion work.'
      : healthLabel === 'opportunity'
        ? 'Stable enough to pursue ranked opportunities.'
        : healthLabel === 'attention'
          ? 'Clear the attention queue, then resume mission work.'
          : 'Stable — continue persona mission.',
  ];

  const recommendedActions = insights.slice(0, 5).map((i) => ({
    label: i.title,
    href: i.href,
    reason: i.detail,
    urgencyScore: i.urgencyScore,
  }));

  const kpis: IntelligenceBrief['kpis'] = [
    {
      id: 'attention',
      label: 'Attention score',
      value: attentionScore,
      tone:
        attentionScore >= 70 ? 'critical' : attentionScore >= 40 ? 'warning' : 'positive',
      href: personaHome(signals.persona),
    },
    {
      id: 'blockers',
      label: 'Blockers',
      value: signals.openBlockers,
      tone: signals.openBlockers > 0 ? 'critical' : 'positive',
      href: '/terminal/tasks',
    },
    {
      id: 'cases',
      label: 'Active cases',
      value: signals.activeCaseCount,
      tone: 'neutral',
      href: '/terminal/process',
    },
    {
      id: 'approvals',
      label: 'Approvals',
      value: signals.pendingApprovals,
      tone: signals.pendingApprovals > 0 ? 'warning' : 'neutral',
      href: '/terminal/approvals',
    },
    {
      id: 'live',
      label: 'Live connectors',
      value: signals.liveConnectorCount,
      tone: signals.liveConnectorCount === 0 ? 'warning' : 'positive',
      href: '/terminal/connectors',
    },
    {
      id: 'products',
      label: 'Products (live)',
      value: `${signals.liveProductCount}/${signals.productCount}`,
      tone: signals.liveProductCount === 0 && signals.productCount > 0 ? 'warning' : 'neutral',
      href: '/terminal',
    },
  ];

  const learningHints: string[] = [];
  if (signals.recentObjectiveCount > 0) {
    learningHints.push(
      `${signals.recentObjectiveCount} recent objective runs available for knowledge transfer.`,
    );
  }
  if (signals.fixtureProductCount > 0) {
    learningHints.push('Separate fixture vs live product counts in every recommendation.');
  }
  if (signals.liveConnectorCount === 0) {
    learningHints.push('Prefer connect-live paths over claiming market truth.');
  }

  const liveSignals = insights.filter((i) =>
    ['blocker', 'approval', 'fulfillment', 'connector', 'stalled_case'].includes(i.kind),
  ).length;

  return {
    generatedAt: now.toISOString(),
    attentionScore,
    healthLabel,
    narrative: narrativeParts.join(' '),
    focusObjective,
    insights,
    topInsight: top,
    recommendedActions,
    kpis,
    learningHints,
    honesty: {
      note: 'Insights derived from org counts and connector status — not fabricated KPIs. Confidence reflects source quality.',
      liveSignals,
      derivedSignals: insights.length - liveSignals,
    },
  };
}

/**
 * Map intelligence brief into workspace priority rows.
 */
export function insightsToPriorities(
  insights: RankedInsight[],
): Array<{
  id: string;
  label: string;
  href: string;
  urgency: 'critical' | 'high' | 'normal';
  reason: string;
}> {
  return insights.slice(0, 5).map((i) => ({
    id: i.id,
    label: i.title,
    href: i.href,
    urgency:
      i.urgencyScore >= 70 ? 'critical' : i.urgencyScore >= 40 ? 'high' : 'normal',
    reason: `${i.detail} · conf ${(i.confidence * 100).toFixed(0)}%`,
  }));
}
