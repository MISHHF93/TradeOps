/**
 * TradeOps capital product mode — client-owned managed commerce vs prohibited structures.
 *
 * Default positioning: client owns the commerce operation and connected payment account.
 * TradeOps orchestrates within a CommerceMandate. Not a pooled investment fund.
 */

export type CapitalProductMode =
  | 'disabled'
  | 'sandbox'
  | 'client_owned'
  | 'private_agreement'
  | 'network'; // legally gated full network — still not pooled fund

function envTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function envFalsyExplicit(name: string): boolean {
  if (process.env[name] === undefined) return false;
  const v = process.env[name]!.trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'no' || v === 'off';
}

/**
 * TRADEOPS_CAPITAL_MODE env:
 * - client_owned (recommended launch)
 * - sandbox
 * - private_agreement
 * - network
 * - disabled
 *
 * Defaults to client_owned for product architecture; real funding still requires provider gates.
 */
export function getCapitalProductMode(
  source: NodeJS.ProcessEnv = process.env,
): CapitalProductMode {
  const raw = (source.TRADEOPS_CAPITAL_MODE ?? 'client_owned').trim().toLowerCase();
  switch (raw) {
    case 'disabled':
    case 'sandbox':
    case 'client_owned':
    case 'private_agreement':
    case 'network':
      return raw;
    default:
      return 'client_owned';
  }
}

/** Hard-disabled structures — production cannot enable via env alone without explicit allow. */
export function isPooledInvestmentEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  // Alias both env names
  if (envTruthy('TRADEOPS_POOLED_INVESTMENT_ENABLED') || envTruthy('POOLED_INVESTMENT_ENABLED')) {
    // Still blocked in production unless both are set (defense in depth)
    if ((source.NODE_ENV ?? 'development') === 'production') {
      return false; // never allow pooled investment in production builds via config alone
    }
    return true; // non-production only for architecture tests
  }
  return false;
}

export function isGuaranteedReturnsEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  if (envTruthy('TRADEOPS_GUARANTEED_RETURNS_ENABLED') || envTruthy('GUARANTEED_RETURNS_ENABLED')) {
    if ((source.NODE_ENV ?? 'development') === 'production') return false;
    return true;
  }
  return false;
}

export function isInternalCustodyEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  // TRADEOPS_INTERNAL_CUSTODY_ENABLED — TradeOps pretending to hold client money without partner
  if (envTruthy('TRADEOPS_INTERNAL_CUSTODY_ENABLED') || envTruthy('CAPITAL_CUSTODY_ENABLED')) {
    // Internal custody (operating account) always blocked; external partner custody is separate
    if (envTruthy('TRADEOPS_INTERNAL_CUSTODY_ENABLED')) {
      // Explicit internal custody is never allowed in production
      if ((source.NODE_ENV ?? 'development') === 'production') return false;
    }
    // CAPITAL_CUSTODY_ENABLED may mean partner-controlled custody later — still default off
    return envTruthy('TRADEOPS_INTERNAL_CUSTODY_ENABLED')
      ? (source.NODE_ENV ?? 'development') !== 'production' && envTruthy('TRADEOPS_INTERNAL_CUSTODY_ENABLED')
      : false;
  }
  return false;
}

export function capitalModeCatalog(source: NodeJS.ProcessEnv = process.env) {
  const mode = getCapitalProductMode(source);
  const production = (source.NODE_ENV ?? 'development') === 'production';
  return {
    mode,
    production,
    positioning: {
      product:
        'AI Commerce Operating System — intelligence and execution; optional capital modules are deferred',
      primaryProduct:
        'SaaS subscription + multichannel commerce ops. Merchant owns stores and payment processors.',
      not: [
        'Pooled investment fund',
        'Guaranteed returns product',
        'Internal custody bank account',
        'Securities crowdfunding portal (unless separately licensed)',
        'Primary product = investment management',
      ],
      language: {
        preferred: [
          'AI commerce operating system',
          'operational recommendations',
          'commerce budget',
          'realized P&L',
        ],
        avoid: [
          'investment platform',
          'investment returns',
          'guaranteed yield',
          'profit share (unapproved)',
          'wallet as bank',
        ],
      },
    },
    hardBlocks: {
      pooledInvestment: {
        enabled: isPooledInvestmentEnabled(source),
        productionForcedOff: production,
        env: 'TRADEOPS_POOLED_INVESTMENT_ENABLED',
      },
      guaranteedReturns: {
        enabled: isGuaranteedReturnsEnabled(source),
        productionForcedOff: production,
        env: 'TRADEOPS_GUARANTEED_RETURNS_ENABLED',
      },
      internalCustody: {
        enabled: isInternalCustodyEnabled(source),
        productionForcedOff: production,
        env: 'TRADEOPS_INTERNAL_CUSTODY_ENABLED',
        note: 'Client funds must use approved payment/custody partner — not TradeOps operating balance.',
      },
    },
    rails: [
      {
        id: 'saas_billing',
        description: 'Client → Stripe → TradeOps subscription',
      },
      {
        id: 'shopper_commerce_payments',
        description: 'Shopper → storefront/processor → merchant settlement',
      },
      {
        id: 'client_operating_capital',
        description: 'Client → partner funding rail → segregated ledger / connected account',
      },
      {
        id: 'supplier_service_payments',
        description: 'Controlled disbursements to suppliers/ads within mandate',
      },
      {
        id: 'marketplace_settlements_client_payouts',
        description: 'Settlements → reconciliation → withdrawable proceeds → partner payout',
      },
    ],
    honesty: {
      note:
        'Primary product: AI commerce intelligence and execution (SaaS). Capital/network modules are optional architecture, not investment custody. Shopper funds stay with merchant processors.',
    },
  };
}

export function assertNotPooledInvestment(): void {
  if (isPooledInvestmentEnabled() && process.env.NODE_ENV === 'production') {
    throw new Error('Pooled investment is permanently disabled in production');
  }
  if (isPooledInvestmentEnabled()) {
    // even in dev, surface that this is a test-only path
  }
}

export function assertNoGuaranteedReturns(): void {
  if (isGuaranteedReturnsEnabled() && process.env.NODE_ENV === 'production') {
    throw new Error('Guaranteed returns are permanently disabled in production');
  }
}

/** Production hard-stop: internal custody config ignored */
export function assertNoInternalCustodyInProduction(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    envTruthy('TRADEOPS_INTERNAL_CUSTODY_ENABLED')
  ) {
    throw new Error(
      'TRADEOPS_INTERNAL_CUSTODY_ENABLED cannot be active in production — use partner custody rails only',
    );
  }
}
