/**
 * Deterministic distribution waterfall calculator.
 * Pure function — no side effects, no promises of returns.
 * Versioned for audit reproducibility.
 */

export const WATERFALL_VERSION = 'waterfall_v1';

export type WaterfallInputs = {
  currency: string;
  /** Gross sales booked to campaign */
  grossSalesMinor: number;
  /** Refunds / chargebacks reversing sales */
  refundsMinor: number;
  /** Statutory / tax withholdings if applicable */
  taxesMinor: number;
  /** Processor + marketplace fees */
  processorFeesMinor: number;
  marketplaceFeesMinor: number;
  /** Supplier + fulfillment costs actually paid */
  supplierCostsMinor: number;
  fulfillmentCostsMinor: number;
  /** Advertising spend */
  advertisingSpendMinor: number;
  /** Operating reserve to restore */
  reserveRestoreMinor: number;
  /** Capital that was funded (principal at risk) */
  capitalFundedMinor: number;
  /** TradeOps platform fee on profit (bps of positive residual) */
  platformFeeBps: number;
  /**
   * Profit share to capital provider after principal return (bps of residual profit).
   * 0 = principal-only commercial finance style residual to merchant.
   * Never treated as a guaranteed return.
   */
  capitalProfitShareBps: number;
};

export type WaterfallStep = {
  step: number;
  name: string;
  amountMinor: number;
  remainingMinor: number;
  note: string;
};

export type WaterfallResult = {
  version: string;
  currency: string;
  steps: WaterfallStep[];
  netSalesMinor: number;
  residualAfterCostsMinor: number;
  principalReturnedMinor: number;
  residualProfitMinor: number;
  residualLossMinor: number;
  platformFeeMinor: number;
  capitalProfitMinor: number;
  merchantResidualMinor: number;
  disclaimer: string;
  inputs: WaterfallInputs;
};

function bps(amount: number, bpsValue: number): number {
  if (amount <= 0 || bpsValue <= 0) return 0;
  return Math.floor((amount * bpsValue) / 10_000);
}

/**
 * Calculate distributable result from realized commerce outcomes.
 * Does not guarantee returns; negative residual allocates loss to capital principal first.
 */
export function calculateDistributionWaterfall(input: WaterfallInputs): WaterfallResult {
  const steps: WaterfallStep[] = [];
  let remaining = 0;
  let step = 0;

  const push = (name: string, amount: number, note: string) => {
    step += 1;
    remaining = Math.max(0, remaining - Math.max(0, amount));
    steps.push({
      step,
      name,
      amountMinor: Math.max(0, amount),
      remainingMinor: remaining,
      note,
    });
  };

  const netSales = Math.max(0, input.grossSalesMinor - input.refundsMinor);
  // Start from net sales; push() subtracts once per step (do not double-subtract).
  remaining = netSales;
  steps.push({
    step: ++step,
    name: 'net_sales_after_refunds',
    amountMinor: netSales,
    remainingMinor: remaining,
    note: `Gross ${input.grossSalesMinor} − refunds ${input.refundsMinor}`,
  });

  push('taxes', input.taxesMinor, 'Statutory/tax deductions where applicable');

  const proc = input.processorFeesMinor + input.marketplaceFeesMinor;
  push('processor_marketplace_fees', proc, 'Payment processor and marketplace fees');

  const cogs = input.supplierCostsMinor + input.fulfillmentCostsMinor + input.advertisingSpendMinor;
  push('operating_costs', cogs, 'Supplier, fulfillment, advertising — realized spend');

  push('restore_reserve', input.reserveRestoreMinor, 'Restore operating reserve if configured');

  const residualAfterCosts = remaining;

  // Principal return: min(capital funded, residual)
  const principalReturned = Math.min(input.capitalFundedMinor, residualAfterCosts);
  push('return_principal', principalReturned, 'Return capital principal per agreement — not a return promise');

  const residualProfit = remaining;
  const residualLoss = Math.max(0, input.capitalFundedMinor - principalReturned);

  const platformFee = bps(residualProfit, input.platformFeeBps);
  push('platform_fee', platformFee, `TradeOps fee ${input.platformFeeBps} bps of residual profit`);

  const afterPlatform = remaining;
  const capitalProfit = bps(afterPlatform, input.capitalProfitShareBps);
  push(
    'capital_profit_share',
    capitalProfit,
    `Capital provider share ${input.capitalProfitShareBps} bps of residual after platform fee — only if model legally approved`,
  );

  const merchantResidual = remaining;
  push('merchant_residual', merchantResidual, 'Merchant residual after waterfall');

  return {
    version: WATERFALL_VERSION,
    currency: input.currency,
    steps,
    netSalesMinor: netSales,
    residualAfterCostsMinor: residualAfterCosts,
    principalReturnedMinor: principalReturned,
    residualProfitMinor: residualProfit,
    residualLossMinor: residualLoss,
    platformFeeMinor: platformFee,
    capitalProfitMinor: capitalProfit,
    merchantResidualMinor: merchantResidual,
    disclaimer:
      'Calculated from realized inputs only. Not a guarantee of returns. Profit-sharing and distributions require legal and feature-gate approval before execution.',
    inputs: input,
  };
}
