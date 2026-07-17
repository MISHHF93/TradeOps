import { calculateUnitEconomics } from './profit';

/**
 * Compare contribution profit across marketplace channels.
 * Never rank channels by revenue alone.
 */

export type ChannelEconomicsInput = {
  channelKey: string;
  displayName: string;
  sellingPriceMinor: number;
  marketplaceFeeMinor: number;
  paymentFeeMinor: number;
  supplierCostMinor: number;
  shippingCostMinor: number;
  advertisingAllocationMinor?: number;
  returnReserveMinor?: number;
  dutiesMinor?: number;
  currency: string;
  /** Payout delay in days (working capital pressure) */
  payoutDelayDays?: number;
  conversionScore?: number;
  competitionScore?: number;
  policyRiskScore?: number;
};

export type ChannelProfitabilityResult = {
  channelKey: string;
  displayName: string;
  contributionProfitMinor: number;
  netMarginBps: number;
  cashRequiredBeforePayoutMinor: number;
  riskAdjustedProfitMinor: number;
  score: number;
  reasons: string[];
};

export function scoreChannel(input: ChannelEconomicsInput): ChannelProfitabilityResult {
  const unit = calculateUnitEconomics({
    sellingPriceMinor: input.sellingPriceMinor,
    marketplaceFeeMinor: input.marketplaceFeeMinor,
    paymentFeeMinor: input.paymentFeeMinor,
    supplierCostMinor: input.supplierCostMinor,
    shippingCostMinor: input.shippingCostMinor,
    advertisingAllocationMinor: input.advertisingAllocationMinor ?? 0,
    returnReserveMinor: input.returnReserveMinor ?? 0,
    dutiesMinor: input.dutiesMinor ?? 0,
    currency: input.currency,
  });

  const payoutPenalty = Math.min(30, (input.payoutDelayDays ?? 7) * 0.8);
  const policyPenalty = (input.policyRiskScore ?? 15) * 0.4;
  const conversionBoost = ((input.conversionScore ?? 50) - 50) * 0.3;
  const competitionPenalty = ((input.competitionScore ?? 50) - 40) * 0.2;

  const riskAdjusted = Math.round(
    unit.contributionProfitMinor * (1 - policyPenalty / 100) - payoutPenalty * 10,
  );

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        unit.netMarginBps / 40 + conversionBoost - competitionPenalty - policyPenalty / 2,
      ),
    ),
  );

  const reasons: string[] = [
    `Contribution ${unit.contributionProfitMinor} minor (${(unit.netMarginBps / 100).toFixed(1)}% margin)`,
    `Payout delay ~${input.payoutDelayDays ?? 7}d`,
  ];
  if ((input.policyRiskScore ?? 0) >= 50) reasons.push('Elevated policy risk');
  if ((input.conversionScore ?? 50) >= 65) reasons.push('Strong conversion signal');

  return {
    channelKey: input.channelKey,
    displayName: input.displayName,
    contributionProfitMinor: unit.contributionProfitMinor,
    netMarginBps: unit.netMarginBps,
    cashRequiredBeforePayoutMinor: unit.cashRequiredBeforePayoutMinor,
    riskAdjustedProfitMinor: riskAdjusted,
    score,
    reasons,
  };
}

export function recommendBestChannel(channels: ChannelEconomicsInput[]): {
  recommended: ChannelProfitabilityResult | null;
  alternatives: ChannelProfitabilityResult[];
  note: string;
} {
  if (channels.length === 0) {
    return {
      recommended: null,
      alternatives: [],
      note: 'No channels supplied.',
    };
  }
  const scored = channels.map(scoreChannel).sort((a, b) => b.score - a.score);
  const [best, ...rest] = scored;
  return {
    recommended: best ?? null,
    alternatives: rest,
    note: 'Ranking uses contribution profit and risk adjustments — never revenue alone.',
  };
}
