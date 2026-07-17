/**
 * SaaS plan catalog — Founder / Professional / Agency / Enterprise.
 * Maps to existing PlanTier for entitlement packs.
 */

import type { PlanTier } from '@tradeops/saas-entitlements';

export type SaasPlanId = 'founder' | 'professional' | 'agency' | 'enterprise';

export type SaasPlan = {
  id: SaasPlanId;
  displayName: string;
  planTier: PlanTier;
  description: string;
  monthlyPriceMinor: number;
  annualPriceMinor: number;
  currency: string;
  /** Optional Stripe Price IDs from env (live Checkout) */
  stripePriceMonthlyEnv: string;
  stripePriceAnnualEnv: string;
};

export const SAAS_PLANS: SaasPlan[] = [
  {
    id: 'founder',
    displayName: 'Founder',
    planTier: 'starter',
    description: 'Solo operator — one store path, AI evaluations, fixture + single live connector path.',
    monthlyPriceMinor: 2900,
    annualPriceMinor: 29000,
    currency: 'USD',
    stripePriceMonthlyEnv: 'STRIPE_PRICE_FOUNDER_MONTHLY',
    stripePriceAnnualEnv: 'STRIPE_PRICE_FOUNDER_ANNUAL',
  },
  {
    id: 'professional',
    displayName: 'Professional',
    planTier: 'growth',
    description: 'Growing multichannel — more stores, workflows, supplier tools.',
    monthlyPriceMinor: 9900,
    annualPriceMinor: 99000,
    currency: 'USD',
    stripePriceMonthlyEnv: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
    stripePriceAnnualEnv: 'STRIPE_PRICE_PROFESSIONAL_ANNUAL',
  },
  {
    id: 'agency',
    displayName: 'Agency',
    planTier: 'agency',
    description: 'Multi-client orgs, seats, higher AI/workflow quotas.',
    monthlyPriceMinor: 24900,
    annualPriceMinor: 249000,
    currency: 'USD',
    stripePriceMonthlyEnv: 'STRIPE_PRICE_AGENCY_MONTHLY',
    stripePriceAnnualEnv: 'STRIPE_PRICE_AGENCY_ANNUAL',
  },
  {
    id: 'enterprise',
    displayName: 'Enterprise',
    planTier: 'enterprise',
    description: 'Governance depth, high limits, custom contracting.',
    monthlyPriceMinor: 0,
    annualPriceMinor: 0,
    currency: 'USD',
    stripePriceMonthlyEnv: 'STRIPE_PRICE_ENTERPRISE_MONTHLY',
    stripePriceAnnualEnv: 'STRIPE_PRICE_ENTERPRISE_ANNUAL',
  },
];

export function getPlan(planId: string): SaasPlan | undefined {
  return SAAS_PLANS.find((p) => p.id === planId);
}

export function planTierForSaasPlan(planId: string): PlanTier {
  return getPlan(planId)?.planTier ?? 'evaluation';
}

export function resolveStripePriceId(plan: SaasPlan, interval: 'month' | 'year'): string | null {
  const envKey = interval === 'year' ? plan.stripePriceAnnualEnv : plan.stripePriceMonthlyEnv;
  const v = process.env[envKey]?.trim();
  return v || null;
}

/** Map Stripe subscription status string to our enum values */
export function mapStripeSubscriptionStatus(
  status: string,
): 'trialing' | 'active' | 'past_due' | 'unpaid' | 'cancelled' | 'incomplete' {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
      return 'unpaid';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    default:
      return 'incomplete';
  }
}
