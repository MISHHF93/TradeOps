import {
  assessProductPolicy,
  calculateUnitEconomics,
  decideSignal,
  estimateMarketplaceFeeMinor,
  estimatePaymentFeeMinor,
  forecastDemand,
  scoreOpportunity,
  type CommerceSignalType,
} from '@tradeops/commerce-engine';

export type ProductEconomicsInput = {
  title: string;
  description: string;
  category: string;
  supplierCostMinor: number;
  shippingCostMinor: number;
  targetPriceMinor: number;
  marketplaceFeeMinor?: number;
  paymentFeeMinor?: number;
  adAllocationMinor: number;
  returnReserveMinor: number;
  currency: string;
  rating: number;
  reviewCount: number;
  inventoryQuantity: number;
  dataConfidence: number;
  hasActiveListing: boolean;
};

export function deriveProductIntelligence(input: ProductEconomicsInput) {
  const marketplaceFeeMinor =
    input.marketplaceFeeMinor ?? estimateMarketplaceFeeMinor(input.targetPriceMinor);
  const paymentFeeMinor =
    input.paymentFeeMinor ?? estimatePaymentFeeMinor(input.targetPriceMinor);

  const unit = calculateUnitEconomics({
    sellingPriceMinor: input.targetPriceMinor,
    marketplaceFeeMinor,
    paymentFeeMinor,
    supplierCostMinor: input.supplierCostMinor,
    shippingCostMinor: input.shippingCostMinor,
    advertisingAllocationMinor: input.adAllocationMinor,
    returnReserveMinor: input.returnReserveMinor,
    currency: input.currency,
    units: 1,
  });

  const policy = assessProductPolicy({
    title: input.title,
    description: input.description,
    category: input.category,
  });

  const reviewHealth = Math.round(Math.min(100, (input.rating / 5) * 80 + Math.min(20, input.reviewCount / 50)));
  const demandPotential = Math.min(100, 40 + Math.min(40, input.reviewCount / 30) + (input.rating >= 4.3 ? 15 : 0));
  const trendMomentum = Math.min(100, 45 + (input.inventoryQuantity > 100 ? 15 : 5));
  const netMarginPotential = Math.min(100, Math.max(0, unit.netMarginBps / 40));
  const supplierQuality = Math.min(100, 55 + Math.min(35, input.dataConfidence * 40));
  const shippingReliability = input.shippingCostMinor < 500 ? 75 : 60;
  const competition = Math.min(100, 35 + (input.category.length % 20));
  const returnRisk = Math.min(100, 100 - reviewHealth + 10);
  const policyRisk = policy.outcome === 'blocked' ? 100 : policy.outcome === 'manual_review' ? 70 : 15;
  const capitalRequirement = Math.min(100, (input.supplierCostMinor + input.shippingCostMinor) / 40);

  const scored = scoreOpportunity({
    demandPotential,
    trendMomentum,
    netMarginPotential,
    supplierQuality,
    shippingReliability,
    reviewHealth,
    competition,
    returnRisk,
    policyRisk,
    capitalRequirement,
    dataConfidence: input.dataConfidence * 100,
    policyBlocked: policy.outcome === 'blocked',
  });

  // Synthetic short history from review volume for baseline forecast demo
  const daily = Math.max(1, Math.round(input.reviewCount / 90));
  const observations = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
    units: daily + (i % 3),
  }));
  const forecast7 = forecastDemand(observations, 7);
  const forecast14 = forecastDemand(observations, 14);
  const forecast30 = forecastDemand(observations, 30);

  const signal = decideSignal({
    opportunityScore: scored.score,
    policyOutcome: policy.outcome,
    netMarginBps: unit.netMarginBps,
    hasActiveListing: input.hasActiveListing,
    forecastConfidence: forecast14.confidence,
    dataConfidence: input.dataConfidence,
  });

  const expectedProfitMinor = unit.contributionProfitMinor * forecast14.expectedUnits;

  return {
    marketplaceFeeMinor,
    paymentFeeMinor,
    unit,
    policy,
    scored,
    forecast7,
    forecast14,
    forecast30,
    signal: signal.signal as CommerceSignalType,
    signalRationale: signal.rationale,
    signalConfidence: signal.confidence,
    expectedProfitMinor,
    demandScore: Math.round(demandPotential),
    trendScore: Math.round(trendMomentum),
    competitionScore: Math.round(competition),
    supplierReliability: Math.round(supplierQuality),
    shippingReliability: Math.round(shippingReliability),
    reviewHealth: Math.round(reviewHealth),
    returnRiskScore: Math.round(returnRisk),
    policyRiskScore: Math.round(policyRisk),
  };
}
