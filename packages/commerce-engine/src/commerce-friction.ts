/**
 * Commerce Friction Model — impedance-matching inspiration, NOT RF equations.
 *
 * Friction is the operational resistance preventing a Commerce Case from reaching
 * its target executable state. The AI's job is to reduce total friction via
 * valid transformations (complete data, clear uncertainty, unlock approvals, …).
 */

export type FrictionDimension =
  | 'incomplete_product_data'
  | 'supplier_uncertainty'
  | 'shipping_complexity'
  | 'pricing_uncertainty'
  | 'regulatory_uncertainty'
  | 'inventory_inconsistency'
  | 'connector_failures'
  | 'missing_approvals'
  | 'workflow_interruptions'
  | 'poor_ai_confidence';

export type FrictionComponent = {
  dimension: FrictionDimension;
  /** 0 = matched / no resistance; 100 = maximum operational impedance */
  score: number;
  weight: number;
  weighted: number;
  evidence: string[];
  reducibleBy: string[];
};

export type FrictionReport = {
  /** Aggregate 0–100; lower is better (toward "matched" executable state) */
  totalFriction: number;
  components: FrictionComponent[];
  topDrivers: FrictionDimension[];
  matched: boolean;
  matchNote: string;
};

export type FrictionInputs = {
  /** 0–1 product data completeness (title+desc+media+attributes) */
  dataCompleteness: number;
  mediaCount?: number;
  hasPrimaryImage?: boolean;
  hasBrand?: boolean;
  hasAttributes?: boolean;
  /** 0–1 supplier reliability / score */
  supplierConfidence?: number | null;
  hasSupplierOffer?: boolean;
  shippingCostKnown?: boolean;
  shippingCostMinor?: number | null;
  supplierCostMinor?: number | null;
  targetPriceMinor?: number | null;
  pricingConfidence?: number | null;
  policyOutcome?: string | null;
  policyRiskScore?: number | null;
  inventoryQuantity?: number | null;
  inventoryKnown?: boolean;
  connectorHealthy?: boolean;
  connectorFailures?: number;
  hasPendingApproval?: boolean;
  stageStatus?: string | null;
  blockerCode?: string | null;
  dataConfidence?: number | null;
  opportunityScore?: number | null;
};

const WEIGHTS: Record<FrictionDimension, number> = {
  incomplete_product_data: 1.2,
  supplier_uncertainty: 1.1,
  shipping_complexity: 0.9,
  pricing_uncertainty: 1.0,
  regulatory_uncertainty: 1.3,
  inventory_inconsistency: 0.8,
  connector_failures: 1.4,
  missing_approvals: 1.0,
  workflow_interruptions: 1.1,
  poor_ai_confidence: 0.9,
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Compute business friction from measurable operational variables.
 * No RF math — scores are business-domain only.
 */
export function computeCommerceFriction(input: FrictionInputs): FrictionReport {
  const components: FrictionComponent[] = [];

  const completeness = clamp((1 - (input.dataCompleteness ?? 0)) * 100);
  const mediaPenalty =
    !input.hasPrimaryImage ? 25 : (input.mediaCount ?? 0) < 2 ? 10 : 0;
  const attrPenalty = input.hasAttributes === false ? 15 : 0;
  const brandPenalty = input.hasBrand === false ? 10 : 0;
  components.push(
    comp(
      'incomplete_product_data',
      clamp(completeness * 0.6 + mediaPenalty + attrPenalty + brandPenalty),
      [
        `dataCompleteness=${(input.dataCompleteness ?? 0).toFixed(2)}`,
        input.hasPrimaryImage ? 'primary image present' : 'missing primary image',
        `mediaCount=${input.mediaCount ?? 0}`,
      ],
      ['improve_product_content', 'bootstrap_media', 'enrich_attributes'],
    ),
  );

  const sup =
    input.hasSupplierOffer === false
      ? 80
      : input.supplierConfidence == null
        ? 55
        : clamp((1 - input.supplierConfidence) * 100);
  components.push(
    comp(
      'supplier_uncertainty',
      sup,
      [
        input.hasSupplierOffer ? 'supplier offer present' : 'no supplier offer',
        `supplierConfidence=${input.supplierConfidence ?? 'unknown'}`,
      ],
      ['compare_suppliers', 'refresh_inventory', 'select_supplier'],
    ),
  );

  const ship =
    input.shippingCostKnown === false
      ? 70
      : input.shippingCostMinor != null && input.supplierCostMinor != null
        ? clamp(
            (input.shippingCostMinor / Math.max(1, input.supplierCostMinor)) * 40,
          )
        : 45;
  components.push(
    comp(
      'shipping_complexity',
      ship,
      [
        input.shippingCostKnown === false
          ? 'shipping cost unknown'
          : `shippingCostMinor=${input.shippingCostMinor ?? 0}`,
      ],
      ['quote_shipping', 'estimate_landed_cost'],
    ),
  );

  const priceKnown =
    input.supplierCostMinor != null &&
    input.targetPriceMinor != null &&
    input.targetPriceMinor > 0;
  const priceFriction = !priceKnown
    ? 75
    : input.pricingConfidence != null
      ? clamp((1 - input.pricingConfidence) * 100)
      : 35;
  components.push(
    comp(
      'pricing_uncertainty',
      priceFriction,
      [
        priceKnown ? 'cost+target present' : 'pricing incomplete',
        `pricingConfidence=${input.pricingConfidence ?? 'n/a'}`,
      ],
      ['calculate_landed_cost', 'score_opportunity', 'set_target_price'],
    ),
  );

  let reg = 20;
  if (input.policyOutcome === 'blocked') reg = 100;
  else if (input.policyOutcome === 'manual_review') reg = 70;
  else if (input.policyOutcome === 'approved_with_conditions') reg = 40;
  else if (input.policyOutcome === 'approved') reg = 5;
  if (input.policyRiskScore != null) {
    reg = clamp(Math.max(reg, input.policyRiskScore));
  }
  components.push(
    comp(
      'regulatory_uncertainty',
      reg,
      [`policyOutcome=${input.policyOutcome ?? 'unknown'}`],
      ['assess_policy_risk', 'resolve_policy_block'],
    ),
  );

  const inv =
    input.inventoryKnown === false
      ? 60
      : input.inventoryQuantity != null && input.inventoryQuantity <= 0
        ? 85
        : input.inventoryQuantity != null && input.inventoryQuantity < 10
          ? 40
          : 10;
  components.push(
    comp(
      'inventory_inconsistency',
      inv,
      [`inventoryQuantity=${input.inventoryQuantity ?? 'unknown'}`],
      ['refresh_inventory', 'read_atp'],
    ),
  );

  const conn =
    input.connectorFailures && input.connectorFailures > 0
      ? clamp(50 + input.connectorFailures * 15)
      : input.connectorHealthy === false
        ? 75
        : 8;
  components.push(
    comp(
      'connector_failures',
      conn,
      [
        `connectorHealthy=${input.connectorHealthy ?? true}`,
        `failures=${input.connectorFailures ?? 0}`,
      ],
      ['inspect_connectors', 'repair_connector'],
    ),
  );

  components.push(
    comp(
      'missing_approvals',
      input.hasPendingApproval ? 65 : 5,
      [input.hasPendingApproval ? 'approval pending' : 'no pending approval'],
      ['request_approval', 'decide_approval'],
    ),
  );

  let workflow = 10;
  if (input.stageStatus === 'blocked') workflow = 90;
  else if (input.stageStatus === 'failed') workflow = 85;
  else if (input.stageStatus === 'waiting') workflow = 45;
  else if (input.blockerCode) workflow = 80;
  components.push(
    comp(
      'workflow_interruptions',
      workflow,
      [
        `stageStatus=${input.stageStatus ?? 'unknown'}`,
        input.blockerCode ? `blocker=${input.blockerCode}` : 'no blocker code',
      ],
      ['resolve_blocker', 'advance_case'],
    ),
  );

  const conf = input.dataConfidence ?? 0.5;
  components.push(
    comp(
      'poor_ai_confidence',
      clamp((1 - conf) * 100),
      [`dataConfidence=${conf.toFixed(2)}`, `opportunityScore=${input.opportunityScore ?? 'n/a'}`],
      ['refresh_data', 'score_opportunity', 'evaluate_prediction_outcome'],
    ),
  );

  const weightSum = components.reduce((s, c) => s + c.weight, 0);
  const totalFriction = clamp(
    components.reduce((s, c) => s + c.weighted, 0) / Math.max(0.001, weightSum / components.length),
  );

  // Normalize: mean of weighted scores relative to mean weight
  const raw =
    components.reduce((s, c) => s + c.score * c.weight, 0) /
    components.reduce((s, c) => s + c.weight, 0);
  const total = clamp(raw);

  const topDrivers = [...components]
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 3)
    .map((c) => c.dimension);

  const matched = total < 25 && !input.hasPendingApproval && input.stageStatus !== 'blocked';

  return {
    totalFriction: Math.round(total * 10) / 10,
    components,
    topDrivers,
    matched,
    matchNote: matched
      ? 'Friction low — case is near an executable operating point.'
      : `Friction ${total.toFixed(0)}/100 driven by ${topDrivers.join(', ')}. Reduce via recommended transformations.`,
  };
}

function comp(
  dimension: FrictionDimension,
  score: number,
  evidence: string[],
  reducibleBy: string[],
): FrictionComponent {
  const weight = WEIGHTS[dimension];
  const s = clamp(score);
  return {
    dimension,
    score: Math.round(s * 10) / 10,
    weight,
    weighted: Math.round(s * weight * 10) / 10,
    evidence,
    reducibleBy,
  };
}

/** Estimate friction drop if a transformation succeeds (heuristic). */
export function estimateFrictionReduction(
  report: FrictionReport,
  transformationCode: string,
): number {
  let drop = 0;
  for (const c of report.components) {
    if (c.reducibleBy.includes(transformationCode)) {
      drop += c.score * c.weight * 0.35;
    }
  }
  const weightSum = report.components.reduce((s, x) => s + x.weight, 0);
  return Math.round((drop / Math.max(0.001, weightSum)) * 10) / 10;
}
