export type ScoreComponent = {
  key: string;
  label: string;
  raw: number;
  weight: number;
  weighted: number;
  notes?: string;
};

export type OpportunityScoreInput = {
  demandPotential: number;
  trendMomentum: number;
  netMarginPotential: number;
  supplierQuality: number;
  shippingReliability: number;
  reviewHealth: number;
  competition: number;
  returnRisk: number;
  policyRisk: number;
  capitalRequirement: number;
  dataConfidence: number;
  /** When true, policy is blocked — score may still compute but signal must BLOCKED */
  policyBlocked?: boolean;
  weights?: Partial<Record<keyof Omit<OpportunityScoreInput, 'weights' | 'policyBlocked'>, number>>;
};

export type OpportunityScoreResult = {
  score: number;
  components: ScoreComponent[];
  confidencePenalty: number;
  formulaVersion: string;
  explanation: string;
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  demandPotential: 0.16,
  trendMomentum: 0.1,
  netMarginPotential: 0.18,
  supplierQuality: 0.1,
  shippingReliability: 0.08,
  reviewHealth: 0.08,
  competition: 0.08,
  returnRisk: 0.08,
  policyRisk: 0.08,
  capitalRequirement: 0.03,
  dataConfidence: 0.03,
};

function clamp01to100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Explainable 0–100 opportunity score.
 * Higher competition/return/policy/capital reduce score (inverted).
 */
export function scoreOpportunity(input: OpportunityScoreInput): OpportunityScoreResult {
  const weights: Record<string, number> = { ...DEFAULT_WEIGHTS, ...(input.weights as Record<string, number> | undefined) };

  const inverted = (v: number) => 100 - clamp01to100(v);

  const raw: Record<string, number> = {
    demandPotential: clamp01to100(input.demandPotential),
    trendMomentum: clamp01to100(input.trendMomentum),
    netMarginPotential: clamp01to100(input.netMarginPotential),
    supplierQuality: clamp01to100(input.supplierQuality),
    shippingReliability: clamp01to100(input.shippingReliability),
    reviewHealth: clamp01to100(input.reviewHealth),
    competition: inverted(input.competition),
    returnRisk: inverted(input.returnRisk),
    policyRisk: inverted(input.policyRisk),
    capitalRequirement: inverted(input.capitalRequirement),
    dataConfidence: clamp01to100(input.dataConfidence),
  };

  const labels: Record<string, string> = {
    demandPotential: 'Demand potential',
    trendMomentum: 'Trend momentum',
    netMarginPotential: 'Net margin potential',
    supplierQuality: 'Supplier quality',
    shippingReliability: 'Shipping reliability',
    reviewHealth: 'Review health',
    competition: 'Competition (inverted)',
    returnRisk: 'Return risk (inverted)',
    policyRisk: 'Policy risk (inverted)',
    capitalRequirement: 'Capital requirement (inverted)',
    dataConfidence: 'Data confidence',
  };

  const components: ScoreComponent[] = Object.keys(raw).map((key) => {
    const weight = weights[key] ?? 0;
    const value = raw[key] ?? 0;
    return {
      key,
      label: labels[key] ?? key,
      raw: value,
      weight,
      weighted: value * weight,
    };
  });

  const weightSum = components.reduce((s, c) => s + c.weight, 0) || 1;
  let score = components.reduce((s, c) => s + c.weighted, 0) / weightSum;

  const confidencePenalty = Math.max(0, 100 - clamp01to100(input.dataConfidence)) * 0.25;
  score = Math.max(0, score - confidencePenalty);

  if (input.policyBlocked) {
    score = Math.min(score, 15);
  }

  score = Math.round(clamp01to100(score));

  const top = [...components].sort((a, b) => b.weighted - a.weighted).slice(0, 3);
  const explanation = `Score ${score}/100 (baseline-ma-v1). Top drivers: ${top
    .map((c) => `${c.label}=${Math.round(c.raw)}`)
    .join(', ')}. Confidence penalty ${confidencePenalty.toFixed(1)}.`;

  return {
    score,
    components,
    confidencePenalty,
    formulaVersion: 'opportunity-weighted-v1',
    explanation,
  };
}
