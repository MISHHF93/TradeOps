/**
 * Pure CommerceMandate policy checks — no side effects.
 */

export type MandateSnapshot = {
  status: string;
  maximumCapitalMinor: number;
  maximumProductExposureMinor: number;
  maximumDailySpendMinor: number;
  maximumAdvertisingMinor: number;
  minimumMarginBps: number;
  approvalThresholdMinor: number;
  maximumDeliveryDays: number;
  allowedChannels: string[];
  allowedCategories: string[];
  allowedCountries: string[];
};

export type DeploymentProposal = {
  amountMinor: number;
  channel?: string;
  category?: string;
  country?: string;
  expectedMarginBps?: number;
  deliveryDays?: number;
  isAdvertising?: boolean;
  dailyDeployedSoFarMinor?: number;
  productExposureSoFarMinor?: number;
};

export type MandateCheckResult = {
  allowed: boolean;
  requiresApproval: boolean;
  reasons: string[];
};

export function evaluateMandate(
  mandate: MandateSnapshot,
  proposal: DeploymentProposal,
): MandateCheckResult {
  const reasons: string[] = [];

  if (mandate.status !== 'approved') {
    reasons.push(`Mandate status is ${mandate.status} — must be approved`);
  }

  if (proposal.amountMinor <= 0) {
    reasons.push('Amount must be positive');
  }

  if (
    mandate.maximumCapitalMinor > 0 &&
    proposal.amountMinor > mandate.maximumCapitalMinor
  ) {
    reasons.push(
      `Amount ${proposal.amountMinor} exceeds maximum capital ${mandate.maximumCapitalMinor}`,
    );
  }

  if (
    mandate.maximumProductExposureMinor > 0 &&
    (proposal.productExposureSoFarMinor ?? 0) + proposal.amountMinor >
      mandate.maximumProductExposureMinor
  ) {
    reasons.push('Product exposure limit exceeded');
  }

  if (
    mandate.maximumDailySpendMinor > 0 &&
    (proposal.dailyDeployedSoFarMinor ?? 0) + proposal.amountMinor >
      mandate.maximumDailySpendMinor
  ) {
    reasons.push('Daily spend limit exceeded');
  }

  if (
    proposal.isAdvertising &&
    mandate.maximumAdvertisingMinor > 0 &&
    proposal.amountMinor > mandate.maximumAdvertisingMinor
  ) {
    reasons.push('Advertising ceiling exceeded');
  }

  if (
    proposal.channel &&
    mandate.allowedChannels.length > 0 &&
    !mandate.allowedChannels.includes(proposal.channel)
  ) {
    reasons.push(`Channel ${proposal.channel} not in allowed list`);
  }

  if (
    proposal.category &&
    mandate.allowedCategories.length > 0 &&
    !mandate.allowedCategories.includes(proposal.category)
  ) {
    reasons.push(`Category ${proposal.category} not allowed`);
  }

  if (
    proposal.country &&
    mandate.allowedCountries.length > 0 &&
    !mandate.allowedCountries.includes(proposal.country)
  ) {
    reasons.push(`Country ${proposal.country} not allowed`);
  }

  if (
    proposal.expectedMarginBps != null &&
    mandate.minimumMarginBps > 0 &&
    proposal.expectedMarginBps < mandate.minimumMarginBps
  ) {
    reasons.push(
      `Expected margin ${proposal.expectedMarginBps} bps below minimum ${mandate.minimumMarginBps}`,
    );
  }

  if (
    proposal.deliveryDays != null &&
    proposal.deliveryDays > mandate.maximumDeliveryDays
  ) {
    reasons.push(
      `Delivery days ${proposal.deliveryDays} exceed maximum ${mandate.maximumDeliveryDays}`,
    );
  }

  const requiresApproval =
    mandate.approvalThresholdMinor > 0 &&
    proposal.amountMinor >= mandate.approvalThresholdMinor;

  return {
    allowed: reasons.length === 0,
    requiresApproval: reasons.length === 0 && requiresApproval,
    reasons,
  };
}
