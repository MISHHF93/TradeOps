/**
 * TradeOps AI Gateway — legacy envelope helper.
 *
 * Production chat uses runCohereAgentLoop (canonical).
 * This gateway remains for older clients / live-examples and must still use
 * code-owned prompts (never Playground, never ad-hoc ownership by vendor).
 *
 * User → Gateway → AI Adapter → Search Manager / Capability Gateway
 *              → verified text + JSON envelope
 *
 * The frontend never selects a vendor model or search API.
 */

import {
  aiPlatformPublicStatus,
  getAiPlatformConfig,
} from '@tradeops/config';
import { getAiAdapter, listAiAdaptersPublic } from './ai-adapter';
import { requirePrompt } from './prompts/registry';
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
import { retrievalEnginePublicStatus } from './retrieval-engine';
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
  /**
   * Internal knowledge corpus for Cohere/enterprise retrieval
   * (products, manuals, RFQs, SOPs). Not invented by the model.
   */
  knowledgeDocuments?: Array<{
    id: string;
    title: string;
    body: string;
    sourceType?: string;
    provider?: string;
    url?: string;
  }>;
};

export type AiGatewayResult = TradeOpsAIResponse<Record<string, unknown>>;

function systemPrompt(): string {
  // Code-owned prompt registry — never Cohere Playground
  const system = requirePrompt('tradeops-system');
  const developer = requirePrompt('tradeops-developer');
  return [
    system.text,
    '',
    '--- Developer instructions ---',
    developer.text,
    '',
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

  // 2) Search Manager — internal Cohere retrieval + optional public web
  const researchAlready = toolsInvoked.some((t) => t.startsWith('research.'));
  const knowledgeDocs =
    input.knowledgeDocuments ??
    knowledgeFromOperationalContext(input.operationalContext);

  const wantsPublicSearch =
    !input.disableSearch &&
    need !== 'no_search' &&
    need !== 'authenticated_operational_data' &&
    !researchAlready;

  if (knowledgeDocs.length || wantsPublicSearch) {
    if (knowledgeDocs.length) toolsInvoked.push('retrieval.internal');
    if (wantsPublicSearch) toolsInvoked.push('research.web_search');
    const search = await runSearchManager({
      objective: input.objective,
      internalDocuments: knowledgeDocs,
      internalOnly: !wantsPublicSearch && knowledgeDocs.length > 0,
      policy: wantsPublicSearch ? undefined : { allowed: false },
    });
    evidence.push(...search.evidence);
    warnings.push(...search.warnings);
    searchUsed = search.evidence.some(
      (e) =>
        e.provider === 'tavily' ||
        e.provider === 'openai_web' ||
        e.provider === 'cohere' ||
        e.provider.startsWith('xai'),
    );
  } else if (need === 'authenticated_operational_data') {
    warnings.push(
      'Classified as operational — public web search skipped; use connector data for inventory/orders/payments. Pass knowledgeDocuments for Cohere catalog retrieval.',
    );
  } else if (researchAlready) {
    searchUsed = evidence.some((e) => e.sourceType === 'web' || e.sourceType === 'x');
  }

  evidence = rankAndDeduplicateEvidence(evidence);

  if (!adapter.configured) {
    // Truthful blocked — never return demo recommendations or fabricated success
    const text =
      'AI runtime is not configured. Set COHERE_API_KEY with AI_PROVIDER=cohere (production path) or the adapter key for the selected provider. No demo response was substituted.';
    return buildEnvelope({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      text,
      json: {
        objective: input.objective,
        recommendations: [],
        confidence: 0,
        error: 'AI_PROVIDER_NOT_CONFIGURED',
        requiredAction:
          'Set COHERE_API_KEY (and AI_PROVIDER=cohere) in server env; never use NEXT_PUBLIC_ for secrets.',
        sources: evidence.map((e) => ({
          provider: e.provider,
          sourceType: e.sourceType,
          url: e.url,
        })),
        informationNeed: need,
        capabilitiesInvoked: toolsInvoked,
        dataMode: 'unavailable',
      },
      status: 'blocked',
      confidence: 0,
      evidence,
      actions: [],
      warnings: [...warnings, 'AI_PROVIDER_NOT_CONFIGURED'],
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

function knowledgeFromOperationalContext(
  ctx?: Record<string, unknown>,
): Array<{
  id: string;
  title: string;
  body: string;
  sourceType?: string;
  provider?: string;
}> {
  if (!ctx) return [];
  const docs: Array<{
    id: string;
    title: string;
    body: string;
    sourceType?: string;
    provider?: string;
  }> = [];

  const products = ctx.products ?? ctx.catalog;
  if (Array.isArray(products)) {
    for (const [i, p] of products.entries()) {
      if (!p || typeof p !== 'object') continue;
      const row = p as Record<string, unknown>;
      const title = String(row.title ?? row.name ?? row.sku ?? `product_${i}`);
      docs.push({
        id: String(row.id ?? `product_${i}`),
        title,
        body: JSON.stringify(row).slice(0, 2000),
        sourceType: 'document',
        provider: 'catalog',
      });
    }
  }

  if (Array.isArray(ctx.knowledgeDocuments)) {
    for (const d of ctx.knowledgeDocuments) {
      if (!d || typeof d !== 'object') continue;
      const row = d as Record<string, unknown>;
      docs.push({
        id: String(row.id ?? docs.length),
        title: String(row.title ?? 'doc'),
        body: String(row.body ?? row.text ?? '').slice(0, 4000),
        sourceType: String(row.sourceType ?? 'document'),
        provider: String(row.provider ?? 'knowledge'),
      });
    }
  }

  return docs.slice(0, 64);
}

export function gatewayCatalogPublic() {
  return {
    owner: 'tradeops_source_code',
    productionEntrypoint: 'runCohereAgentLoop',
    platform: aiPlatformPublicStatus(),
    adapters: listAiAdaptersPublic(),
    retrieval: retrievalEnginePublicStatus(),
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
      'retrieval',
    ],
    informationClasses: [
      'public_web',
      'social_signal',
      'authenticated_operational',
      'enterprise_retrieval',
    ],
    note: 'One TradeOps AI owned in source. Production chat: runCohereAgentLoop → Cohere provider. Prompts/schemas/tools/policies are code registries — not Cohere Playground. Search Manager + Capability Gateway stay provider-agnostic. Operational truth uses connectors only.',
  };
}
