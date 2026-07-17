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
    description:
      'List connectors as business capabilities (discover products, publish listing, …) — not raw vendor endpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        requiredBusinessCapabilities: {
          type: 'string',
          description: 'Optional comma-separated business capability ids to rank providers',
        },
      },
    },
    requiredPermissions: ['connectors:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 15_000,
    idempotent: true,
    execute: async (input, ctx) => {
      const board = ctx.deps.ecosystemCapabilityBoard as
        | ((args: { organizationId: string }) => Promise<unknown>)
        | undefined;
      if (board) {
        const result = await board({ organizationId: ctx.organizationId });
        const reqRaw = (input as { requiredBusinessCapabilities?: string })
          .requiredBusinessCapabilities;
        if (reqRaw && typeof reqRaw === 'string' && reqRaw.trim()) {
          const select = ctx.deps.selectConnectorsForCapabilities as
            | ((args: {
                organizationId: string;
                required: string[];
              }) => Promise<unknown>)
            | undefined;
          if (select) {
            return {
              board: result,
              selection: await select({
                organizationId: ctx.organizationId,
                required: reqRaw.split(',').map((s) => s.trim()).filter(Boolean),
              }),
            };
          }
        }
        return result;
      }
      return {
        feeds: listLiveFeeds().map((f) => ({
          providerKey: f.providerKey,
          displayName: f.displayName,
          isFixture: f.isFixture,
          authMode: f.authMode,
          capabilities: f.capabilities,
          weekendAutomation: f.weekendAutomation,
        })),
        note: 'Host did not inject ecosystem board — registry only. Live use requires authorization.',
      };
    },
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

  // ——— Finance domain tools (inspect/explain free; consequential actions need approval) ———

  registerTool({
    name: 'getBillingStatus',
    description:
      'Read SaaS subscription/billing status for the active organization (not shopper payments).',
    inputSchema: { type: 'object', properties: {} },
    requiredPermissions: ['analytics:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 15_000,
    idempotent: true,
    execute: async (_input, ctx) => {
      const fn = ctx.deps.getBillingStatus as
        | ((args: { organizationId: string }) => Promise<unknown>)
        | undefined;
      if (!fn) return { note: 'Host did not inject getBillingStatus' };
      return fn({ organizationId: ctx.organizationId });
    },
  });

  registerTool({
    name: 'createBillingCheckout',
    description:
      'Start SaaS plan checkout (Stripe or dev fixture). Changes paid plan — requires approval.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        interval: { type: 'string', description: 'month | year' },
      },
      required: ['planId'],
    },
    requiredPermissions: ['org:write', 'ai:write'],
    risk: {
      actionClass: 'financial_contractual',
      approvalRequired: true,
      allowedInLoopModes: ['development', 'shadow', 'controlled_live', 'fixture'],
    },
    timeoutMs: 30_000,
    idempotent: false,
    execute: async (input, ctx) => {
      const fn = ctx.deps.createBillingCheckout as
        | ((args: {
            organizationId: string;
            userId?: string | null;
            planId: string;
            interval?: 'month' | 'year';
          }) => Promise<unknown>)
        | undefined;
      if (!fn) return { note: 'Host did not inject createBillingCheckout' };
      const i = input as { planId: string; interval?: 'month' | 'year' };
      return fn({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        planId: i.planId,
        interval: i.interval,
      });
    },
  });

  registerTool({
    name: 'openBillingPortal',
    description: 'Open customer billing portal session URL for the organization.',
    inputSchema: { type: 'object', properties: {} },
    requiredPermissions: ['org:write', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 15_000,
    idempotent: true,
    execute: async (_input, ctx) => {
      const fn = ctx.deps.openBillingPortal as
        | ((args: { organizationId: string; userId?: string | null }) => Promise<unknown>)
        | undefined;
      if (!fn) return { note: 'Host did not inject openBillingPortal' };
      return fn({ organizationId: ctx.organizationId, userId: ctx.userId });
    },
  });

  registerTool({
    name: 'inspectOrderPayment',
    description:
      'Inspect normalized commerce payment for an order (channel/shopper money — not SaaS billing).',
    inputSchema: {
      type: 'object',
      properties: {
        paymentId: { type: 'string' },
        orderId: { type: 'string' },
      },
    },
    requiredPermissions: ['orders:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 15_000,
    idempotent: true,
    execute: async (input, ctx) => {
      const fn = ctx.deps.inspectOrderPayment as
        | ((args: {
            organizationId: string;
            paymentId?: string;
            orderId?: string;
          }) => Promise<unknown>)
        | undefined;
      if (!fn) return { note: 'Host did not inject inspectOrderPayment' };
      const i = input as { paymentId?: string; orderId?: string };
      return fn({
        organizationId: ctx.organizationId,
        paymentId: i.paymentId,
        orderId: i.orderId,
      });
    },
  });

  registerTool({
    name: 'inspectPayout',
    description: 'Inspect marketplace/processor payouts and reconciliations for the org.',
    inputSchema: { type: 'object', properties: {} },
    requiredPermissions: ['orders:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 15_000,
    idempotent: true,
    execute: async (_input, ctx) => {
      const fn = ctx.deps.inspectPayout as
        | ((args: { organizationId: string }) => Promise<unknown>)
        | undefined;
      if (!fn) return { note: 'Host did not inject inspectPayout' };
      return fn({ organizationId: ctx.organizationId });
    },
  });

  registerTool({
    name: 'reconcilePayout',
    description: 'Run fixture/demo payout reconciliation (consequential financial close).',
    inputSchema: { type: 'object', properties: {} },
    requiredPermissions: ['orders:write', 'ai:write'],
    risk: {
      actionClass: 'financial_contractual',
      approvalRequired: true,
      allowedInLoopModes: ['development', 'shadow', 'fixture', 'controlled_live'],
    },
    timeoutMs: 30_000,
    idempotent: false,
    execute: async (_input, ctx) => {
      const fn = ctx.deps.reconcilePayout as
        | ((args: { organizationId: string; userId?: string | null }) => Promise<unknown>)
        | undefined;
      if (!fn) return { note: 'Host did not inject reconcilePayout' };
      return fn({ organizationId: ctx.organizationId, userId: ctx.userId });
    },
  });

  registerTool({
    name: 'explainPaymentVariance',
    description: 'Explain reconciliation variance using stored summary (read-only).',
    inputSchema: {
      type: 'object',
      properties: {
        reconciliationId: { type: 'string' },
      },
    },
    requiredPermissions: ['orders:read', 'ai:read'],
    risk: {
      actionClass: 'read_only',
      approvalRequired: false,
      allowedInLoopModes: ALL_LOOPS,
    },
    timeoutMs: 15_000,
    idempotent: true,
    execute: async (input, ctx) => {
      const fn = ctx.deps.explainPaymentVariance as
        | ((args: { organizationId: string; reconciliationId?: string }) => Promise<unknown>)
        | undefined;
      if (!fn) {
        return {
          note: 'Host did not inject explainPaymentVariance',
          guidance:
            'Variance = actual payout net − expected (gross − fees − refunds). Unmatched lines need settlement matching.',
        };
      }
      return fn({
        organizationId: ctx.organizationId,
        reconciliationId: (input as { reconciliationId?: string }).reconciliationId,
      });
    },
  });

  registerTool({
    name: 'prepareRefundAction',
    description:
      'Prepare a refund action draft — does not submit to channel without approval.',
    inputSchema: {
      type: 'object',
      properties: {
        commercePaymentId: { type: 'string' },
        amountMinor: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['commercePaymentId', 'amountMinor'],
    },
    requiredPermissions: ['orders:write', 'ai:write'],
    risk: {
      actionClass: 'financial_contractual',
      approvalRequired: true,
      allowedInLoopModes: ['development', 'shadow', 'controlled_live', 'fixture'],
    },
    timeoutMs: 15_000,
    idempotent: false,
    execute: async (input, ctx) => {
      const i = input as {
        commercePaymentId: string;
        amountMinor: number;
        reason?: string;
      };
      return {
        status: 'draft_requires_approval',
        action: 'channel_refund',
        organizationId: ctx.organizationId,
        commercePaymentId: i.commercePaymentId,
        amountMinor: i.amountMinor,
        reason: i.reason ?? null,
        note: 'Refund submission is consequential. Human approval required before channel API call.',
      };
    },
  });
}
