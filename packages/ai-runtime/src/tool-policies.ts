/**
 * Tool authorization & approval policies — owned by TradeOps source code.
 * Env flags may tighten gates; they never invent new write powers.
 */

import { getAiPlatformConfig } from '@tradeops/config';
import { getCapability, TRADEOPS_CAPABILITIES } from './capability-catalog';

export type ToolPolicy = {
  name: string;
  write: boolean;
  requiresApproval: boolean;
  informationClass: string;
  domain: string;
  /** JSON Schema for parameters (TradeOps-owned) */
  parameterSchema: Record<string, unknown>;
};

/** Shared parameter schema templates */
const QUERY_PARAMS: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', description: 'Search or filter query' },
    productId: { type: 'string' },
    orderId: { type: 'string' },
    dateFrom: { type: 'string', description: 'ISO date' },
    dateTo: { type: 'string', description: 'ISO date' },
    limit: { type: 'number' },
  },
};

const WRITE_PARAMS: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['reason'],
  properties: {
    reason: { type: 'string', description: 'Why this write is needed' },
    productId: { type: 'string' },
    quantity: { type: 'number' },
    channel: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string' },
  },
};

function parameterSchemaFor(name: string, write: boolean): Record<string, unknown> {
  if (write) return WRITE_PARAMS;
  if (name.startsWith('research.')) {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string' },
        url: { type: 'string' },
        maxResults: { type: 'number' },
      },
    };
  }
  return QUERY_PARAMS;
}

/**
 * Resolve effective approval requirement (capability default ∩ platform env).
 */
export function resolveApprovalRequired(capabilityName: string): boolean {
  const cap = getCapability(capabilityName);
  if (!cap) return true; // unknown → fail closed
  if (!cap.write) return false;
  const platform = getAiPlatformConfig();
  if (platform.aiRequireApprovalForWrites) return true;
  if (
    /refund|payment|checkout/i.test(capabilityName) &&
    platform.aiRequireApprovalForPayments
  ) {
    return true;
  }
  if (/refund/i.test(capabilityName) && platform.aiRequireApprovalForRefunds) {
    return true;
  }
  if (/publish|listing/i.test(capabilityName) && platform.aiRequireApprovalForPublishing) {
    return true;
  }
  return cap.requiresApproval;
}

export function listToolPolicies(): ToolPolicy[] {
  return TRADEOPS_CAPABILITIES.map((c) => ({
    name: c.name,
    write: c.write,
    requiresApproval: resolveApprovalRequired(c.name),
    informationClass: c.informationClass,
    domain: c.domain,
    parameterSchema: parameterSchemaFor(c.name, c.write),
  }));
}

export function getToolPolicy(name: string): ToolPolicy | undefined {
  return listToolPolicies().find((p) => p.name === name);
}

export function toolPoliciesPublic() {
  return {
    owner: 'tradeops_source_code',
    note: 'Approval and parameter schemas are code-defined. Cohere Playground is not used.',
    policies: listToolPolicies().map((p) => ({
      name: p.name,
      write: p.write,
      requiresApproval: p.requiresApproval,
      informationClass: p.informationClass,
      domain: p.domain,
      parameterSchema: p.parameterSchema,
    })),
  };
}
