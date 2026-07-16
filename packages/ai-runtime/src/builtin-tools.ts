import {
  assessProductPolicy,
  calculateUnitEconomics,
  scoreOpportunity,
} from '@tradeops/commerce-engine';
import { listLiveFeeds } from '@tradeops/connector-core';
import { registerTool } from './tool-registry';
import type { OperationLoopMode } from './types';

const ALL_LOOPS: OperationLoopMode[] = [
  'fixture',
  'development',
  'shadow',
  'controlled_live',
  'automated_live',
];

let registered = false;

/**
 * Register read-only / draft tools. Host may override via deps.
 * Safe to call once at API boot.
 */
export function registerBuiltinTools(): void {
  if (registered) return;
  registered = true;

  registerTool({
    name: 'listConnectorCapabilities',
    description: 'List live-feed registry entries and fixture labels (no secrets).',
    inputSchema: { type: 'object', properties: {} },
    requiredPermissions: ['connectors:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 5_000,
    idempotent: true,
    execute: async () => ({
      feeds: listLiveFeeds().map((f) => ({
        providerKey: f.providerKey,
        displayName: f.displayName,
        isFixture: f.isFixture,
        authMode: f.authMode,
        capabilities: f.capabilities,
        weekendAutomation: f.weekendAutomation,
      })),
      note: 'Registry describes official APIs. Live use requires authorization.',
    }),
  });

  registerTool({
    name: 'searchConnectedProducts',
    description: 'Search organization products already in the canonical store.',
    inputSchema: {
      type: 'object',
      properties: {
        filters: { type: 'object', description: 'Optional structured filters' },
        limit: { type: 'number' },
      },
    },
    requiredPermissions: ['products:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 30_000,
    idempotent: true,
    execute: async (input, ctx) => {
      const search = ctx.deps.searchProducts as
        | ((args: { organizationId: string; limit?: number }) => Promise<unknown>)
        | undefined;
      if (!search) {
        return { products: [], note: 'Host did not inject searchProducts dependency' };
      }
      const products = await search({
        organizationId: ctx.organizationId,
        limit: Number((input as { limit?: number }).limit ?? 50),
      });
      return { products, filters: (input as { filters?: unknown }).filters ?? null };
    },
  });

  registerTool({
    name: 'calculateContributionProfit',
    description: 'Contribution profit calculator — revenue is never profit.',
    inputSchema: {
      type: 'object',
      properties: {
        sellingPriceMinor: { type: 'number' },
        marketplaceFeeMinor: { type: 'number' },
        paymentFeeMinor: { type: 'number' },
        supplierCostMinor: { type: 'number' },
        shippingCostMinor: { type: 'number' },
        advertisingAllocationMinor: { type: 'number' },
        returnReserveMinor: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['sellingPriceMinor', 'supplierCostMinor'],
    },
    requiredPermissions: ['analytics:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 5_000,
    idempotent: true,
    execute: async (input) => {
      const i = input as Record<string, unknown>;
      return calculateUnitEconomics({
        sellingPriceMinor: Number(i.sellingPriceMinor ?? 0),
        marketplaceFeeMinor: Number(i.marketplaceFeeMinor ?? 0),
        paymentFeeMinor: Number(i.paymentFeeMinor ?? 0),
        supplierCostMinor: Number(i.supplierCostMinor ?? 0),
        shippingCostMinor: Number(i.shippingCostMinor ?? 0),
        advertisingAllocationMinor: Number(i.advertisingAllocationMinor ?? 0),
        returnReserveMinor: Number(i.returnReserveMinor ?? 0),
        currency: String(i.currency ?? 'USD'),
      });
    },
  });

  registerTool({
    name: 'assessPolicyRisk',
    description: 'Fail-closed product policy gate.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['title'],
    },
    requiredPermissions: ['products:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 5_000,
    idempotent: true,
    execute: async (input) => {
      const i = input as Record<string, unknown>;
      return assessProductPolicy({
        title: String(i.title ?? ''),
        description: i.description != null ? String(i.description) : undefined,
        category: i.category != null ? String(i.category) : undefined,
      });
    },
  });

  registerTool({
    name: 'scoreOpportunity',
    description: 'Explainable 0–100 opportunity score.',
    inputSchema: {
      type: 'object',
      properties: {
        demandPotential: { type: 'number' },
        netMarginPotential: { type: 'number' },
        policyBlocked: { type: 'boolean' },
      },
    },
    requiredPermissions: ['analytics:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 5_000,
    idempotent: true,
    execute: async (input) => {
      const i = input as Record<string, unknown>;
      return scoreOpportunity({
        demandPotential: Number(i.demandPotential ?? 50),
        trendMomentum: Number(i.trendMomentum ?? 50),
        netMarginPotential: Number(i.netMarginPotential ?? 50),
        supplierQuality: Number(i.supplierQuality ?? 50),
        shippingReliability: Number(i.shippingReliability ?? 50),
        reviewHealth: Number(i.reviewHealth ?? 50),
        competition: Number(i.competition ?? 50),
        returnRisk: Number(i.returnRisk ?? 50),
        policyRisk: Number(i.policyRisk ?? 20),
        capitalRequirement: Number(i.capitalRequirement ?? 40),
        dataConfidence: Number(i.dataConfidence ?? 70),
        policyBlocked: Boolean(i.policyBlocked),
      });
    },
  });

  registerTool({
    name: 'draftListing',
    description: 'Draft a marketplace listing locally — does not publish externally.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['productId'],
    },
    requiredPermissions: ['products:write', 'ai:write'],
    risk: {
      actionClass: 'draft',
      approvalRequired: false,
      allowedInLoopModes: ['development', 'shadow', 'controlled_live', 'fixture'],
    },
    timeoutMs: 10_000,
    idempotent: true,
    execute: async (input, ctx) => {
      const draft = ctx.deps.draftListing as
        | ((args: {
            organizationId: string;
            productId: string;
            userId?: string | null;
          }) => Promise<unknown>)
        | undefined;
      const productId = String((input as { productId: string }).productId);
      if (draft) {
        return draft({
          organizationId: ctx.organizationId,
          productId,
          userId: ctx.userId,
        });
      }
      return {
        status: 'draft_local',
        productId,
        title: (input as { title?: string }).title ?? null,
        note: 'Local draft only — host did not inject listing writer; no external publish.',
      };
    },
  });

  registerTool({
    name: 'evaluatePredictionOutcome',
    description: 'Evaluate forecast vs outcomes for model improvement evidence.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    requiredPermissions: ['analytics:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 30_000,
    idempotent: true,
    execute: async (_input, ctx) => {
      const evaluate = ctx.deps.evaluateOutcomes as
        | ((args: { organizationId: string }) => Promise<unknown>)
        | undefined;
      if (!evaluate) {
        return { note: 'Host did not inject evaluateOutcomes' };
      }
      return evaluate({ organizationId: ctx.organizationId });
    },
  });
}
