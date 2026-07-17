import {
  assessProductPolicy,
  calculateUnitEconomics,
  scoreOpportunity,
} from '@tradeops/commerce-engine';
import { decideFromPasses, runAuditorPass, runCriticPass } from './critic-auditor';
import { invokeTool, listTools } from './tool-registry';
import type {
  ObjectiveType,
  OperationLoopMode,
  OperatorCycleResult,
  OperatorPlan,
  RecommendationDraft,
  TimelineStep,
  ToolExecutionContext,
  ToolTraceEntry,
} from './types';

export type OperatorProduct = {
  productId: string;
  title: string;
  description: string;
  category: string;
  sourcePlatform: string;
  supplierCostMinor: number;
  shippingCostMinor: number;
  targetPriceMinor: number;
  marketplaceFeeMinor: number;
  paymentFeeMinor: number;
  adAllocationMinor: number;
  returnReserveMinor: number;
  currency: string;
  inventoryQuantity: number;
  rating: number;
  reviewCount: number;
  dataConfidence: number;
  dataFreshnessAt: string;
  opportunityScore?: number;
  expectedMarginBps?: number;
  policyRiskScore?: number;
  currentSignal?: string;
  supplierName?: string;
};

export type OperatorObjectiveFilters = {
  minMarginBps?: number;
  maxDeliveryDays?: number;
  minReviews?: number;
  maxPolicyRisk?: number;
  minDataConfidence?: number;
  minOpportunityScore?: number;
  minSupplierReliability?: number;
  /** Max supplier cost in minor units (e.g. $20 → 2000) */
  maxSupplierCostMinor?: number;
  /** Target sell market (e.g. CA, US) — used as assumption when channel not wired */
  targetMarket?: string;
  topN?: number;
};

export type ObjectiveClassification = {
  objectiveType: ObjectiveType;
  riskClass: 'read_only' | 'draft' | 'financial_contractual';
  /** Whether the objective itself requires approval (consequential) */
  approvalRequired: boolean;
  wantsDraft: boolean;
  wantsPublish: boolean;
  filters: OperatorObjectiveFilters;
};

function nowIso(): string {
  return new Date().toISOString();
}

function pushTimeline(
  timeline: TimelineStep[],
  step: string,
  status: TimelineStep['status'] = 'done',
  detail?: string,
): void {
  timeline.push({ at: nowIso(), step, status, detail });
}

/**
 * Classify objective intent. Research / evaluate = READ_ONLY_ANALYSIS (no approval).
 * Publish / purchase / ad spend = consequential.
 */
export function classifyObjective(objective: string): ObjectiveClassification {
  const text = objective.toLowerCase().trim();

  const wantsPublish =
    /\b(publish|go live|live list|submit to marketplace|post listing)\b/.test(text);
  const wantsPo =
    /\b(purchase order|buy stock|order from supplier|submit po|procure)\b/.test(text);
  const wantsDraft =
    /\b(draft listing|prepare listing|listing draft|create draft)\b/.test(text) &&
    !wantsPublish;
  const isResearch =
    /\b(find|search|evaluat|recommend|scan|opportunit|worth evaluating|analyze|analyse|score|rank)\b/.test(
      text,
    ) ||
    text.includes('worth evaluating') ||
    (!wantsPublish && !wantsPo && !wantsDraft);

  // Explicit consequential verbs win
  if (wantsPublish || wantsPo) {
    return {
      objectiveType: wantsPublish ? 'PUBLISH_LISTING' : 'SUPPLIER_PO',
      riskClass: 'financial_contractual',
      approvalRequired: true,
      wantsDraft: true,
      wantsPublish,
      filters: parseObjectiveFilters(text, { researchDefaults: false }),
    };
  }

  if (wantsDraft && !isResearch) {
    return {
      objectiveType: 'DRAFT_LISTING',
      riskClass: 'draft',
      approvalRequired: false, // draft only — publish still gated later
      wantsDraft: true,
      wantsPublish: false,
      filters: parseObjectiveFilters(text, { researchDefaults: true }),
    };
  }

  // Default product-evaluation / research path
  return {
    objectiveType: 'READ_ONLY_ANALYSIS',
    riskClass: 'read_only',
    approvalRequired: false,
    wantsDraft: wantsDraft, // may still offer draft as next action
    wantsPublish: false,
    filters: parseObjectiveFilters(text, { researchDefaults: true }),
  };
}

/**
 * Parse natural-language filters. Research objectives get founder defaults (§13).
 */
export function parseObjectiveFilters(
  text: string,
  opts?: { researchDefaults?: boolean },
): OperatorObjectiveFilters {
  const filters: OperatorObjectiveFilters = opts?.researchDefaults
    ? {
        // Founder default evaluation policy
        minMarginBps: 2000, // 20%
        maxDeliveryDays: 14,
        maxPolicyRisk: 40,
        minDataConfidence: 0.55,
        minOpportunityScore: 50,
        minSupplierReliability: 70,
        topN: 3,
        minReviews: 0,
      }
    : { topN: 3, maxPolicyRisk: 40 };

  const marginMatch = text.match(
    /(?:margin|expected margin)\s*(?:above|over|of at least|at least|>|>=)?\s*(\d+)\s*%/,
  );
  if (marginMatch) filters.minMarginBps = Number(marginMatch[1]) * 100;
  else if (text.includes('25%')) filters.minMarginBps = 2500;
  else if (text.includes('15%')) filters.minMarginBps = 1500;

  // "under $20 supplier cost" / "supplier cost under 20" / "cost below $15"
  const costMatch =
    text.match(
      /(?:supplier\s+)?cost\s*(?:under|below|<|<=|less than)\s*\$?\s*(\d+(?:\.\d+)?)/,
    ) ||
    text.match(
      /under\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:supplier\s+)?cost/,
    ) ||
    text.match(/\$(\d+(?:\.\d+)?)\s*supplier\s+cost/);
  if (costMatch) {
    const dollars = Number(costMatch[1]);
    if (Number.isFinite(dollars)) filters.maxSupplierCostMinor = Math.round(dollars * 100);
  }

  // Target market — Canada / CA / US (assumption until live marketplace geo feed)
  if (/\b(canada|canadian|\bca\b)\b/.test(text)) filters.targetMarket = 'CA';
  else if (/\b(united states|u\.s\.a\.?|\busa\b|\bus\b)\b/.test(text)) filters.targetMarket = 'US';
  else if (/\b(united kingdom|\buk\b|britain)\b/.test(text)) filters.targetMarket = 'UK';

  const deliveryMatch = text.match(/(?:delivery|ship)\s*(?:under|within|<|<=)\s*(\d+)\s*day/);
  if (deliveryMatch) filters.maxDeliveryDays = Number(deliveryMatch[1]);
  else if (text.includes('12 day')) filters.maxDeliveryDays = 12;

  const reviewMatch = text.match(/(\d+)\s*(?:credible\s+)?reviews?/);
  if (reviewMatch) filters.minReviews = Number(reviewMatch[1]);

  if (text.includes('low policy')) filters.maxPolicyRisk = 25;

  const topMatch = text.match(/(?:top|strongest|find)\s*(\d+)/);
  if (topMatch) filters.topN = Number(topMatch[1]);
  // "three products" / "3 products"
  const countWord = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+products?\b/,
  );
  if (countWord) {
    const words: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    const n = words[countWord[1]!] ?? Number(countWord[1]);
    if (Number.isFinite(n) && n > 0) filters.topN = n;
  }

  if (text.includes('working capital')) filters.topN = 5;

  return filters;
}

/** @deprecated use parseObjectiveFilters — kept for tests */
export function parseObjective(objective: string): OperatorObjectiveFilters {
  return classifyObjective(objective).filters;
}

export function buildPlan(
  objective: string,
  classification: ObjectiveClassification,
): OperatorPlan {
  const isReadOnly = classification.objectiveType === 'READ_ONLY_ANALYSIS';
  return {
    interpretation: isReadOnly
      ? `Read-only product evaluation. Filters: ${JSON.stringify(classification.filters)}. No approval required for analysis.`
      : `Objective classified as ${classification.objectiveType}. Filters: ${JSON.stringify(classification.filters)}.`,
    steps: isReadOnly
      ? [
          'Objective received',
          'Validate connected data sources',
          'Search authorized product sources',
          'Normalize candidate products',
          'Calculate landed cost and contribution profit',
          'Check reviews, supplier quality, marketplace opportunity',
          'Check policy risk',
          'Calculate opportunity scores',
          'Rank and return qualifying products',
        ]
      : [
          'Inspect connector capabilities and loop mode',
          'Collect product + opportunity records',
          'Normalize economics and policy risk',
          'Rank candidates',
          'Generate recommendations with evidence',
          'Critic pass',
          'Auditor pass',
          'Queue draft / approval only if consequential',
        ],
    toolsToCall: isReadOnly
      ? [
          'listConnectorCapabilities',
          'searchConnectedProducts',
          'calculateContributionProfit',
          'assessPolicyRisk',
        ]
      : [
          'listConnectorCapabilities',
          'searchConnectedProducts',
          'calculateContributionProfit',
          'assessPolicyRisk',
          ...(classification.wantsDraft ? ['draftListing'] : []),
        ],
    objectiveType: classification.objectiveType,
    riskClass: classification.riskClass,
    approvalRequired: classification.approvalRequired,
    filters: classification.filters as Record<string, unknown>,
  };
}

/**
 * Full operator cycle against in-memory product set (host loads from DB).
 */
export async function runOperatorCycle(input: {
  objective: string;
  products: OperatorProduct[];
  loopMode: OperationLoopMode;
  ctx: ToolExecutionContext;
  connectorSources?: Array<{ name: string; status: string; detail?: string }>;
}): Promise<OperatorCycleResult> {
  const classification = classifyObjective(input.objective);
  const filters = classification.filters;
  const plan = buildPlan(input.objective, classification);
  const toolTrace: ToolTraceEntry[] = [];
  const timeline: TimelineStep[] = [];
  const isReadOnly = classification.objectiveType === 'READ_ONLY_ANALYSIS';

  pushTimeline(timeline, 'Objective received', 'done', input.objective.slice(0, 200));

  // Tool: connector capabilities
  pushTimeline(timeline, 'Validating connected data sources', 'active');
  try {
    const caps = await invokeTool('listConnectorCapabilities', {}, input.ctx);
    toolTrace.push(caps.trace);
    pushTimeline(timeline, 'Connector capabilities checked', 'done');
  } catch (e) {
    toolTrace.push({
      tool: 'listConnectorCapabilities',
      input: {},
      error: e instanceof Error ? e.message : String(e),
      actionClass: 'read_only',
      durationMs: 0,
      at: nowIso(),
    });
    pushTimeline(
      timeline,
      'Connector capabilities checked',
      'failed',
      e instanceof Error ? e.message : String(e),
    );
  }

  // Tool: search products
  pushTimeline(timeline, 'Searching authorized product sources', 'active');
  try {
    const search = await invokeTool(
      'searchConnectedProducts',
      { filters, limit: 50 },
      input.ctx,
    );
    toolTrace.push(search.trace);
    const count =
      typeof search.result === 'object' &&
      search.result &&
      'count' in (search.result as object)
        ? Number((search.result as { count?: number }).count)
        : input.products.length;
    pushTimeline(
      timeline,
      'Product candidates retrieved',
      'done',
      `${count || input.products.length} candidates from connected sources`,
    );
  } catch {
    pushTimeline(
      timeline,
      'Product candidates retrieved',
      'done',
      `Using local product store (${input.products.length} rows)`,
    );
  }

  const retrieved = input.products.length;
  let rejectedMissingCost = 0;
  const normalized = input.products.filter((p) => {
    if (p.supplierCostMinor <= 0 || p.targetPriceMinor <= 0) {
      rejectedMissingCost += 1;
      return false;
    }
    return true;
  });

  pushTimeline(
    timeline,
    'Products normalized',
    'done',
    `${normalized.length} normalized; ${rejectedMissingCost} rejected for missing cost`,
  );

  const scored = normalized.map((p) => scoreCandidate(p, filters));
  const passed = scored.filter((c) => c.pass);
  const failedReasons = scored
    .filter((c) => !c.pass)
    .slice(0, 8)
    .map((c) => `${c.product.title.slice(0, 40)}: ${c.failReasons.join('; ')}`);

  pushTimeline(
    timeline,
    'Costs, risks, and opportunity scores evaluated',
    'done',
    `${passed.length} of ${normalized.length} passed filters`,
  );

  const candidates = passed
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, filters.topN ?? 3);

  pushTimeline(
    timeline,
    'Candidates ranked',
    'done',
    `${candidates.length} products exceeded opportunity threshold`,
  );

  const recommendations: RecommendationDraft[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const p = c.product;

    try {
      const profit = await invokeTool(
        'calculateContributionProfit',
        {
          sellingPriceMinor: p.targetPriceMinor,
          marketplaceFeeMinor: p.marketplaceFeeMinor,
          paymentFeeMinor: p.paymentFeeMinor,
          supplierCostMinor: p.supplierCostMinor,
          shippingCostMinor: p.shippingCostMinor,
          advertisingAllocationMinor: p.adAllocationMinor,
          returnReserveMinor: p.returnReserveMinor,
          currency: p.currency,
        },
        input.ctx,
      );
      toolTrace.push(profit.trace);
    } catch {
      /* local calc below */
    }

    try {
      const policy = await invokeTool(
        'assessPolicyRisk',
        { title: p.title, description: p.description, category: p.category },
        input.ctx,
      );
      toolTrace.push(policy.trace);
    } catch {
      /* local below */
    }

    const unit = calculateUnitEconomics({
      sellingPriceMinor: p.targetPriceMinor,
      marketplaceFeeMinor: p.marketplaceFeeMinor,
      paymentFeeMinor: p.paymentFeeMinor,
      supplierCostMinor: p.supplierCostMinor,
      shippingCostMinor: p.shippingCostMinor,
      advertisingAllocationMinor: p.adAllocationMinor,
      returnReserveMinor: p.returnReserveMinor,
      currency: p.currency,
    });
    const policy = assessProductPolicy({
      title: p.title,
      description: p.description,
      category: p.category,
    });
    const supplierReliability = 70;
    const opp = scoreOpportunity({
      demandPotential: Math.min(100, 40 + p.reviewCount / 10),
      trendMomentum: 55,
      netMarginPotential: Math.min(100, Math.max(0, unit.netMarginBps / 50)),
      supplierQuality: supplierReliability,
      shippingReliability: 65,
      reviewHealth: Math.min(100, p.rating * 20),
      competition: 45,
      returnRisk: Math.min(100, p.returnReserveMinor / 50),
      policyRisk: policy.outcome === 'blocked' ? 90 : policy.outcome === 'manual_review' ? 55 : 15,
      capitalRequirement: Math.min(100, unit.cashRequiredBeforePayoutMinor / 500),
      dataConfidence: Math.round(p.dataConfidence * 100),
      policyBlocked: policy.outcome === 'blocked',
    });

    const isFixture = p.sourcePlatform.startsWith('fixture');
    const landedCostMinor =
      p.supplierCostMinor + p.shippingCostMinor + p.marketplaceFeeMinor + p.paymentFeeMinor;

    // READ_ONLY: never require approval. DRAFT: no approval. PUBLISH: always.
    // Shadow mode records shadow decisions but does NOT force approval for analysis.
    const approvalRequired =
      classification.approvalRequired ||
      classification.objectiveType === 'PUBLISH_LISTING' ||
      classification.objectiveType === 'SUPPLIER_PO';

    const actionClass = isReadOnly
      ? 'read_only'
      : classification.wantsDraft
        ? 'draft'
        : 'read_only';

    const title = isReadOnly
      ? p.title
      : classification.wantsDraft
        ? `Prepare listing draft: ${p.title}`
        : p.title;

    const productCard = {
      productId: p.productId,
      title: p.title,
      sourceConnector: p.sourcePlatform,
      supplier: p.supplierName ?? p.sourcePlatform,
      supplierCostMinor: p.supplierCostMinor,
      shippingCostMinor: p.shippingCostMinor,
      landedCostMinor,
      targetSellingPriceMinor: p.targetPriceMinor,
      marketplaceFeeMinor: p.marketplaceFeeMinor,
      paymentFeeMinor: p.paymentFeeMinor,
      contributionProfitMinor: unit.contributionProfitMinor,
      expectedMarginBps: unit.netMarginBps,
      rating: p.rating,
      reviewCount: p.reviewCount,
      reviewHealth: Math.min(100, Math.round(p.rating * 20)),
      demandScore: Math.min(100, Math.round(40 + p.reviewCount / 10)),
      competitionScore: 45,
      supplierReliability,
      policyRiskScore:
        policy.outcome === 'blocked' ? 95 : policy.outcome === 'manual_review' ? 55 : 15,
      policyOutcome: policy.outcome,
      opportunityScore: opp.score,
      forecastConfidence: p.dataConfidence,
      dataFreshnessAt: p.dataFreshnessAt,
      currency: p.currency,
      isFixture,
      deliveryEstimateDays: filters.maxDeliveryDays ?? 14,
      currentSignal: p.currentSignal ?? null,
    };

    recommendations.push({
      productId: p.productId,
      rank: i + 1,
      actionClass,
      title,
      rationale: isReadOnly
        ? [
            `Opportunity score ${opp.score}/100 with ${(unit.netMarginBps / 100).toFixed(1)}% expected contribution margin.`,
            `Reviews: ${p.reviewCount} at ${p.rating}★; policy ${policy.outcome}.`,
            isFixture
              ? 'Source is fixture-labeled — not live marketplace data.'
              : `Source: ${p.sourcePlatform}.`,
          ].join(' ')
        : `Margin ${(unit.netMarginBps / 100).toFixed(1)}%, reviews ${p.reviewCount}, policy ${policy.outcome}, score ${opp.score}.`,
      evidence: {
        productId: p.productId,
        sourcePlatform: p.sourcePlatform,
        isFixtureSource: isFixture,
        dataFreshnessAt: p.dataFreshnessAt,
        dataConfidence: p.dataConfidence,
        reviewCount: p.reviewCount,
        rating: p.rating,
        opportunityScore: opp.score,
        policyOutcome: policy.outcome,
        why: [
          unit.netMarginBps >= (filters.minMarginBps ?? 0)
            ? 'sufficient margin after estimated fees'
            : 'margin near threshold',
          p.reviewCount > 0 ? 'consistent review volume' : 'limited review volume',
          policy.outcome === 'approved' || policy.outcome === 'approved_with_conditions'
            ? 'low regulatory risk'
            : `policy ${policy.outcome}`,
          'acceptable delivery window under evaluation policy',
        ],
      },
      assumptions: [
        'Marketplace fee estimate holds for target channel',
        'Supplier shipping cost is current',
        filters.targetMarket
          ? `Target sell market ${filters.targetMarket} — geo demand is assumed until marketplace observation feed is connected`
          : 'Target market not specified',
        filters.maxDeliveryDays
          ? `Delivery assumed under ${filters.maxDeliveryDays} days (not verified without logistics feed)`
          : 'Delivery SLA not constrained',
        filters.maxSupplierCostMinor != null
          ? `Supplier cost capped at $${(filters.maxSupplierCostMinor / 100).toFixed(2)}`
          : 'No supplier cost cap',
      ],
      missingData: [
        'verified_advertising_cost',
        'marketplace_specific_conversion_history',
        ...(filters.maxDeliveryDays ? ['verified_delivery_days'] : []),
        ...(isFixture ? ['live_marketplace_credentials'] : []),
        ...(!p.reviewCount ? ['review_volume'] : []),
      ],
      calculation: {
        contributionProfitMinor: unit.contributionProfitMinor,
        netMarginBps: unit.netMarginBps,
        revenueMinor: unit.revenueMinor,
        cashRequiredBeforePayoutMinor: unit.cashRequiredBeforePayoutMinor,
        supplierCostMinor: p.supplierCostMinor,
        shippingCostMinor: p.shippingCostMinor,
        marketplaceFeeMinor: p.marketplaceFeeMinor,
        paymentFeeMinor: p.paymentFeeMinor,
        landedCostMinor,
        targetPriceMinor: p.targetPriceMinor,
        currency: p.currency,
      },
      forecast: {
        modelVersion: 'baseline-ma-v1',
        note: 'Demand forecast uses baseline until sales history accumulates',
        confidence: p.dataConfidence,
      },
      confidence: Math.min(0.95, p.dataConfidence * (policy.outcome === 'blocked' ? 0.2 : 0.9)),
      policyRiskScore:
        policy.outcome === 'blocked' ? 95 : policy.outcome === 'manual_review' ? 55 : 15,
      approvalRequired,
      expectedOutcome: {
        expectedMarginBps: unit.netMarginBps,
        listingStatus: isReadOnly ? 'none' : 'draft_available',
        analysisComplete: isReadOnly,
      },
      proposedAction: isReadOnly
        ? 'evaluateProduct'
        : classification.wantsDraft
          ? 'draftListing'
          : 'evaluateProduct',
      productCard: {
        ...productCard,
        targetMarket: filters.targetMarket ?? null,
        maxSupplierCostMinor: filters.maxSupplierCostMinor ?? null,
        recommendedNextAction: 'Create a listing draft for review (publish still requires approval).',
      },
      nextActions: isReadOnly
        ? [
            'view_product',
            'add_to_watchlist',
            'recalculate_profit',
            'create_listing_draft',
            'reject_recommendation',
          ]
        : classification.wantsDraft
          ? ['create_listing_draft', 'view_product']
          : ['view_product'],
    });

    // Only invoke draftListing tool when objective asks for drafts — never for pure research
    if (classification.wantsDraft && !isReadOnly) {
      try {
        const draft = await invokeTool(
          'draftListing',
          { productId: p.productId, title: p.title },
          input.ctx,
        );
        toolTrace.push(draft.trace);
      } catch {
        /* optional */
      }
    }
  }

  pushTimeline(
    timeline,
    'Recommendations completed',
    'done',
    recommendations.length
      ? `${recommendations.length} product(s) qualified from ${retrieved} candidates`
      : `0 products qualified from ${retrieved} candidates`,
  );

  const critic = runCriticPass(recommendations, toolTrace);
  const auditor = runAuditorPass(recommendations, toolTrace, {
    requiredPermissions: ['products:read', 'ai:write'],
    heldPermissions: input.ctx.permissions,
  });
  const { decision, note } = decideFromPasses(
    critic,
    auditor,
    recommendations,
    classification,
  );

  let finalRecs = recommendations;
  if (decision === 'block' && !isReadOnly) {
    finalRecs = recommendations.filter((r) => r.policyRiskScore < 80);
  }

  const sources =
    input.connectorSources ??
    deriveSourcesFromProducts(input.products);

  const rejectedByFilter = scored.length - passed.length;
  const top = finalRecs[0];
  const topCard = top?.productCard as
    | {
        title?: string;
        opportunityScore?: number;
        contributionProfitMinor?: number;
        expectedMarginBps?: number;
        currency?: string;
        deliveryEstimateDays?: number;
        policyOutcome?: string;
      }
    | undefined;

  let responseSummary: string;
  if (retrieved === 0) {
    responseSummary = [
      'I could not search live products because no authorized product-source data is currently available in the organization store.',
      '',
      'Available next steps:',
      '1. Connect a supplier source.',
      '2. Import an authorized supplier feed.',
      '3. Configure a marketplace observation connector.',
    ].join('\n');
  } else if (finalRecs.length === 0) {
    responseSummary = [
      `I evaluated ${retrieved} product candidate(s) from connected sources.`,
      `${rejectedMissingCost} rejected for missing cost data.`,
      `${rejectedByFilter} failed evaluation thresholds (${JSON.stringify(filters)}).`,
      failedReasons.length ? `Examples: ${failedReasons.slice(0, 4).join(' | ')}` : '',
      '',
      'No products currently qualify. Adjust margin, cost, or policy filters and rerun.',
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    const cur = topCard?.currency ?? 'USD';
    const profit =
      topCard?.contributionProfitMinor != null
        ? `${cur} $${(Number(topCard.contributionProfitMinor) / 100).toFixed(2)}`
        : 'n/a';
    const margin =
      topCard?.expectedMarginBps != null
        ? `${(Number(topCard.expectedMarginBps) / 100).toFixed(1)}%`
        : 'n/a';
    responseSummary = [
      `I evaluated ${retrieved} supplier products from connected sources.`,
      `${rejectedMissingCost} rejected for missing cost data.`,
      `${rejectedByFilter} rejected by filters (margin / policy / confidence / cost).`,
      `${finalRecs.length} product(s) qualified.`,
      '',
      top
        ? [
            `Strongest opportunity: ${top.title}`,
            `Opportunity score: ${topCard?.opportunityScore ?? '—'}/100`,
            `Confidence: ${(top.confidence * 100).toFixed(0)}%`,
            `Estimated contribution profit: ${profit}`,
            `Expected margin: ${margin}`,
            `Delivery estimate: up to ${topCard?.deliveryEstimateDays ?? filters.maxDeliveryDays ?? '—'} days`,
            `Policy risk: ${topCard?.policyOutcome ?? top.policyRiskScore}`,
            '',
            isReadOnly
              ? 'Recommended next action: Compare suppliers and prepare a listing draft (publish still requires approval).'
              : note,
          ].join('\n')
        : note,
      filters.targetMarket
        ? `\nTarget market assumption: ${filters.targetMarket} (geo demand not verified without marketplace observation feed).`
        : '',
      isReadOnly ? '\nRead-only analysis — no approval required for research.' : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return {
    plan,
    toolTrace,
    recommendations: finalRecs,
    critic,
    auditor,
    decision: isReadOnly && finalRecs.length > 0 ? 'accept' : decision,
    decisionNote: isReadOnly && finalRecs.length > 0 ? responseSummary : note,
    loopMode: input.loopMode,
    objectiveType: classification.objectiveType,
    riskClass: classification.riskClass,
    approvalRequired: classification.approvalRequired,
    timeline,
    sources,
    responseSummary,
    candidateStats: {
      retrieved,
      normalized: normalized.length,
      rejectedMissingCost,
      passedPolicy: passed.length,
      ranked: finalRecs.length,
    },
    filtersApplied: filters as Record<string, unknown>,
  };
}

function deriveSourcesFromProducts(
  products: OperatorProduct[],
): Array<{ name: string; status: string; detail?: string }> {
  const platforms = new Set(products.map((p) => p.sourcePlatform));
  const sources: Array<{ name: string; status: string; detail?: string }> = [];
  if (platforms.size === 0) {
    sources.push({
      name: 'Product store',
      status: 'empty',
      detail: 'No products in organization store',
    });
  } else {
    for (const p of platforms) {
      sources.push({
        name: p.startsWith('fixture') ? `Supplier feed (${p})` : p,
        status: p.startsWith('fixture') ? 'fixture_connected' : 'connected',
        detail: p.startsWith('fixture') ? 'Fixture-labeled — not live API' : undefined,
      });
    }
  }
  sources.push({
    name: 'Review source',
    status: products.some((p) => p.reviewCount > 0) ? 'available' : 'limited',
  });
  sources.push({ name: 'Trend feed', status: 'limited', detail: 'Baseline model only' });
  return sources;
}

function scoreCandidate(
  product: OperatorProduct,
  filters: OperatorObjectiveFilters,
): {
  product: OperatorProduct;
  pass: boolean;
  rankScore: number;
  failReasons: string[];
} {
  const unit = calculateUnitEconomics({
    sellingPriceMinor: product.targetPriceMinor,
    marketplaceFeeMinor: product.marketplaceFeeMinor,
    paymentFeeMinor: product.paymentFeeMinor,
    supplierCostMinor: product.supplierCostMinor,
    shippingCostMinor: product.shippingCostMinor,
    advertisingAllocationMinor: product.adAllocationMinor,
    returnReserveMinor: product.returnReserveMinor,
    currency: product.currency,
  });
  const policy = assessProductPolicy({
    title: product.title,
    description: product.description,
    category: product.category,
  });
  const policyScore =
    product.policyRiskScore ??
    (policy.outcome === 'blocked' ? 95 : policy.outcome === 'manual_review' ? 55 : 15);
  const margin = product.expectedMarginBps ?? unit.netMarginBps;
  const oppScore =
    product.opportunityScore ??
    Math.min(
      100,
      Math.round(margin / 50 + product.reviewCount / 20 + product.rating * 8 + 30),
    );

  const failReasons: string[] = [];
  if (filters.minMarginBps != null && margin < filters.minMarginBps) {
    failReasons.push(
      `margin ${(margin / 100).toFixed(1)}% < min ${(filters.minMarginBps / 100).toFixed(0)}%`,
    );
  }
  if (filters.minReviews != null && product.reviewCount < filters.minReviews) {
    failReasons.push(`reviews ${product.reviewCount} < min ${filters.minReviews}`);
  }
  if (filters.maxPolicyRisk != null && policyScore > filters.maxPolicyRisk) {
    failReasons.push(`policy risk ${policyScore} > max ${filters.maxPolicyRisk}`);
  }
  if (policy.outcome === 'blocked') {
    failReasons.push('policy blocked');
  }
  if (
    filters.minDataConfidence != null &&
    product.dataConfidence < filters.minDataConfidence
  ) {
    failReasons.push(
      `confidence ${(product.dataConfidence * 100).toFixed(0)}% < min ${(filters.minDataConfidence * 100).toFixed(0)}%`,
    );
  }
  if (filters.minOpportunityScore != null && oppScore < filters.minOpportunityScore) {
    failReasons.push(`opportunity ${oppScore} < min ${filters.minOpportunityScore}`);
  }
  if (
    filters.maxSupplierCostMinor != null &&
    product.supplierCostMinor > filters.maxSupplierCostMinor
  ) {
    failReasons.push(
      `supplier cost ${(product.supplierCostMinor / 100).toFixed(2)} > max $${(filters.maxSupplierCostMinor / 100).toFixed(2)}`,
    );
  }

  const pass = failReasons.length === 0;
  const rankScore =
    margin / 100 +
    product.reviewCount / 10 +
    product.rating * 5 +
    oppScore -
    policyScore;

  return { product, pass, rankScore, failReasons };
}

export function registeredToolCount(): number {
  return listTools().length;
}
