/**
 * Capability packs and plan entitlements — server-side source of truth.
 * Do not enforce only in the UI.
 */

export type CustomerSegment = 'individual' | 'smb' | 'agency' | 'enterprise';
export type PlanTier = 'starter' | 'growth' | 'agency' | 'business' | 'enterprise' | 'evaluation';
export type WorkspacePersona =
  | 'founder'
  | 'operator'
  | 'analyst'
  | 'procurement'
  | 'finance'
  | 'executive'
  | 'agency'
  | 'auditor'
  /** Primary operating personas (Commerce OS) */
  | 'researcher'
  | 'developer'
  | 'administrator';

export type CapabilityPackId =
  | 'commerce_starter'
  | 'multichannel_operations'
  | 'ai_intelligence'
  | 'supplier_procurement'
  | 'enterprise_governance'
  | 'agency_console';

export type EntitlementLimits = {
  maxStores: number;
  maxConnectors: number;
  maxProducts: number;
  maxTeamSeats: number;
  maxAiEvaluationsPerMonth: number;
  maxWorkflowRunsPerMonth: number;
  maxClientOrgs: number;
  packs: CapabilityPackId[];
};

const PACKS: Record<CapabilityPackId, { name: string; description: string }> = {
  commerce_starter: {
    name: 'Commerce Starter',
    description: 'One store path, scanner, profit, manual listings, order tracking.',
  },
  multichannel_operations: {
    name: 'Multichannel Operations',
    description: 'Multiple channels, inventory, routing, reconciliation.',
  },
  ai_intelligence: {
    name: 'AI Intelligence',
    description: 'Forecasting, scoring, signals, AI operator.',
  },
  supplier_procurement: {
    name: 'Supplier and Procurement',
    description: 'Supplier comparison, PO approvals, scorecards.',
  },
  enterprise_governance: {
    name: 'Enterprise Governance',
    description: 'SSO, custom roles, audit exports, retention (planned depth).',
  },
  agency_console: {
    name: 'Agency Console',
    description: 'Multi-client orgs, delegated access, usage reporting.',
  },
};

export function listCapabilityPacks() {
  return (Object.keys(PACKS) as CapabilityPackId[]).map((id) => ({ id, ...PACKS[id] }));
}

export function entitlementsForPlan(plan: PlanTier): EntitlementLimits {
  switch (plan) {
    case 'evaluation':
      return {
        maxStores: 1,
        maxConnectors: 2,
        maxProducts: 100,
        maxTeamSeats: 2,
        maxAiEvaluationsPerMonth: 50,
        maxWorkflowRunsPerMonth: 30,
        maxClientOrgs: 0,
        packs: ['commerce_starter', 'ai_intelligence'],
      };
    case 'starter':
      return {
        maxStores: 1,
        maxConnectors: 2,
        maxProducts: 500,
        maxTeamSeats: 1,
        maxAiEvaluationsPerMonth: 200,
        maxWorkflowRunsPerMonth: 100,
        maxClientOrgs: 0,
        packs: ['commerce_starter', 'ai_intelligence'],
      };
    case 'growth':
      return {
        maxStores: 5,
        maxConnectors: 8,
        maxProducts: 5000,
        maxTeamSeats: 10,
        maxAiEvaluationsPerMonth: 2000,
        maxWorkflowRunsPerMonth: 1000,
        maxClientOrgs: 0,
        packs: [
          'commerce_starter',
          'multichannel_operations',
          'ai_intelligence',
          'supplier_procurement',
        ],
      };
    case 'agency':
      return {
        maxStores: 50,
        maxConnectors: 50,
        maxProducts: 50000,
        maxTeamSeats: 25,
        maxAiEvaluationsPerMonth: 10000,
        maxWorkflowRunsPerMonth: 5000,
        maxClientOrgs: 25,
        packs: [
          'commerce_starter',
          'multichannel_operations',
          'ai_intelligence',
          'supplier_procurement',
          'agency_console',
        ],
      };
    case 'business':
      return {
        maxStores: 20,
        maxConnectors: 30,
        maxProducts: 25000,
        maxTeamSeats: 50,
        maxAiEvaluationsPerMonth: 20000,
        maxWorkflowRunsPerMonth: 10000,
        maxClientOrgs: 0,
        packs: [
          'commerce_starter',
          'multichannel_operations',
          'ai_intelligence',
          'supplier_procurement',
        ],
      };
    case 'enterprise':
      return {
        maxStores: 1000,
        maxConnectors: 1000,
        maxProducts: 1_000_000,
        maxTeamSeats: 1000,
        maxAiEvaluationsPerMonth: 1_000_000,
        maxWorkflowRunsPerMonth: 1_000_000,
        maxClientOrgs: 1000,
        packs: [
          'commerce_starter',
          'multichannel_operations',
          'ai_intelligence',
          'supplier_procurement',
          'enterprise_governance',
          'agency_console',
        ],
      };
    default:
      return entitlementsForPlan('evaluation');
  }
}

export function hasPack(plan: PlanTier, pack: CapabilityPackId): boolean {
  return entitlementsForPlan(plan).packs.includes(pack);
}

export function defaultPersonaForSegment(segment: CustomerSegment): WorkspacePersona {
  switch (segment) {
    case 'agency':
      return 'agency';
    case 'enterprise':
      return 'executive';
    case 'smb':
      return 'operator';
    default:
      return 'founder';
  }
}

export function defaultPlanForSegment(segment: CustomerSegment): PlanTier {
  switch (segment) {
    case 'agency':
      return 'agency';
    case 'enterprise':
      return 'enterprise';
    case 'smb':
      return 'growth';
    default:
      return 'evaluation';
  }
}

export function assertWithinQuota(
  limits: EntitlementLimits,
  metric: keyof Pick<
    EntitlementLimits,
    | 'maxStores'
    | 'maxConnectors'
    | 'maxProducts'
    | 'maxTeamSeats'
    | 'maxAiEvaluationsPerMonth'
    | 'maxWorkflowRunsPerMonth'
    | 'maxClientOrgs'
  >,
  current: number,
): { ok: boolean; limit: number; current: number; remaining: number } {
  const limit = limits[metric];
  const remaining = Math.max(0, limit - current);
  return { ok: current < limit, limit, current, remaining };
}

export type { EntitlementLimits as Entitlements };
