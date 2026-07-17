/**
 * TradeOps AI Gateway — single entry for the frontend.
 * User → Gateway → Grok → tools/search/capabilities → validated text+JSON envelope.
 */

import {
  aiPlatformPublicStatus,
  getAiPlatformConfig,
  getXaiConfig,
} from '@tradeops/config';
import { completeWithXai } from './llm-client';
import { listCapabilitiesPublic } from './capability-catalog';
import {
  buildEnvelope,
  validateObjectivePayload,
  type TradeOpsAIResponse,
  type TradeOpsAiAction,
  type TradeOpsEvidence,
  GATEWAY_OBJECTIVE_JSON_SCHEMA,
} from './response-envelope';
import { classifyInformationNeed, runSearchManager } from './search-manager';

export type AiGatewayRequest = {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  objective: string;
  /** Optional tenant operational context (orders, inventory summaries) — never invented */
  operationalContext?: Record<string, unknown>;
  /** Force skip public search */
  disableSearch?: boolean;
};

export type AiGatewayResult = TradeOpsAIResponse<Record<string, unknown>>;

function systemPrompt(): string {
  return [
    'You are TradeOps AI — the single AI Operator for a commerce + industrial OS.',
    'You are powered by xAI Grok only. Do not claim to be other model brands.',
    'Rules:',
    '1. Operational facts (inventory, orders, payments, shipments) come ONLY from authenticated connector/database context provided in the user message — never invent them from web search.',
    '2. Public web/social evidence is for market research only and must be cited.',
    '3. Prefer structured JSON matching the required schema. Also write clear human text.',
    '4. Recommend write actions with requiresApproval=true; never claim execution without approval.',
    '5. Be honest about missing credentials or missing data.',
    'Respond with a single JSON object only (no markdown fences) containing:',
    'text, objective, recommendations[], confidence, sources[]',
  ].join('\n');
}

function buildUserMessage(input: AiGatewayRequest, evidence: TradeOpsEvidence[], need: string): string {
  const parts = [
    `Objective: ${input.objective}`,
    `Information need classification: ${need}`,
    '',
    'Evidence (public research — not operational truth):',
  ];
  if (evidence.length === 0) {
    parts.push('(none retrieved — answer from general knowledge + operational context only)');
  } else {
    for (const e of evidence.slice(0, 12)) {
      parts.push(
        `- [${e.sourceType}/${e.provider}] ${e.title ?? ''} ${e.url ?? ''} ${e.snippet ?? ''}`.trim(),
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
  const xai = getXaiConfig();
  const warnings: string[] = [];
  const toolsInvoked: string[] = [];

  if (!input.tenantId) {
    return buildEnvelope({
      tenantId: 'unknown',
      conversationId: input.conversationId,
      text: 'Tenant context required.',
      json: { error: 'tenant_required' },
      status: 'failed',
      confidence: 0,
      warnings: ['tenantId required'],
      meta: { schemaVersion: platform.outputSchemaVersion, aiProvider: 'xai' },
    });
  }

  const need = classifyInformationNeed(input.objective);
  let evidence: TradeOpsEvidence[] = [];
  let searchUsed = false;

  if (!input.disableSearch && need !== 'no_search' && need !== 'authenticated_operational_data') {
    toolsInvoked.push('research.web_search');
    const search = await runSearchManager({ objective: input.objective });
    evidence = search.evidence;
    warnings.push(...search.warnings);
    searchUsed = search.evidence.some((e) => e.provider === 'tavily' || e.provider.startsWith('xai'));
  } else if (need === 'authenticated_operational_data') {
    warnings.push(
      'Classified as operational — public web search skipped; use connector data for inventory/orders/payments.',
    );
  }

  if (!xai.apiKey || !xai.configured) {
    // Tools-only fallback envelope without free-form Grok
    const text =
      evidence.length > 0
        ? `xAI is not configured or unfunded. Retrieved ${evidence.length} public source(s). Add XAI credits at console.x.ai and set XAI_API_KEY for Grok synthesis.`
        : 'xAI is not configured. Set XAI_API_KEY and fund the xAI team for Grok orchestration. Local tools and RAG still work elsewhere.';
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
      },
      status: 'partial',
      confidence: 0.2,
      evidence,
      actions: [],
      warnings: [...warnings, 'xai_not_available'],
      meta: {
        schemaVersion: platform.outputSchemaVersion,
        aiProvider: 'xai',
        informationNeed: need,
        searchUsed,
        toolsInvoked,
      },
    });
  }

  const completion = await completeWithXai({
    system: systemPrompt(),
    user: buildUserMessage(input, evidence, need),
    temperature: 0.3,
    maxTokens: 1800,
    model: platform.xaiModel || xai.chatModel,
  });

  if (!completion.ok || !completion.text) {
    return buildEnvelope({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      text:
        completion.error?.includes('403') || completion.error?.includes('credit')
          ? 'xAI returned permission denied (often missing team credits). Fund the team at console.x.ai. Public evidence may still be listed in json.sources when Tavily is configured.'
          : `Grok completion failed: ${completion.error ?? 'unknown'}`,
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
      },
      status: 'failed',
      confidence: 0,
      evidence,
      warnings: [...warnings, completion.error ?? 'completion_failed'],
      meta: {
        schemaVersion: platform.outputSchemaVersion,
        aiProvider: 'xai',
        model: completion.model,
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
      },
      status: 'partial',
      confidence: 0.4,
      evidence,
      warnings: [...warnings, ...validated.errors, 'structured_output_validation_partial'],
      meta: {
        schemaVersion: platform.outputSchemaVersion,
        aiProvider: 'xai',
        model: completion.model,
        informationNeed: need,
        searchUsed,
        toolsInvoked,
      },
    });
  }

  const v = validated.value;
  // Merge search evidence into sources if model omitted them
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

  const actions: TradeOpsAiAction[] = [];
  // Suggest RFQ when discovery-like objective
  if (/supplier|rfq|procure|wholesale/i.test(input.objective)) {
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
    },
    status: 'completed',
    confidence: Math.min(1, Math.max(0, v.confidence)),
    evidence,
    actions,
    warnings,
    meta: {
      schemaVersion: platform.outputSchemaVersion,
      aiProvider: 'xai',
      model: completion.model,
      informationNeed: need,
      searchUsed,
      toolsInvoked,
    },
  });
}

export function gatewayCatalogPublic() {
  return {
    platform: aiPlatformPublicStatus(),
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
    note: 'User sees one TradeOps AI. Skills and tools are internal. Operational truth uses connectors; public web uses Tavily/xAI search only.',
  };
}
