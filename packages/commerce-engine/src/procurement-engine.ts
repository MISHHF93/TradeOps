/**
 * AI Procurement Engine — transparent B2B / industrial purchasing intelligence.
 * Complements retail opportunity scoring; same money + policy principles.
 */

import { calculateUnitEconomics } from './profit';
import type { IndustrialProductProfile } from './industrial-product';
import { rankSubstituteParts } from './industrial-product';

export type TechnicalRequirement = {
  key: string;
  operator: 'eq' | 'gte' | 'lte' | 'contains';
  value: string | number;
  unit?: string;
  required?: boolean;
};

export type SupplierQuoteLine = {
  supplierId?: string;
  supplierName: string;
  unitCostMinor: number;
  currency: string;
  moq?: number;
  leadTimeDays?: number;
  availableQty?: number;
  shippingMinor?: number;
  dutiesMinor?: number;
  validUntil?: string;
  notes?: string;
};

export type RfqDraft = {
  id: string;
  title: string;
  productId?: string;
  requirements: TechnicalRequirement[];
  quantity: number;
  targetCurrency: string;
  needByDate?: string;
  status: 'draft' | 'sent' | 'quoted' | 'awarded' | 'cancelled';
  createdAt: string;
  lines?: SupplierQuoteLine[];
};

export type QuoteComparison = {
  supplierName: string;
  landedCostMinor: number;
  unitLandedMinor: number;
  leadTimeDays: number | null;
  moqOk: boolean;
  riskFlags: string[];
  score: number;
  recommendation: string;
};

export type ProcurementRiskAssessment = {
  overall: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  score: number;
  notes: string[];
};

export function matchRequirements(
  profile: IndustrialProductProfile,
  requirements: TechnicalRequirement[],
): { matched: number; total: number; missing: string[]; details: Array<{ key: string; ok: boolean }> } {
  const specs = new Map(
    (profile.technicalSpecifications ?? []).map((s) => [s.key.toLowerCase(), s]),
  );
  const details: Array<{ key: string; ok: boolean }> = [];
  const missing: string[] = [];

  for (const req of requirements) {
    const k = req.key.toLowerCase();
    const spec = specs.get(k);
    let ok = false;
    if (spec) {
      const sv = spec.value;
      const rv = String(req.value);
      if (req.operator === 'eq') ok = sv.toLowerCase() === rv.toLowerCase();
      else if (req.operator === 'contains') ok = sv.toLowerCase().includes(rv.toLowerCase());
      else if (req.operator === 'gte') ok = Number(sv) >= Number(req.value);
      else if (req.operator === 'lte') ok = Number(sv) <= Number(req.value);
    }
    if (!ok && req.required !== false) missing.push(req.key);
    details.push({ key: req.key, ok });
  }
  const matched = details.filter((d) => d.ok).length;
  return { matched, total: requirements.length, missing, details };
}

export function estimateLandedCost(line: SupplierQuoteLine, quantity: number): {
  unitLandedMinor: number;
  totalLandedMinor: number;
  breakdown: Record<string, number>;
} {
  const qty = Math.max(1, quantity);
  const ship = line.shippingMinor ?? 0;
  const duties = line.dutiesMinor ?? 0;
  const goods = line.unitCostMinor * qty;
  const total = goods + ship + duties;
  return {
    unitLandedMinor: Math.round(total / qty),
    totalLandedMinor: total,
    breakdown: {
      goodsMinor: goods,
      shippingMinor: ship,
      dutiesMinor: duties,
    },
  };
}

export function compareQuotations(
  quotes: SupplierQuoteLine[],
  quantity: number,
): QuoteComparison[] {
  return quotes
    .map((q) => {
      const landed = estimateLandedCost(q, quantity);
      const riskFlags: string[] = [];
      if (q.leadTimeDays != null && q.leadTimeDays > 45) riskFlags.push('long_lead_time');
      if (q.moq != null && q.moq > quantity) riskFlags.push('moq_exceeds_need');
      if (q.availableQty != null && q.availableQty < quantity) riskFlags.push('insufficient_stock');
      if (!q.validUntil) riskFlags.push('quote_validity_unknown');

      const moqOk = q.moq == null || q.moq <= quantity;
      // Lower landed cost and risk → higher score
      let score = 100;
      score -= Math.min(50, Math.round(landed.unitLandedMinor / 100));
      score -= riskFlags.length * 8;
      if ((q.leadTimeDays ?? 14) > 30) score -= 10;
      score = Math.max(0, Math.min(100, score));

      return {
        supplierName: q.supplierName,
        landedCostMinor: landed.totalLandedMinor,
        unitLandedMinor: landed.unitLandedMinor,
        leadTimeDays: q.leadTimeDays ?? null,
        moqOk,
        riskFlags,
        score,
        recommendation:
          score >= 70
            ? 'Competitive — advance to award if technical fit confirmed'
            : score >= 45
              ? 'Negotiate lead time or MOQ before award'
              : 'High cost or risk — seek alternate suppliers',
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function assessProcurementRisk(input: {
  singleSource?: boolean;
  hazmat?: boolean;
  leadTimeDays?: number;
  countryOfOrigin?: string;
  dataConfidence?: number;
  quoteCount?: number;
}): ProcurementRiskAssessment {
  const flags: string[] = [];
  const notes: string[] = [];
  let score = 20;

  if (input.singleSource) {
    flags.push('single_source');
    score += 25;
    notes.push('Single-source dependency increases disruption risk');
  }
  if (input.hazmat) {
    flags.push('hazmat');
    score += 20;
    notes.push('Hazmat classification requires compliant logistics');
  }
  if ((input.leadTimeDays ?? 0) > 60) {
    flags.push('extended_lead');
    score += 15;
  }
  if ((input.quoteCount ?? 0) < 2) {
    flags.push('limited_competition');
    score += 15;
  }
  if ((input.dataConfidence ?? 1) < 0.5) {
    flags.push('low_data_confidence');
    score += 15;
  }

  score = Math.min(100, score);
  const overall =
    score >= 70 ? 'critical' : score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low';

  return { overall, flags, score, notes };
}

export function draftRfq(input: {
  title: string;
  productId?: string;
  requirements: TechnicalRequirement[];
  quantity: number;
  currency?: string;
  needByDate?: string;
}): RfqDraft {
  return {
    id: `rfq-draft-${Date.now().toString(36)}`,
    title: input.title,
    productId: input.productId,
    requirements: input.requirements,
    quantity: Math.max(1, input.quantity),
    targetCurrency: input.currency ?? 'USD',
    needByDate: input.needByDate,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
}

export function recommendProcurementAction(input: {
  bestQuote?: QuoteComparison;
  risk: ProcurementRiskAssessment;
  technicalFitRatio: number;
}): {
  action: 'award' | 'negotiate' | 're_bid' | 'hold' | 'reject';
  rationale: string;
  approvalRequired: boolean;
} {
  if (input.technicalFitRatio < 0.6) {
    return {
      action: 'reject',
      rationale: 'Technical requirements not sufficiently met',
      approvalRequired: false,
    };
  }
  if (input.risk.overall === 'critical') {
    return {
      action: 'hold',
      rationale: 'Critical procurement risk — escalate before award',
      approvalRequired: true,
    };
  }
  if (!input.bestQuote) {
    return {
      action: 're_bid',
      rationale: 'No quotes to compare — issue RFQ',
      approvalRequired: false,
    };
  }
  if (input.bestQuote.score >= 70 && input.technicalFitRatio >= 0.85) {
    return {
      action: 'award',
      rationale: `Award candidate ${input.bestQuote.supplierName} (score ${input.bestQuote.score})`,
      approvalRequired: true,
    };
  }
  if (input.bestQuote.score >= 45) {
    return {
      action: 'negotiate',
      rationale: 'Viable quote with gaps — negotiate MOQ/lead/price',
      approvalRequired: true,
    };
  }
  return {
    action: 're_bid',
    rationale: 'Quotes underperform — expand supplier set',
    approvalRequired: false,
  };
}

/** End-to-end procurement evaluation for one industrial product. */
export function evaluateProcurementCase(input: {
  productId: string;
  title: string;
  profile: IndustrialProductProfile;
  requirements: TechnicalRequirement[];
  quotes: SupplierQuoteLine[];
  quantity: number;
  substitutes?: Array<{ productId: string; title: string; profile: IndustrialProductProfile }>;
}) {
  const fit = matchRequirements(input.profile, input.requirements);
  const comparisons = compareQuotations(input.quotes, input.quantity);
  const best = comparisons[0];
  const risk = assessProcurementRisk({
    singleSource: (input.quotes?.length ?? 0) <= 1,
    hazmat: Boolean(input.profile.hazmatClass),
    leadTimeDays: best?.leadTimeDays ?? input.profile.leadTimeDays,
    countryOfOrigin: input.profile.countryOfOrigin,
    dataConfidence: 0.7,
    quoteCount: input.quotes.length,
  });
  const technicalFitRatio = fit.total === 0 ? 1 : fit.matched / fit.total;
  const action = recommendProcurementAction({
    bestQuote: best,
    risk,
    technicalFitRatio,
  });
  const substitutes = input.substitutes
    ? rankSubstituteParts(input.profile, input.substitutes).slice(0, 5)
    : [];

  // Contribution economics if list vs cost known
  let unitEconomics = null as ReturnType<typeof calculateUnitEconomics> | null;
  if (input.profile.listPriceMinor != null && input.profile.costMinor != null) {
    try {
      unitEconomics = calculateUnitEconomics({
        sellingPriceMinor: input.profile.listPriceMinor,
        supplierCostMinor: input.profile.costMinor,
        shippingCostMinor: best?.unitLandedMinor
          ? Math.max(0, best.unitLandedMinor - input.profile.costMinor)
          : 0,
        marketplaceFeeMinor: 0,
        paymentFeeMinor: 0,
        currency: input.profile.currency ?? 'USD',
      });
    } catch {
      unitEconomics = null;
    }
  }

  return {
    productId: input.productId,
    title: input.title,
    technicalFit: fit,
    technicalFitRatio,
    quoteComparisons: comparisons,
    risk,
    action,
    substitutes,
    unitEconomics,
    rfq: draftRfq({
      title: `RFQ: ${input.title}`,
      productId: input.productId,
      requirements: input.requirements,
      quantity: input.quantity,
      currency: input.profile.currency,
    }),
    honesty: {
      note: 'Procurement recommendations are decision support. Award/PO requires human approval. Quotes are not invented.',
    },
  };
}
