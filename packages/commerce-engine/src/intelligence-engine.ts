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
  /** Seed/demo catalog only — do not treat fixture policy walls as the product crisis. */
  const fixtureOnly =
    signals.productCount > 0 &&
    signals.fixtureProductCount > 0 &&
    signals.liveProductCount === 0;

  // Founder / researcher default: lead with live market research when store is demo-only.
  if (fixtureOnly && (p === 'researcher' || p === 'executive' || p === 'operator')) {
    insights.push({
      id: 'ins-research-first',
      kind: 'opportunity',
      title: 'Research live product opportunities',
      detail:
        'Demo catalog only — use AI + web research for real market candidates, not seed SKUs.',
      urgencyScore: p === 'researcher' ? 78 : 62,
      confidence: 0.95,
      href: '/terminal/workspace',
      personaRelevance: weight(p, 'opportunity'),
      evidence: [
        `fixtureProductCount=${signals.fixtureProductCount}`,
        'liveProductCount=0',
        'path=ecommerce_web_first',
      ],
      suggestedObjective:
        'Find concrete product opportunities worth reselling online right now with rough price bands and sources. Prefer public market research; do not rank demo catalog SKUs.',
      suggestedAiQuery: 'Find products worth selling this week',
    });
  }

  if (signals.openBlockers > 0) {
    insights.push({
      id: 'ins-blockers',
      kind: 'blocker',
      title: fixtureOnly
        ? `${signals.openBlockers} demo case blocker${signals.openBlockers === 1 ? '' : 's'}`
        : `${signals.openBlockers} critical blocker${signals.openBlockers === 1 ? '' : 's'}`,
      detail: fixtureOnly
        ? 'Seed cases are blocked by design (policy rehearsal). Prefer AI market research until live products exist.'
        : 'Process tasks are blocked — commerce cases cannot advance until resolved.',
      urgencyScore: fixtureOnly
        ? Math.min(40, 22 + signals.openBlockers * 4)
        : Math.min(100, 70 + signals.openBlockers * 8),
      confidence: 0.95,
      href: '/terminal/tasks',
      personaRelevance: weight(p, 'blocker') * (fixtureOnly ? 0.55 : 1),
      evidence: [
        `openBlockers=${signals.openBlockers}`,
        fixtureOnly ? 'fixtureOnly=true' : 'fixtureOnly=false',
      ],
      suggestedObjective: fixtureOnly
        ? 'Ignore demo case blockers for discovery. Research live product opportunities with web sources instead.'
        : `Resolve the ${signals.openBlockers} open process blockers and recommend the next unblocked case action.`,
      suggestedAiQuery: fixtureOnly
        ? 'Find products worth selling this week'
        : 'What blockers should I clear first?',
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
      title: fixtureOnly
        ? `${signals.stalledCaseCount} demo case${signals.stalledCaseCount === 1 ? '' : 's'} on the board`
        : `${signals.stalledCaseCount} stalled Commerce Case${signals.stalledCaseCount === 1 ? '' : 's'}`,
      detail: fixtureOnly
        ? hint
          ? `Seed example: ${hint.title} (${hint.stage}/${hint.status}) — not live inventory.`
          : 'Seed cases for process rehearsal only.'
        : hint
          ? `Example: ${hint.title} at ${hint.stage}/${hint.status}`
          : 'Cases waiting or blocked without progress.',
      urgencyScore: fixtureOnly
        ? Math.min(35, 18 + signals.stalledCaseCount * 3)
        : Math.min(100, 48 + signals.stalledCaseCount * 7),
      confidence: 0.85,
      href: hint ? `/terminal/process/${hint.caseId}` : '/terminal/process',
      personaRelevance: weight(p, 'stalled_case') * (fixtureOnly ? 0.5 : 1),
      evidence: [`stalledCaseCount=${signals.stalledCaseCount}`],
      suggestedObjective: fixtureOnly
        ? 'Use AI to research live market products instead of advancing demo cases.'
        : `Unstick stalled Commerce Cases: identify stage blockers and the next transformation for each.`,
      suggestedAiQuery: fixtureOnly
        ? 'Find products worth selling this week'
        : 'Which commerce cases are stuck?',
    });
  }

  if (
    !fixtureOnly &&
    (signals.highOpportunityCount > 0 || (signals.topOpportunityScore ?? 0) >= 60)
  ) {
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
      title: fixtureOnly
        ? `${signals.signalBlockedCount} demo policy signal${signals.signalBlockedCount === 1 ? '' : 's'}`
        : `${signals.signalBlockedCount} policy/blocked signal${signals.signalBlockedCount === 1 ? '' : 's'}`,
      detail: fixtureOnly
        ? 'Fixture SKUs intentionally fail publish policy — expected for seed data, not a live store outage.'
        : 'Products or actions blocked by policy — review before capital or publish.',
      urgencyScore: fixtureOnly
        ? Math.min(30, 16 + signals.signalBlockedCount * 3)
        : Math.min(95, 55 + signals.signalBlockedCount * 8),
      confidence: 0.88,
      href: '/terminal/signals',
      personaRelevance: weight(p, 'blocker') * (fixtureOnly ? 0.45 : 1),
      evidence: [`signalBlockedCount=${signals.signalBlockedCount}`],
      suggestedObjective: fixtureOnly
        ? 'Skip demo policy walls. Research real products on the open web for evaluation.'
        : `Explain blocked commerce signals and whether any can be remediated safely.`,
      suggestedAiQuery: fixtureOnly
        ? 'Find products worth selling this week'
        : 'Explain blocked signals',
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
      title: 'Demo catalog only (seed data)',
      detail: `${signals.fixtureProductCount} seed products for walkthroughs — not live marketplace inventory. AI research uses the public web.`,
      urgencyScore: 24,
      confidence: 1,
      href: '/terminal/connectors',
      personaRelevance: weight(p, 'data_quality') * 0.7,
      evidence: [
        `fixtureProductCount=${signals.fixtureProductCount}`,
        'liveProductCount=0',
      ],
      suggestedObjective:
        'Find real product opportunities via web research; connect a live supplier when you are ready to import inventory.',
      suggestedAiQuery: 'Find products worth selling this week',
    });
  } else if (
    signals.fixtureProductCount > 0 &&
    signals.liveProductCount > 0 &&
    signals.fixtureProductCount >= signals.liveProductCount
  ) {
    // Mixed catalog: majority fixtures can silently skew KPIs if isolation is off
    insights.push({
      id: 'ins-fixture-skew',
      kind: 'data_quality',
      title: 'Fixture products dominate the catalog',
      detail: `${signals.fixtureProductCount} fixture vs ${signals.liveProductCount} live/canonical — KPI totals may be skewed unless production isolation is on.`,
      urgencyScore: 36,
      confidence: 0.95,
      href: '/terminal/portfolio',
      personaRelevance: weight(p, 'data_quality'),
      evidence: [
        `fixtureProductCount=${signals.fixtureProductCount}`,
        `liveProductCount=${signals.liveProductCount}`,
      ],
      suggestedObjective:
        'Enable TRADEOPS_PRODUCTION_WORKSPACE=1 to exclude fixtures from scanner/portfolio KPIs, or remove fixture imports from this org.',
      suggestedAiQuery: 'How do I isolate production KPIs from fixtures?',
    });
  }

  if (signals.liveConnectorCount === 0 && signals.connectorIssues === 0) {
    insights.push({
      id: 'ins-no-live',
      kind: 'connector',
      title: fixtureOnly
        ? 'Live storefront not connected yet'
        : 'No live connectors connected',
      detail: fixtureOnly
        ? 'Optional next step: connect Shopify/Amazon/supplier when you leave demo mode. AI web research works without it.'
        : 'Registry may list vendors, but none are live-connected for this org.',
      urgencyScore: fixtureOnly ? 18 : 28,
      confidence: 0.9,
      href: '/terminal/connectors',
      personaRelevance: weight(p, 'connector') * (fixtureOnly ? 0.6 : 1),
      evidence: ['liveConnectorCount=0'],
      suggestedObjective: fixtureOnly
        ? 'Research market opportunities with AI first; outline which connector to connect when importing live inventory.'
        : 'List which production connectors to connect first for this persona mission and required env credentials.',
      suggestedAiQuery: fixtureOnly
        ? 'Find products worth selling this week'
        : 'Which connectors should I connect first?',
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
      return s.liveProductCount === 0
        ? `Find concrete product opportunities worth reselling online right now with rough price bands and sources. Prefer public web research; do not rank demo catalog SKUs.`
        : `Discover and rank product candidates with economics and policy risk. Store has ${s.productCount} products (${s.liveProductCount} live).`;
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
