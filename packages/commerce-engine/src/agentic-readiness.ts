/**
 * Agentic Commerce Readiness Score — product and tenant level.
 * Modular for UCP/ACP evolution; does not claim live UCP unless wired.
 */

export type AgenticReadinessInput = {
  hasStructuredTitle: boolean;
  hasDescription: boolean;
  hasGtinOrMpn: boolean;
  inventoryFreshHours: number | null;
  priceFreshHours: number | null;
  hasReturnPolicyText: boolean;
  hasDeliveryEstimate: boolean;
  hasImage: boolean;
  dataConfidence: number;
  policyBlocked: boolean;
  checkoutCompatible?: boolean;
  machineReadableDisclosures?: boolean;
};

export type AgenticReadinessResult = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: Array<{ key: string; ok: boolean; weight: number; note: string }>;
  missing: string[];
  note: string;
};

export function scoreAgenticReadiness(input: AgenticReadinessInput): AgenticReadinessResult {
  if (input.policyBlocked) {
    return {
      score: 0,
      grade: 'F',
      factors: [{ key: 'policy', ok: false, weight: 1, note: 'Policy-blocked product cannot be agent-ready' }],
      missing: ['policy_clearance'],
      note: 'Blocked by policy gate.',
    };
  }

  const factors: AgenticReadinessResult['factors'] = [
    {
      key: 'title',
      ok: input.hasStructuredTitle,
      weight: 0.12,
      note: 'Structured product title',
    },
    {
      key: 'description',
      ok: input.hasDescription,
      weight: 0.1,
      note: 'Product description present',
    },
    {
      key: 'identifiers',
      ok: input.hasGtinOrMpn,
      weight: 0.15,
      note: 'GTIN/MPN for machine matching',
    },
    {
      key: 'inventory_fresh',
      ok: input.inventoryFreshHours != null && input.inventoryFreshHours <= 48,
      weight: 0.15,
      note: 'Inventory freshness ≤ 48h',
    },
    {
      key: 'price_fresh',
      ok: input.priceFreshHours != null && input.priceFreshHours <= 48,
      weight: 0.12,
      note: 'Price freshness ≤ 48h',
    },
    {
      key: 'returns',
      ok: input.hasReturnPolicyText,
      weight: 0.1,
      note: 'Return policy clarity',
    },
    {
      key: 'delivery',
      ok: input.hasDeliveryEstimate,
      weight: 0.1,
      note: 'Delivery estimate',
    },
    {
      key: 'image',
      ok: input.hasImage,
      weight: 0.08,
      note: 'Product image',
    },
    {
      key: 'confidence',
      ok: input.dataConfidence >= 0.7,
      weight: 0.08,
      note: 'Data confidence ≥ 0.7',
    },
  ];

  let score = 0;
  const missing: string[] = [];
  for (const f of factors) {
    if (f.ok) score += f.weight * 100;
    else missing.push(f.key);
  }

  // Optional protocol flags boost but are not required
  if (input.checkoutCompatible) score = Math.min(100, score + 5);
  if (input.machineReadableDisclosures) score = Math.min(100, score + 5);

  score = Math.round(score);
  const grade: AgenticReadinessResult['grade'] =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  return {
    score,
    grade,
    factors,
    missing,
    note: 'Readiness for AI-mediated discovery/checkout paths. Does not claim live UCP/ACP connection.',
  };
}
