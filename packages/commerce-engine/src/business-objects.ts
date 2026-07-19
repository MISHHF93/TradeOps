/**
 * Canonical first-class business objects for the Commerce Operating System.
 *
 * One Platform · One Workspace · One Commerce Case · One Source of Truth.
 * Pages are views; objects are the system of record.
 */

import type { CommerceStage } from './commerce-lifecycle';

/** Stable object types owned by TradeOps (not vendor-specific). */
export const BUSINESS_OBJECT_TYPES = [
  'commerce_case',
  'product',
  'supplier',
  'marketplace',
  'listing',
  'order',
  'shipment',
  'payment',
  'customer',
  'workflow_run',
  'ai_artifact',
  'ai_run',
  'connector',
  'document',
  'signal',
  'opportunity',
  'approval',
] as const;

export type BusinessObjectType = (typeof BUSINESS_OBJECT_TYPES)[number];

export type ObjectOwnership = {
  organizationId: string;
  /** System role permissions that may read this object class */
  readPermissions: string[];
  /** System role permissions that may mutate this object class */
  writePermissions: string[];
  /** Primary persona for operating this object */
  primaryPersona:
    | 'executive'
    | 'operator'
    | 'researcher'
    | 'analyst'
    | 'developer'
    | 'administrator';
};

/** Static ownership catalog — enforced by API guards; persona steers UX. */
export const OBJECT_OWNERSHIP: Record<BusinessObjectType, Omit<ObjectOwnership, 'organizationId'>> =
  {
    commerce_case: {
      readPermissions: ['products:read'],
      writePermissions: ['products:write'],
      primaryPersona: 'operator',
    },
    product: {
      readPermissions: ['products:read'],
      writePermissions: ['products:write'],
      primaryPersona: 'researcher',
    },
    supplier: {
      readPermissions: ['products:read'],
      writePermissions: ['products:write'],
      primaryPersona: 'operator',
    },
    marketplace: {
      readPermissions: ['connectors:read'],
      writePermissions: ['connectors:write'],
      primaryPersona: 'developer',
    },
    listing: {
      readPermissions: ['products:read'],
      writePermissions: ['products:write'],
      primaryPersona: 'operator',
    },
    order: {
      readPermissions: ['orders:read'],
      writePermissions: ['orders:write'],
      primaryPersona: 'operator',
    },
    shipment: {
      readPermissions: ['orders:read'],
      writePermissions: ['orders:write'],
      primaryPersona: 'operator',
    },
    payment: {
      readPermissions: ['orders:read'],
      writePermissions: ['orders:write'],
      primaryPersona: 'operator',
    },
    customer: {
      readPermissions: ['analytics:read'],
      writePermissions: ['org:write'],
      primaryPersona: 'analyst',
    },
    workflow_run: {
      readPermissions: ['ai:read'],
      writePermissions: ['ai:write'],
      primaryPersona: 'developer',
    },
    ai_artifact: {
      readPermissions: ['products:read', 'ai:read'],
      writePermissions: ['ai:write'],
      primaryPersona: 'researcher',
    },
    ai_run: {
      readPermissions: ['ai:read'],
      writePermissions: ['ai:write'],
      primaryPersona: 'operator',
    },
    connector: {
      readPermissions: ['connectors:read'],
      writePermissions: ['connectors:write'],
      primaryPersona: 'developer',
    },
    document: {
      readPermissions: ['products:read'],
      writePermissions: ['products:write'],
      primaryPersona: 'researcher',
    },
    signal: {
      readPermissions: ['analytics:read'],
      writePermissions: ['analytics:read'],
      primaryPersona: 'analyst',
    },
    opportunity: {
      readPermissions: ['analytics:read', 'products:read'],
      writePermissions: ['products:write'],
      primaryPersona: 'researcher',
    },
    approval: {
      readPermissions: ['products:read'],
      writePermissions: ['products:write'],
      primaryPersona: 'executive',
    },
  };

/**
 * Workspace sections for an object — each object is its own operating surface.
 * Section ids are stable for UI deep-links (?section=).
 */
export type ObjectWorkspaceSectionId =
  | 'overview'
  | 'lifecycle'
  | 'research'
  | 'suppliers'
  | 'pricing'
  | 'media'
  | 'ai'
  | 'opportunities'
  | 'listings'
  | 'inventory'
  | 'orders'
  | 'shipments'
  | 'payments'
  | 'customers'
  | 'documents'
  | 'signals'
  | 'analytics'
  | 'approvals'
  | 'connectors'
  | 'workflows'
  | 'history'
  | 'relationships'
  | 'next_action';

export type ObjectWorkspaceSection = {
  id: ObjectWorkspaceSectionId;
  label: string;
  description: string;
  /** Commerce stages where this section is most relevant */
  stages?: CommerceStage[];
  /** Preferred AI tools for this section */
  aiTools?: string[];
};

/** Commerce Case is the hub — every other object hangs off it. */
export const COMMERCE_CASE_SECTIONS: ObjectWorkspaceSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Case identity, stage, blockers, and recommended next action.',
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    description: 'Discover → closed process spine for this opportunity.',
  },
  {
    id: 'next_action',
    label: 'Next action',
    description: 'Single procedural step the operator or AI should take.',
  },
  {
    id: 'research',
    label: 'Research',
    description: 'Product attributes, demand, policy, and confidence.',
    stages: ['discover', 'evaluate', 'qualify'],
    aiTools: ['searchConnectedProducts', 'scoreOpportunity', 'assessPolicyRisk'],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    description: 'Offers, costs, reliability, and sourcing options.',
    stages: ['evaluate', 'source'],
    aiTools: ['listConnectorCapabilities'],
  },
  {
    id: 'pricing',
    label: 'Pricing & economics',
    description: 'Contribution profit, fees, and margin floors.',
    stages: ['evaluate', 'prepare', 'reconcile'],
    aiTools: ['calculateContributionProfit'],
  },
  {
    id: 'media',
    label: 'Media & artifacts',
    description: 'Images, documents, channel readiness.',
    stages: ['prepare', 'publish'],
  },
  {
    id: 'opportunities',
    label: 'Opportunity',
    description: 'Score, signal, and explainability.',
    stages: ['evaluate', 'qualify'],
    aiTools: ['scoreOpportunity'],
  },
  {
    id: 'listings',
    label: 'Listings',
    description: 'Drafts, approvals, and published channel listings.',
    stages: ['prepare', 'approve', 'publish'],
    aiTools: ['draftListing'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'ATP, stock, and oversell risk.',
    stages: ['publish', 'sell', 'source'],
  },
  {
    id: 'orders',
    label: 'Orders',
    description: 'Customer orders linked to this product/case.',
    stages: ['sell', 'source', 'fulfill'],
    aiTools: ['inspectOrderPayment'],
  },
  {
    id: 'shipments',
    label: 'Shipments',
    description: 'Fulfillment and tracking.',
    stages: ['fulfill'],
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Channel payments, payouts, reconciliation.',
    stages: ['reconcile'],
    aiTools: ['inspectOrderPayment', 'inspectPayout', 'explainPaymentVariance'],
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'Objective context, recommendations, and runs for this case.',
    aiTools: ['searchConnectedProducts', 'scoreOpportunity', 'draftListing'],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    description: 'Consequential gates for publish, PO, and refunds.',
    stages: ['approve', 'source'],
  },
  {
    id: 'signals',
    label: 'Signals',
    description: 'Commerce signals and learning outcomes.',
    stages: ['learn', 'evaluate'],
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Specs, compliance, and attachments.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Forecasts, outcomes, and realized vs predicted.',
    stages: ['learn', 'reconcile'],
    aiTools: ['evaluatePredictionOutcome'],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    description: 'Automation runs touching this case.',
  },
  {
    id: 'connectors',
    label: 'Connectors',
    description: 'Providers involved in discovery, publish, or fulfillment.',
    aiTools: ['listConnectorCapabilities'],
  },
  {
    id: 'relationships',
    label: 'Graph',
    description: 'Knowledge-graph edges for AI and operators.',
  },
  {
    id: 'history',
    label: 'History',
    description: 'Stage history, audits, and events.',
  },
];

export type BusinessObjectRef = {
  type: BusinessObjectType;
  id: string;
  label: string;
  href: string;
  /** Provenance / fixture honesty */
  isFixture?: boolean;
  sourcePlatform?: string | null;
};

export function objectHref(type: BusinessObjectType, id: string): string {
  switch (type) {
    case 'commerce_case':
      return `/terminal/process/${id}`;
    case 'product':
      return `/terminal/products/${id}`;
    case 'order':
      return `/terminal/orders`;
    case 'listing':
      return `/terminal/listings`;
    case 'payment':
      return `/terminal/finance/payments`;
    case 'approval':
      return `/terminal/approvals`;
    case 'ai_run':
      return `/terminal/objectives/${id}`;
    case 'connector':
      return `/terminal/connectors`;
    case 'workflow_run':
      return `/terminal/objectives/${id}`;
    case 'signal':
      return `/terminal/signals`;
    case 'opportunity':
      return `/terminal/opportunities`;
    default:
      return `/terminal/process`;
  }
}
