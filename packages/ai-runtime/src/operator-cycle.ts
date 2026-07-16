import {
  assessProductPolicy,
  calculateUnitEconomics,
  scoreOpportunity,
} from '@tradeops/commerce-engine';
import { decideFromPasses, runAuditorPass, runCriticPass } from './critic-auditor';
import { invokeTool, listTools } from './tool-registry';
import type {
  OperationLoopMode,
  OperatorCycleResult,
  OperatorPlan,
  RecommendationDraft,
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
};

export type OperatorObjectiveFilters = {
  minMarginBps?: number;
  maxDeliveryDays?: number;
  minReviews?: number;
  maxPolicyRisk?: number;
  topN?: number;
};

/**
 * Interpret natural language-ish objectives into structured filters.
 * Deterministic heuristics — LLM optional later via SpaceXAI when key present.
 */
export function parseObjective(objective: string): OperatorObjectiveFilters {
  const text = objective.toLowerCase();
  const filters: OperatorObjectiveFilters = { topN: 3, maxPolicyRisk: 40 };

  const marginMatch = text.match(/margin\s*(?:above|over|>|>=)\s*(\d+)\s*%/);
  if (marginMatch) filters.minMarginBps = Number(marginMatch[1]) * 100;
  else if (text.includes('25%')) filters.minMarginBps = 2500;
  else if (text.includes('15%')) filters.minMarginBps = 1500;

  const deliveryMatch = text.match(/(?:delivery|ship)\s*(?:under|within|<|<=)\s*(\d+)\s*day/);
  if (deliveryMatch) filters.maxDeliveryDays = Number(deliveryMatch[1]);
  else if (text.includes('12 day')) filters.maxDeliveryDays = 12;

  const reviewMatch = text.match(/(\d+)\s*(?:credible\s+)?reviews?/);
  if (reviewMatch) filters.minReviews = Number(reviewMatch[1]);

  if (text.includes('low policy')) filters.maxPolicyRisk = 25;
  if (text.includes('working capital')) filters.topN = 5;

  const topMatch = text.match(/(?:top|strongest)\s*(\d+)/);
  if (topMatch) filters.topN = Number(topMatch[1]);

  return filters;
}

export function buildPlan(objective: string, filters: OperatorObjectiveFilters): OperatorPlan {
  return {
    interpretation: `Objective understood with filters: ${JSON.stringify(filters)}`,
    steps: [
      'Inspect connector capabilities and loop mode',
      'Collect product + opportunity records',
      'Normalize economics and policy risk',
      'Rank candidates by margin, reviews, policy',
      'Generate recommendations with evidence',
      'Critic pass',
      'Auditor pass',
      'Decide accept / downgrade / block / escalate',
      'Queue draft listing / approval steps as permitted',
      'Record shadow decisions when not live-executing',
    ],
    toolsToCall: [
      'listConnectorCapabilities',
      'searchConnectedProducts',
      'calculateContributionProfit',
      'assessPolicyRisk',
      'draftListing',
    ],
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
}): Promise<OperatorCycleResult> {
  const filters = parseObjective(input.objective);
  const plan = buildPlan(input.objective, filters);
  const toolTrace: ToolTraceEntry[] = [];

  // Tool: connector capabilities
  try {
    const caps = await invokeTool('listConnectorCapabilities', {}, input.ctx);
    toolTrace.push(caps.trace);
  } catch (e) {
    toolTrace.push({
      tool: 'listConnectorCapabilities',
      input: {},
      error: e instanceof Error ? e.message : String(e),
      actionClass: 'read_only',
      durationMs: 0,
      at: new Date().toISOString(),
    });
  }

  // Tool: search products (host tool filters via deps if registered)
  try {
    const search = await invokeTool(
      'searchConnectedProducts',
      { filters, limit: 50 },
      input.ctx,
    );
    toolTrace.push(search.trace);
  } catch {
    /* optional if not registered — fall through to local products */
  }

  const recommendations: RecommendationDraft[] = [];
  const candidates = input.products
    .map((p) => scoreCandidate(p, filters))
    .filter((c) => c.pass)
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, filters.topN ?? 3);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const p = c.product;

    let profitTrace: ToolTraceEntry | undefined;
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
      profitTrace = profit.trace;
      toolTrace.push(profit.trace);
    } catch {
      /* local calc below */
    }

    let policyTrace: ToolTraceEntry | undefined;
    try {
      const policy = await invokeTool(
        'assessPolicyRisk',
        { title: p.title, description: p.description, category: p.category },
        input.ctx,
      );
      policyTrace = policy.trace;
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
    const opp = scoreOpportunity({
      demandPotential: Math.min(100, 40 + p.reviewCount / 10),
      trendMomentum: 55,
      netMarginPotential: Math.min(100, Math.max(0, unit.netMarginBps / 50)),
      supplierQuality: 70,
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
    const approvalRequired =
      input.loopMode === 'shadow' ||
      input.loopMode === 'controlled_live' ||
      unit.netMarginBps < 3000 ||
      policy.outcome !== 'approved';

    recommendations.push({
      productId: p.productId,
      rank: i + 1,
      actionClass: 'draft',
      title: `Prepare listing draft: ${p.title}`,
      rationale: `Margin ${(unit.netMarginBps / 100).toFixed(1)}%, reviews ${p.reviewCount}, policy ${policy.outcome}, score ${opp.score}.`,
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
        toolRefs: [profitTrace?.tool, policyTrace?.tool].filter(Boolean),
      },
      assumptions: [
        'Marketplace fee estimate holds for target channel',
        'Supplier shipping cost is current',
        filters.maxDeliveryDays
          ? `Delivery assumed under ${filters.maxDeliveryDays} days (not verified without logistics feed)`
          : 'Delivery SLA not constrained',
      ],
      missingData: [
        ...(filters.maxDeliveryDays ? ['verified_delivery_days'] : []),
        ...(isFixture ? ['live_marketplace_credentials'] : []),
        ...(!p.reviewCount ? ['review_volume'] : []),
      ],
      calculation: {
        contributionProfitMinor: unit.contributionProfitMinor,
        netMarginBps: unit.netMarginBps,
        revenueMinor: unit.revenueMinor,
        cashRequiredBeforePayoutMinor: unit.cashRequiredBeforePayoutMinor,
      },
      forecast: {
        modelVersion: 'baseline-ma-v1',
        note: 'Demand forecast uses baseline until sales history accumulates',
      },
      confidence: Math.min(0.95, p.dataConfidence * (policy.outcome === 'blocked' ? 0.2 : 0.9)),
      policyRiskScore: policy.outcome === 'blocked' ? 95 : policy.outcome === 'manual_review' ? 55 : 15,
      approvalRequired,
      expectedOutcome: {
        expectedMarginBps: unit.netMarginBps,
        listingStatus: 'pending_approval',
      },
      proposedAction: 'draftListing',
    });

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

  const critic = runCriticPass(recommendations, toolTrace);
  const auditor = runAuditorPass(recommendations, toolTrace, {
    requiredPermissions: ['products:read', 'ai:write'],
    heldPermissions: input.ctx.permissions,
  });
  const { decision, note } = decideFromPasses(critic, auditor, recommendations);

  // Apply decision: block strips recommendations on high severity
  let finalRecs = recommendations;
  if (decision === 'block') {
    finalRecs = recommendations.filter((r) => r.policyRiskScore < 80);
  }

  return {
    plan,
    toolTrace,
    recommendations: finalRecs,
    critic,
    auditor,
    decision,
    decisionNote: note,
    loopMode: input.loopMode,
  };
}

function scoreCandidate(
  product: OperatorProduct,
  filters: OperatorObjectiveFilters,
): { product: OperatorProduct; pass: boolean; rankScore: number } {
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

  let pass = true;
  if (filters.minMarginBps != null && margin < filters.minMarginBps) pass = false;
  if (filters.minReviews != null && product.reviewCount < filters.minReviews) pass = false;
  if (filters.maxPolicyRisk != null && policyScore > filters.maxPolicyRisk) pass = false;
  if (policy.outcome === 'blocked') pass = false;

  const rankScore =
    margin / 100 +
    product.reviewCount / 10 +
    product.rating * 5 +
    (product.opportunityScore ?? 50) -
    policyScore;

  return { product, pass, rankScore };
}

export function registeredToolCount(): number {
  return listTools().length;
}
