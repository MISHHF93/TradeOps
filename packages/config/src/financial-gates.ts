/**
 * TradeOps financial feature gates.
 *
 * SaaS billing and channel commerce-payment intelligence are operational.
 * Marketplace Connect and Commerce Capital are architected but legally gated.
 *
 * Defaults: all investment-sensitive capabilities OFF.
 * Backend policies must call these — never rely on hidden UI alone.
 */

export type FinancialGateKey =
  | 'CAPITAL_NETWORK_ENABLED'
  | 'PUBLIC_CAMPAIGNS_ENABLED'
  | 'INVESTOR_ONBOARDING_ENABLED'
  | 'PROFIT_SHARING_ENABLED'
  | 'EQUITY_OFFERINGS_ENABLED'
  | 'POOLED_INVESTMENT_ENABLED'
  | 'AUTOMATED_INVESTMENT_ADVICE_ENABLED'
  | 'CAPITAL_CUSTODY_ENABLED'
  | 'DISTRIBUTIONS_ENABLED'
  | 'MARKETPLACE_CONNECT_ENABLED'
  | 'PRIVATE_AGREEMENT_LEDGER_ENABLED'
  | 'CAPITAL_SANDBOX_ENABLED';

/** Canonical env names read by isFinancialGateEnabled (process.env[key]). */
export const FINANCIAL_GATE_ENV_NAMES: readonly FinancialGateKey[] = [
  'CAPITAL_NETWORK_ENABLED',
  'PUBLIC_CAMPAIGNS_ENABLED',
  'INVESTOR_ONBOARDING_ENABLED',
  'PROFIT_SHARING_ENABLED',
  'EQUITY_OFFERINGS_ENABLED',
  'POOLED_INVESTMENT_ENABLED',
  'AUTOMATED_INVESTMENT_ADVICE_ENABLED',
  'CAPITAL_CUSTODY_ENABLED',
  'DISTRIBUTIONS_ENABLED',
  'MARKETPLACE_CONNECT_ENABLED',
  'PRIVATE_AGREEMENT_LEDGER_ENABLED',
  'CAPITAL_SANDBOX_ENABLED',
] as const;

export type FinancialGateState = {
  key: FinancialGateKey;
  enabled: boolean;
  defaultEnabled: boolean;
  category:
    | 'operational'
    | 'sandbox'
    | 'private_agreement'
    | 'legal_review_required'
    | 'provider_blocked'
    | 'disabled';
  description: string;
  legalNote: string;
};

function envTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Gate definitions. Sensitive investment features default to false
 * regardless of NODE_ENV unless explicitly enabled.
 */
const GATE_META: Record<
  FinancialGateKey,
  Omit<FinancialGateState, 'enabled'>
> = {
  CAPITAL_NETWORK_ENABLED: {
    key: 'CAPITAL_NETWORK_ENABLED',
    defaultEnabled: false,
    category: 'legal_review_required',
    description: 'Master switch for Commerce Capital Network APIs beyond read-only status.',
    legalNote:
      'Do not enable public capital network without securities counsel, portal status, and custody model.',
  },
  PUBLIC_CAMPAIGNS_ENABLED: {
    key: 'PUBLIC_CAMPAIGNS_ENABLED',
    defaultEnabled: false,
    category: 'legal_review_required',
    description: 'Public campaign listings and solicitation of capital providers.',
    legalNote: 'Public solicitation may require a registered or exempt funding portal.',
  },
  INVESTOR_ONBOARDING_ENABLED: {
    key: 'INVESTOR_ONBOARDING_ENABLED',
    defaultEnabled: false,
    category: 'legal_review_required',
    description: 'Capital-provider KYC / accreditation onboarding flows.',
    legalNote: 'Requires identity, AML, and eligibility verification providers.',
  },
  PROFIT_SHARING_ENABLED: {
    key: 'PROFIT_SHARING_ENABLED',
    defaultEnabled: false,
    category: 'legal_review_required',
    description: 'Profit-share / revenue-share funding models on campaigns.',
    legalNote: 'May constitute an investment contract — legal review required.',
  },
  EQUITY_OFFERINGS_ENABLED: {
    key: 'EQUITY_OFFERINGS_ENABLED',
    defaultEnabled: false,
    category: 'legal_review_required',
    description: 'Equity crowdfunding style offerings.',
    legalNote: 'Securities crowdfunding — portal and issuer compliance required.',
  },
  POOLED_INVESTMENT_ENABLED: {
    key: 'POOLED_INVESTMENT_ENABLED',
    defaultEnabled: false,
    category: 'disabled',
    description: 'Pooling multiple investors into managed portfolios.',
    legalNote: 'Likely collective investment / portfolio management — disabled by default.',
  },
  AUTOMATED_INVESTMENT_ADVICE_ENABLED: {
    key: 'AUTOMATED_INVESTMENT_ADVICE_ENABLED',
    defaultEnabled: false,
    category: 'disabled',
    description: 'AI or rules that recommend investments to capital providers.',
    legalNote: 'May be advice-giving activity — not permitted without approved framework.',
  },
  CAPITAL_CUSTODY_ENABLED: {
    key: 'CAPITAL_CUSTODY_ENABLED',
    defaultEnabled: false,
    category: 'legal_review_required',
    description: 'Holding investor/campaign funds in platform-controlled balances.',
    legalNote: 'Funds must not sit in ordinary TradeOps operating accounts without legal design.',
  },
  DISTRIBUTIONS_ENABLED: {
    key: 'DISTRIBUTIONS_ENABLED',
    defaultEnabled: false,
    category: 'legal_review_required',
    description: 'Execute capital/profit distributions to providers.',
    legalNote: 'Requires approved waterfall, custody, and payment rails.',
  },
  MARKETPLACE_CONNECT_ENABLED: {
    key: 'MARKETPLACE_CONNECT_ENABLED',
    defaultEnabled: false,
    category: 'provider_blocked',
    description: 'Stripe Connect (or equivalent) live onboarding and platform payouts.',
    legalNote: 'Requires Stripe Connect platform account and KYC configuration.',
  },
  PRIVATE_AGREEMENT_LEDGER_ENABLED: {
    key: 'PRIVATE_AGREEMENT_LEDGER_ENABLED',
    defaultEnabled: false,
    category: 'private_agreement',
    description:
      'Record commitments/budgets/disbursements for an existing private financing agreement (no public solicitation).',
    legalNote:
      'TradeOps is a ledger/ops layer only — does not create or solicit the agreement.',
  },
  CAPITAL_SANDBOX_ENABLED: {
    key: 'CAPITAL_SANDBOX_ENABLED',
    defaultEnabled: true,
    category: 'sandbox',
    description:
      'Sandbox campaign design, budget modeling, and dry-run waterfall — no real capital movement.',
    legalNote: 'Sandbox only. Never labels sandbox data as live investment activity.',
  },
};

// Fix category type for MARKETPLACE — use legal_review_required style string that's in the union
// Actually I used 'provider_blocked' which isn't in the union. Fix GATE_META category type.

export function isFinancialGateEnabled(key: FinancialGateKey): boolean {
  const meta = GATE_META[key];
  // Explicit env wins; otherwise default
  if (process.env[key] !== undefined) {
    return envTruthy(key);
  }
  // Sandbox defaults on; everything else defaults off
  return meta.defaultEnabled;
}

export function getFinancialGate(key: FinancialGateKey): FinancialGateState {
  const meta = GATE_META[key];
  return {
    ...meta,
    enabled: isFinancialGateEnabled(key),
  };
}

export function listFinancialGates(): FinancialGateState[] {
  return (Object.keys(GATE_META) as FinancialGateKey[]).map(getFinancialGate);
}

export function assertFinancialGate(key: FinancialGateKey): void {
  if (!isFinancialGateEnabled(key)) {
    const g = getFinancialGate(key);
    const err = new Error(
      `Financial feature disabled: ${key}. ${g.legalNote} Set ${key}=true only after legal/provider approval.`,
    );
    (err as Error & { code: string }).code = 'FINANCIAL_GATE_DISABLED';
    throw err;
  }
}

/** Whether any capital-writing path may run (sandbox, private ledger, or full network). */
export function capitalWriteMode():
  | 'disabled'
  | 'sandbox'
  | 'private_agreement'
  | 'network' {
  if (isFinancialGateEnabled('CAPITAL_NETWORK_ENABLED')) return 'network';
  if (isFinancialGateEnabled('PRIVATE_AGREEMENT_LEDGER_ENABLED')) return 'private_agreement';
  if (isFinancialGateEnabled('CAPITAL_SANDBOX_ENABLED')) return 'sandbox';
  return 'disabled';
}

export function financialDomainCatalog() {
  return {
    domains: [
      {
        id: 'saas_billing',
        name: 'TradeOps SaaS Billing',
        status: 'operational',
        description: 'Organizations pay TradeOps for subscriptions and usage (Stripe Billing).',
      },
      {
        id: 'commerce_payments',
        name: 'Channel / marketplace commerce payments',
        status: 'operational_foundations',
        description:
          'Shopper payments on channels; normalized records, refunds, payouts, reconciliation. Not client operating capital.',
      },
      {
        id: 'platform_marketplace_payments',
        name: 'Platform marketplace payments (Connect)',
        status: isFinancialGateEnabled('MARKETPLACE_CONNECT_ENABLED')
          ? 'enabled'
          : 'architected_disabled',
        description:
          'Connected merchant/supplier accounts, split payments, platform fees — not investment custody.',
      },
      {
        id: 'client_operating_capital',
        name: 'Client-owned commerce operating capital',
        status: capitalWriteMode(),
        description:
          'Client funds their own commerce budget under CommerceMandate. Not pooled investing. Partner custody required for live funds.',
      },
      {
        id: 'supplier_service_payments',
        name: 'Supplier and service-provider payments',
        status: 'architected',
        description: 'Controlled disbursements within mandate — prefer direct supplier pay.',
      },
      {
        id: 'settlements_client_payouts',
        name: 'Marketplace settlements and client payouts',
        status: 'architected',
        description: 'Settlement → reconcile → withdrawable proceeds → partner payout only.',
      },
    ],
    gates: listFinancialGates(),
    honesty: {
      note: 'Primary product: AI Commerce Operating System (SaaS intelligence + execution). Merchant owns stores and processors. Not a securities portal or pooled fund. Capital modules are optional/deferred.',
    },
  };
}
