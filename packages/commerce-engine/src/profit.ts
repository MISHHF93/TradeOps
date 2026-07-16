import { assertMinor, marginBps, sumMinor } from './money';

/**
 * Contribution profit for a single unit (or scaled by units).
 * Revenue is never reported as profit.
 */
export type ProfitInput = {
  sellingPriceMinor: number;
  discountMinor?: number;
  marketplaceFeeMinor: number;
  paymentFeeMinor: number;
  supplierCostMinor: number;
  shippingCostMinor: number;
  dutiesMinor?: number;
  fxCostMinor?: number;
  advertisingAllocationMinor?: number;
  appAllocationMinor?: number;
  returnReserveMinor?: number;
  refundMinor?: number;
  currency: string;
  units?: number;
};

export type ProfitBreakdown = {
  currency: string;
  units: number;
  revenueMinor: number;
  cogsMinor: number;
  feesMinor: number;
  logisticsMinor: number;
  marketingMinor: number;
  reservesAndRefundsMinor: number;
  contributionProfitMinor: number;
  netMarginBps: number;
  /** Cash typically committed before marketplace payout */
  cashRequiredBeforePayoutMinor: number;
  lines: Array<{ key: string; amountMinor: number; kind: 'inflow' | 'outflow' }>;
};

export function calculateUnitEconomics(input: ProfitInput): ProfitBreakdown {
  const units = input.units ?? 1;
  if (!Number.isInteger(units) || units < 1) {
    throw new Error('units must be a positive integer');
  }

  const selling = assertMinor(input.sellingPriceMinor, 'sellingPriceMinor');
  const discount = assertMinor(input.discountMinor ?? 0, 'discountMinor');
  const revenuePer = selling - discount;
  if (revenuePer < 0) {
    throw new Error('discount cannot exceed selling price');
  }

  const marketplaceFee = assertMinor(input.marketplaceFeeMinor);
  const paymentFee = assertMinor(input.paymentFeeMinor);
  const supplier = assertMinor(input.supplierCostMinor);
  const shipping = assertMinor(input.shippingCostMinor);
  const duties = assertMinor(input.dutiesMinor ?? 0);
  const fx = assertMinor(input.fxCostMinor ?? 0);
  const ads = assertMinor(input.advertisingAllocationMinor ?? 0);
  const app = assertMinor(input.appAllocationMinor ?? 0);
  const reserve = assertMinor(input.returnReserveMinor ?? 0);
  const refund = assertMinor(input.refundMinor ?? 0);

  const revenueMinor = revenuePer * units;
  const cogsMinor = supplier * units;
  const feesMinor = (marketplaceFee + paymentFee) * units;
  const logisticsMinor = (shipping + duties + fx) * units;
  const marketingMinor = (ads + app) * units;
  const reservesAndRefundsMinor = (reserve + refund) * units;

  const contributionProfitMinor =
    revenueMinor - sumMinor(cogsMinor, feesMinor, logisticsMinor, marketingMinor, reservesAndRefundsMinor);

  const cashRequiredBeforePayoutMinor = sumMinor(cogsMinor, logisticsMinor, marketingMinor);

  return {
    currency: input.currency,
    units,
    revenueMinor,
    cogsMinor,
    feesMinor,
    logisticsMinor,
    marketingMinor,
    reservesAndRefundsMinor,
    contributionProfitMinor,
    netMarginBps: marginBps(contributionProfitMinor, revenueMinor),
    cashRequiredBeforePayoutMinor,
    lines: [
      { key: 'revenue', amountMinor: revenueMinor, kind: 'inflow' },
      { key: 'supplier_cost', amountMinor: cogsMinor, kind: 'outflow' },
      { key: 'marketplace_fee', amountMinor: marketplaceFee * units, kind: 'outflow' },
      { key: 'payment_fee', amountMinor: paymentFee * units, kind: 'outflow' },
      { key: 'shipping', amountMinor: shipping * units, kind: 'outflow' },
      { key: 'duties', amountMinor: duties * units, kind: 'outflow' },
      { key: 'fx', amountMinor: fx * units, kind: 'outflow' },
      { key: 'advertising', amountMinor: ads * units, kind: 'outflow' },
      { key: 'app_allocation', amountMinor: app * units, kind: 'outflow' },
      { key: 'return_reserve', amountMinor: reserve * units, kind: 'outflow' },
      { key: 'refund', amountMinor: refund * units, kind: 'outflow' },
    ],
  };
}

/** Default fee estimators when connector has not provided live fee quotes. */
export function estimateMarketplaceFeeMinor(sellingPriceMinor: number, rateBps = 1500): number {
  return Math.round((assertMinor(sellingPriceMinor) * rateBps) / 10_000);
}

export function estimatePaymentFeeMinor(sellingPriceMinor: number, rateBps = 290, fixedMinor = 30): number {
  return Math.round((assertMinor(sellingPriceMinor) * rateBps) / 10_000) + fixedMinor;
}
