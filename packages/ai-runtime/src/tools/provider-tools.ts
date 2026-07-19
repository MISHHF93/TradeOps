/**
 * TradeOps-owned tool definitions for Cohere (and other providers).
 * Parameter schemas and approval policies come from source — not Playground.
 */

import { listCapabilitiesPublic, getCapability } from '../capability-catalog';
import { getToolPolicy, resolveApprovalRequired } from '../tool-policies';

export type ProviderToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema object for tool arguments */
  parameters: Record<string, unknown>;
  write: boolean;
  requiresApproval: boolean;
  informationClass: string;
  domain: string;
};

/**
 * Full tool catalog for model tool-selection (read tools by default).
 * Uses code-owned parameter schemas from tool-policies.
 */
export function listProviderTools(opts?: {
  includeWrites?: boolean;
}): ProviderToolDefinition[] {
  const includeWrites = opts?.includeWrites === true;
  return listCapabilitiesPublic()
    .filter((c) => includeWrites || !c.write)
    .map((c) => {
      const policy = getToolPolicy(c.name);
      const requiresApproval = resolveApprovalRequired(c.name);
      const approvalNote =
        c.write || requiresApproval ? ' [requires human approval before execution]' : '';
      return {
        name: c.name,
        description: `${c.description}${approvalNote}`,
        parameters: (policy?.parameterSchema ?? {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string' },
          },
        }) as Record<string, unknown>,
        write: c.write,
        requiresApproval,
        informationClass: c.informationClass,
        domain: c.domain,
      };
    });
}

/** Shape expected by AIProvider.selectTools */
export function providerToolsForSelect(opts?: { includeWrites?: boolean }) {
  return listProviderTools(opts).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function getProviderTool(name: string): ProviderToolDefinition | undefined {
  const cap = getCapability(name);
  if (!cap) return undefined;
  const policy = getToolPolicy(name);
  return {
    name: cap.name,
    description: cap.description,
    parameters: (policy?.parameterSchema ?? {
      type: 'object',
      properties: { query: { type: 'string' } },
    }) as Record<string, unknown>,
    write: cap.write,
    requiresApproval: resolveApprovalRequired(name),
    informationClass: cap.informationClass,
    domain: cap.domain,
  };
}

export function providerToolsPublic() {
  return {
    owner: 'tradeops_source_code',
    note: 'Tool definitions, parameter schemas, and approval policies are code-owned. Cohere Playground is not used.',
    tools: listProviderTools({ includeWrites: true }).map((t) => ({
      name: t.name,
      description: t.description,
      write: t.write,
      requiresApproval: t.requiresApproval,
      informationClass: t.informationClass,
      domain: t.domain,
      parameterSchema: t.parameters,
    })),
  };
}
