/**
 * TradeOps AI Gateway — single entry for the frontend.
 *
 * User → Gateway → AI Adapter (OpenAI primary) → Search Manager / Capability Gateway
 *              → verified text + JSON envelope
 *
 * The frontend never selects a vendor model or search API.
 */

import {
  aiPlatformPublicStatus,
  getAiPlatformConfig,
} from '@tradeops/config';
import { getAiAdapter, listAiAdaptersPublic } from './ai-adapter';
import {
  invokeCapability,
  suggestCapabilitiesForObjective,
  type CapabilityInvokeResult,
} from './capability-executor';
import { listCapabilitiesPublic } from './capability-catalog';
import {
  buildEnvelope,
  validateObjectivePayload,
  type TradeOpsAIResponse,
  type TradeOpsAiAction,
  type TradeOpsEvidence,
  GATEWAY_OBJECTIVE_JSON_SCHEMA,
} from './response-envelope';
import {
  classifyInformationNeed,
  rankAndDeduplicateEvidence,
  runSearchManager,
} from './search-manager';

export type AiGatewayRequest = {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  objective: string;
  operationalContext?: Record<string, unknown>;
  disableSearch?: boolean;
  maxCapabilityInvocations?: number;
};

export type AiGatewayResult = TradeOpsAIResponse<Record<string, unknown>>;

function systemPrompt(): string {
  return [
    'You are TradeOps AI — the single AI Operator for a commerce + industrial OS.',
    'You reason for TradeOps; do not claim a specific model brand unless asked.',
    'Rules:',
    '1. Operational facts (inventory, orders, payments, shipments) come ONLY from authenticated connector/database context — never invent them from web search.',
    '2. Public web/social evidence is for market research only and must be cited.',
    '3. Prefer structured JSON matching the required schema. Also write clear human text.',
    '4. Recommend write actions with requiresApproval=true; never claim execution without approval.',
    '5. Be honest about missing credentials or missing data.',
    '6. Rank confidence lower when evidence is weak, social-only, or operational data is missing.',
    'Respond with a single JSON object only (no markdown fences) containing:',
    'text, objective, recommendations[], confidence, sources[]',
    'Each recommendation: title, reason, score (0-1), optional product, estimatedDemand, estimatedMarginPercent, risk.',
  ].join('\n');
}

function buildUserMessage(
  input: AiGatewayRequest,
  evidence: TradeOpsEvidence[],
  need: string,
  capabilityResults: CapabilityInvokeResult[],
): string {
  const parts = [
    `Objective: ${input.objective}`,
    `Information need classification: ${need}`,
    '',
    'Evidence (ranked by source trust — not all operational truth):',
  ];
  if (evidence.length === 0) {
    parts.push('(none retrieved — answer from general knowledge + operational context only)');
  } else {
    for (const e of evidence.slice(0, 16)) {
      parts.push(
        `- [${e.sourceType}/${e.provider}] ${e.title ?? ''} ${e.url ?? ''} ${e.snippet ?? ''}`.trim(),
      );
    }
  }
  if (capabilityResults.length) {
    parts.push('');
    parts.push('Capability gateway results (normalized tools):');
    for (const r of capabilityResults.slice(0, 8)) {
      parts.push(
        `- ${r.capability} ok=${r.ok} class=${r.informationClass}: ${JSON.stringify(r.data).slice(0, 800)}`,
      );
    }
  }
  if (input.operationalContext && Object.keys(input.operationalContext).length) {
    parts.push('');
    parts.push('Authenticated operational context (tenant-scoped):');
    parts.push(JSON.stringify(input.operationalContext).slice(0, 6000));
  }
  parts.push('');
  parts.push('Return JSON only.');
  return parts.join('\n');
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Run the unified AI gateway for one objective.
 */
export async function runAiGateway(input: AiGatewayRequest): Promise<AiGatewayResult> {
  const platform = getAiPlatformConfig();
  const adapter = getAiAdapter();
  const warnings: string[] = [];
  const toolsInvoked: string[] = [];
  const actions: TradeOpsAiAction[] = [];
  let evidence: TradeOpsEvidence[] = [];
  const capabilityResults: CapabilityInvokeResult[] = [];

  const metaBase = {
    schemaVersion: platform.outputSchemaVersion,
    aiProvider: adapter.id,
    model: adapter.model,
  } as const;

  if (!input.tenantId) {
    return buildEnvelope({
      tenantId: 'unknown',
      conversationId: input.conversationId,
      text: 'Tenant context required.',
      json: { error: 'tenant_required' },
      status: 'failed',
      confidence: 0,
      warnings: ['tenantId required'],
      meta: metaBase,
    });
  }

  const need = classifyInformationNeed(input.objective);
  let searchUsed = false;

  // 1) Capability pre-pass
  const suggested = suggestCapabilitiesForObjective(input.objective);
  const maxCaps = Math.min(
    input.maxCapabilityInvocations ?? 4,
    platform.aiMaxToolCalls,
    6,
  );
  for (const name of suggested.slice(0, maxCaps)) {
    if (
      name.startsWith('research.') &&
      (input.disableSearch || need === 'authenticated_operational_data' || need === 'no_search')
    ) {
      continue;
    }
    toolsInvoked.push(name);
    const result = await invokeCapability({
      capability: name,
      parameters: { query: input.objective, objective: input.objective },
      tenantId: input.tenantId,
      operationalContext: input.operationalContext,
    });
    capabilityResults.push(result);
    evidence.push(...result.evidence);
    warnings.push(...result.warnings);
    actions.push(...result.actions);
  }

  // 2) Search Manager
  const researchAlready = toolsInvoked.some((t) => t.startsWith('research.'));
  if (
    !input.disableSearch &&
    need !== 'no_search' &&
    need !== 'authenticated_operational_data' &&
    !researchAlready
  ) {
    toolsInvoked.push('research.web_search');
    const search = await runSearchManager({ objective: input.objective });
    evidence.push(...search.evidence);
    warnings.push(...search.warnings);
    searchUsed = search.evidence.some(
      (e) =>
        e.provider === 'tavily' ||
        e.provider === 'openai_web' ||
        e.provider.startsWith('xai'),
    );
  } else if (need === 'authenticated_operational_data') {
    warnings.push(
      'Classified as operational — public web search skipped; use connector data for inventory/orders/payments.',
    );
  } else if (researchAlready) {
    searchUsed = evidence.some((e) => e.sourceType === 'web' || e.sourceType === 'x');
  }

  evidence = rankAndDeduplicateEvidence(evidence);

  if (!adapter.configured) {
    const text =
      evidence.length > 0
        ? `AI runtime not configured. Retrieved ${evidence.length} public source(s). Set OPENAI_API_KEY (recommended) or XAI_API_KEY / AI_PROVIDER.`
        : 'AI runtime not configured. Set OPENAI_API_KEY for the primary OpenAI adapter (or AI_PROVIDER=xai with XAI_API_KEY). Capability tools and connectors still work.';
    return buildEnvelope({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      text,
      json: {
        objective: input.objective,
        recommendations: [],
        confidence: 0.2,
        sources: evidence.map((e) => ({
          provider: e.provider,
          sourceType: e.sourceType,
          url: e.url,
        })),
        informationNeed: need,
        capabilitiesInvoked: toolsInvoked,
      },
      status: 'partial',
      confidence: 0.2,
      evidence,
      actions,
      warnings: [...warnings, 'ai_runtime_not_configured'],
      meta: {
        ...metaBase,
        informationNeed: need,
        searchUsed,
        toolsInvoked,
      },
    });
  }

  const useStrictSchema =
    platform.structuredOutputEnabled &&
    platform.responseMode === 'json_schema' &&
    adapter.id === 'openai';

  const completion = await adapter.generate({
    system: systemPrompt(),
    user: buildUserMessage(input, evidence, need, capabilityResults),
    temperature: 0.3,
    maxTokens: 2000,
    jsonObject: platform.responseMode === 'json_object',
    jsonSchema: useStrictSchema
      ? {
          name: 'tradeops_objective_response',
          strict: true,
          schema: GATEWAY_OBJECTIVE_JSON_SCHEMA as unknown as Record<string, unknown>,
        }
      : undefined,
  });

  if (!completion.ok || !completion.text) {
    return buildEnvelope({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      text: `AI completion failed (${adapter.id}): ${completion.error ?? 'unknown'}`,
      json: {
        objective: input.objective,
        recommendations: [],
        confidence: 0,
        sources: evidence.map((e) => ({
          provider: e.provider,
          sourceType: e.sourceType,
          url: e.url,
        })),
        error: completion.error,
        capabilitiesInvoked: toolsInvoked,
      },
      status: 'failed',
      confidence: 0,
      evidence,
      actions,
      warnings: [...warnings, completion.error ?? 'completion_failed'],
      meta: {
        ...metaBase,
        model: completion.model ?? adapter.model,
        informationNeed: need,
        searchUsed,
        toolsInvoked,
      },
    });
  }

  const parsed = parseJsonLoose(completion.text);
  const validated = validateObjectivePayload(
    parsed && typeof parsed === 'object'
      ? {
          text: (parsed as { text?: string }).text ?? completion.text,
          ...(parsed as object),
        }
      : {
          text: completion.text,
          objective: input.objective,
          recommendations: [],
          confidence: 0.5,
          sources: evidence.map((e) => ({
            provider: e.provider,
            sourceType: e.sourceType,
            url: e.url,
          })),
        },
  );

  if (!validated.ok || !validated.value) {
    return buildEnvelope({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      text: completion.text.slice(0, 4000),
      json: {
        objective: input.objective,
        recommendations: [],
        confidence: 0.4,
        sources: evidence.map((e) => ({
          provider: e.provider,
          sourceType: e.sourceType,
          url: e.url,
        })),
        rawParseErrors: validated.errors,
        capabilitiesInvoked: toolsInvoked,
      },
      status: 'partial',
      confidence: 0.4,
      evidence,
      actions,
      warnings: [...warnings, ...validated.errors, 'structured_output_validation_partial'],
      meta: {
        ...metaBase,
        model: completion.model ?? adapter.model,
        informationNeed: need,
        searchUsed,
        toolsInvoked,
      },
    });
  }

  const v = validated.value;
  const sourceMap = new Map(
    v.sources.map((s) => [`${s.provider}:${s.url ?? s.sourceType}`, s]),
  );
  for (const e of evidence) {
    const k = `${e.provider}:${e.url ?? e.sourceType}`;
    if (!sourceMap.has(k)) {
      sourceMap.set(k, {
        provider: e.provider,
        sourceType: e.sourceType,
        url: e.url,
      });
    }
  }

  if (
    /supplier|rfq|procure|wholesale/i.test(input.objective) &&
    !actions.some((a) => a.capability === 'procurement.create_rfq')
  ) {
    actions.push({
      actionId: `action_rfq_${Date.now().toString(36)}`,
      capability: 'procurement.create_rfq',
      status: 'awaiting_approval',
      requiresApproval: true,
      parameters: { objective: input.objective },
    });
  }

  return buildEnvelope({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    text: v.text,
    json: {
      objective: v.objective,
      recommendations: v.recommendations,
      confidence: v.confidence,
      sources: [...sourceMap.values()],
      informationNeed: need,
      capabilitiesInvoked: toolsInvoked,
    },
    status: 'completed',
    confidence: Math.min(1, Math.max(0, v.confidence)),
    evidence,
    actions,
    warnings,
    meta: {
      ...metaBase,
      model: completion.model ?? adapter.model,
      informationNeed: need,
      searchUsed,
      toolsInvoked,
    },
  });
}

export function gatewayCatalogPublic() {
  return {
    platform: aiPlatformPublicStatus(),
    adapters: listAiAdaptersPublic(),
    capabilities: listCapabilitiesPublic(),
    responseSchema: GATEWAY_OBJECTIVE_JSON_SCHEMA,
    skills: [
      'research',
      'commerce',
      'payments',
      'logistics',
      'analytics',
      'procurement',
      'industrial',
    ],
    informationClasses: [
      'public_web',
      'social_signal',
      'authenticated_operational',
    ],
    note: 'User sees one TradeOps AI. Runtime is selected by AI Adapter (OpenAI primary). Search Manager + Capability Gateway are provider-agnostic. Operational truth uses connectors only.',
  };
}
