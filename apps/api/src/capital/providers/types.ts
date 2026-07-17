/**
 * Payment / capital provider abstractions.
 * Stripe Billing / Connect may implement these — never treat Stripe as investment custodian.
 */

export type ProviderCapability = {
  providerKey: string;
  displayName: string;
  supportedCountries: string[];
  supportedCurrencies: string[];
  /** Who owns the balance / account */
  accountOwner: 'platform' | 'connected_client' | 'supplier' | 'partner_custody';
  merchantOfRecord: 'platform' | 'connected_client' | 'channel' | 'unknown';
  disputeLiability: 'platform' | 'connected_client' | 'shared' | 'channel';
  settlementDestination: 'platform_balance' | 'connected_account' | 'partner_custody' | 'channel';
  payoutControl: 'platform' | 'connected_client' | 'partner';
  requiresKyc: boolean;
  requiresKyb: boolean;
  isInvestmentCustodian: boolean;
  notes: string[];
};

export type ProviderOpResult = {
  ok: boolean;
  providerReference?: string;
  status: string;
  raw?: unknown;
  error?: string;
};

export interface PlatformBillingProvider {
  capability(): ProviderCapability;
}

export interface ConnectedAccountProvider {
  capability(): ProviderCapability;
  startOnboarding(input: {
    organizationId: string;
    role: string;
  }): Promise<ProviderOpResult>;
}

export interface CommercePaymentProvider {
  capability(): ProviderCapability;
}

export interface CapitalFundingProvider {
  capability(): ProviderCapability;
  openFundingFlow(input: {
    organizationId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<ProviderOpResult>;
}

export interface SupplierPaymentProvider {
  capability(): ProviderCapability;
}

export interface PayoutProvider {
  capability(): ProviderCapability;
}

export interface IdentityVerificationProvider {
  capability(): ProviderCapability;
}

/** Static capability registry — honest about what is not a custody bank */
export function stripeBillingCapability(): ProviderCapability {
  return {
    providerKey: 'stripe_billing',
    displayName: 'Stripe Billing (SaaS)',
    supportedCountries: ['*'],
    supportedCurrencies: ['USD', 'CAD', 'EUR', 'GBP'],
    accountOwner: 'platform',
    merchantOfRecord: 'platform',
    disputeLiability: 'platform',
    settlementDestination: 'platform_balance',
    payoutControl: 'platform',
    requiresKyc: false,
    requiresKyb: false,
    isInvestmentCustodian: false,
    notes: ['Subscriptions and invoices only — not client commerce capital.'],
  };
}

export function stripeConnectCapability(): ProviderCapability {
  return {
    providerKey: 'stripe_connect',
    displayName: 'Stripe Connect (marketplace)',
    supportedCountries: ['CA', 'US', 'GB', 'EU'],
    supportedCurrencies: ['CAD', 'USD', 'EUR', 'GBP'],
    accountOwner: 'connected_client',
    merchantOfRecord: 'platform', // depends on charge type; document per payment
    disputeLiability: 'platform', // separate charges & transfers often platform-liable
    settlementDestination: 'connected_account',
    payoutControl: 'platform',
    requiresKyc: true,
    requiresKyb: true,
    isInvestmentCustodian: false,
    notes: [
      'Marketplace / connected accounts only.',
      'Not an investment custodian or bank.',
      'Do not pool investor funds in platform balance.',
    ],
  };
}

export function sandboxFundingCapability(): ProviderCapability {
  return {
    providerKey: 'sandbox_funding',
    displayName: 'Sandbox funding (non-production)',
    supportedCountries: ['CA'],
    supportedCurrencies: ['CAD', 'USD'],
    accountOwner: 'connected_client',
    merchantOfRecord: 'unknown',
    disputeLiability: 'shared',
    settlementDestination: 'partner_custody',
    payoutControl: 'partner',
    requiresKyc: true,
    requiresKyb: true,
    isInvestmentCustodian: false,
    notes: [
      'Simulated funding for architecture tests only.',
      'Never credit live usable capital from browser redirect alone.',
    ],
  };
}

export function listProviderCapabilities(): ProviderCapability[] {
  return [stripeBillingCapability(), stripeConnectCapability(), sandboxFundingCapability()];
}
