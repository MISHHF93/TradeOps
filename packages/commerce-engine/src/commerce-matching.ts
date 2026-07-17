/**
 * Commerce Matching Engine — impedance-matching inspiration for merchant ↔ market.
 *
 * Continuously reconcile merchant objectives with market conditions.
 * Output is alignment score + gap list + suggested transformation sequence.
 * No RF math.
 */

export type MerchantObjectives = {
  budgetMinor?: number | null;
  market?: string | null;
  country?: string | null;
  riskTolerance?: 'low' | 'medium' | 'high' | null;
  targetMarginBps?: number | null;
  minimumRoiBps?: number | null;
  shippingConstraints?: string | null;
  preferredSuppliers?: string[];
  inventoryLimits?: number | null;
  brandStrategy?: string | null;
  complianceRequirements?: string[];
};

export type MarketConditions = {
  supplierAvailable?: boolean;
  supplierCostMinor?: number | null;
  shippingCostMinor?: number | null;
  targetPriceMinor?: number | null;
  competitionScore?: number | null;
  demandScore?: number | null;
  seasonalityFactor?: number | null;
  marketplacePolicyOk?: boolean;
  inventoryQuantity?: number | null;
  advertisingCostMinor?: number | null;
  expectedMarginBps?: number | null;
  expectedProfitMinor?: number | null;
  policyOutcome?: string | null;
};

export type AlignmentGap = {
  key: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestedTransformation: string;
};

export type MatchingReport = {
  /** 0–100 alignment of merchant objectives with market conditions */
  alignmentScore: number;
  gaps: AlignmentGap[];
  contributionProfitMinor: number | null;
  marginBps: number | null;
  executable: boolean;
  sequence: string[];
  note: string;
};

/**
 * Match merchant intent to market reality for one Commerce Case / opportunity.
 */
export function matchMerchantToMarket(
  objectives: MerchantObjectives,
  market: MarketConditions,
): MatchingReport {
  const gaps: AlignmentGap[] = [];
  let score = 100;

  const cost = market.supplierCostMinor ?? null;
  const ship = market.shippingCostMinor ?? 0;
  const price = market.targetPriceMinor ?? null;
  const ads = market.advertisingCostMinor ?? 0;

  let contribution: number | null = null;
  let marginBps: number | null = market.expectedMarginBps ?? null;

  if (cost != null && price != null && price > 0) {
    contribution = price - cost - ship - ads;
    marginBps = Math.round((contribution / price) * 10_000);
  }

  if (market.supplierAvailable === false) {
    score -= 30;
    gaps.push({
      key: 'supplier',
      severity: 'critical',
      message: 'No available supplier for this product',
      suggestedTransformation: 'compare_suppliers',
    });
  }

  if (objectives.budgetMinor != null && cost != null && cost + ship > objectives.budgetMinor) {
    score -= 25;
    gaps.push({
      key: 'budget',
      severity: 'high',
      message: `Landed cost ${cost + ship} exceeds budget ${objectives.budgetMinor}`,
      suggestedTransformation: 'compare_suppliers',
    });
  }

  if (
    objectives.targetMarginBps != null &&
    marginBps != null &&
    marginBps < objectives.targetMarginBps
  ) {
    score -= 20;
    gaps.push({
      key: 'margin',
      severity: 'high',
      message: `Margin ${marginBps} bps below target ${objectives.targetMarginBps}`,
      suggestedTransformation: 'calculate_landed_cost',
    });
  }

  if (
    objectives.minimumRoiBps != null &&
    marginBps != null &&
    marginBps < objectives.minimumRoiBps
  ) {
    score -= 15;
    gaps.push({
      key: 'roi',
      severity: 'medium',
      message: `ROI/margin ${marginBps} bps below minimum ${objectives.minimumRoiBps}`,
      suggestedTransformation: 'score_opportunity',
    });
  }

  if (market.marketplacePolicyOk === false || market.policyOutcome === 'blocked') {
    score -= 40;
    gaps.push({
      key: 'compliance',
      severity: 'critical',
      message: 'Marketplace/policy does not allow this product',
      suggestedTransformation: 'evaluate_risk',
    });
  }

  if (objectives.riskTolerance === 'low' && (market.competitionScore ?? 50) > 70) {
    score -= 10;
    gaps.push({
      key: 'competition',
      severity: 'medium',
      message: 'High competition conflicts with low risk tolerance',
      suggestedTransformation: 'estimate_demand',
    });
  }

  if (
    objectives.inventoryLimits != null &&
    market.inventoryQuantity != null &&
    market.inventoryQuantity > objectives.inventoryLimits
  ) {
    score -= 8;
    gaps.push({
      key: 'inventory_limit',
      severity: 'low',
      message: 'Available inventory exceeds preferred limit',
      suggestedTransformation: 'review_inventory',
    });
  }

  if ((market.demandScore ?? 50) < 30) {
    score -= 12;
    gaps.push({
      key: 'demand',
      severity: 'medium',
      message: 'Weak demand signal',
      suggestedTransformation: 'estimate_demand',
    });
  }

  score = Math.max(0, Math.min(100, score));
  const executable =
    score >= 55 &&
    market.supplierAvailable !== false &&
    market.policyOutcome !== 'blocked' &&
    (contribution == null || contribution > 0);

  const sequence = buildSequence(gaps, executable);

  return {
    alignmentScore: score,
    gaps,
    contributionProfitMinor: contribution,
    marginBps,
    executable,
    sequence,
    note: executable
      ? 'Merchant objectives and market conditions are sufficiently aligned for next-stage execution.'
      : `Alignment ${score}/100 — close gaps before committing capital or publishing.`,
  };
}

function buildSequence(gaps: AlignmentGap[], executable: boolean): string[] {
  const order = ['critical', 'high', 'medium', 'low'] as const;
  const seen = new Set<string>();
  const seq: string[] = [];
  for (const sev of order) {
    for (const g of gaps.filter((x) => x.severity === sev)) {
      if (!seen.has(g.suggestedTransformation)) {
        seen.add(g.suggestedTransformation);
        seq.push(g.suggestedTransformation);
      }
    }
  }
  if (executable) {
    seq.push('prepare_listing', 'request_approval', 'publish');
  } else if (seq.length === 0) {
    seq.push('validate_opportunity', 'score_opportunity');
  }
  return seq;
}

export const DEFAULT_MERCHANT_OBJECTIVES: MerchantObjectives = {
  riskTolerance: 'medium',
  targetMarginBps: 2500,
  minimumRoiBps: 1500,
};
