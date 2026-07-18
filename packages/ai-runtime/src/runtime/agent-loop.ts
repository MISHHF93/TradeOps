/**
 * Two-stage Cohere agent loop:
 * Phase A — tool selection (model chooses tools; TradeOps executes)
 * Phase B — structured synthesis (schema-constrained final response)
 */

import { getAiPlatformConfig } from '@tradeops/config';
import { invokeCapability, suggestCapabilitiesForObjective } from '../capability-executor';
import { listCapabilitiesPublic } from '../capability-catalog';
import { requirePrompt } from '../prompts/registry';
import { resolveAIProvider } from '../provider/resolve-provider';
import {
  SYNTHESIS_JSON_SCHEMA,
  validateSynthesisPayload,
  type CanonicalEvidence,
  type IntentCategory,
  type InformationMode,
  type ProposedAction,
  type TradeOpsCanonicalResponse,
} from '../schemas/base-response';
import {
  classifyInformationNeed,
  runSearchManager,
  type InformationNeed,
} from '../search-manager';
import { redactSecrets } from '../telemetry/redaction';

export type AgentLoopRequest = {
  message: string;
  tenantId: string;
  userId?: string;
  conversationId?: string;
  workspaceId?: string;
  permissions?: string[];
  operationalContext?: Record<string, unknown>;
  knowledgeDocuments?: Array<{
    id: string;
    title: string;
    body: string;
    sourceType?: string;
    provider?: string;
    url?: string;
  }>;
  requestedArtifactType?: string;
  disableSearch?: boolean;
  locale?: string;
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapNeedToMode(need: InformationNeed): InformationMode {
  switch (need) {
    case 'no_search':
      return 'no_search';
    case 'authenticated_operational_data':
      return 'authenticated_operational';
    case 'official_documentation':
      return 'official_documentation';
    case 'social_signal':
    case 'current_news':
    case 'public_web':
    case 'product_discovery':
    case 'supplier_discovery':
      return 'public_web';
    case 'mixed_research':
      return 'mixed_research';
    default:
      return 'no_search';
  }
}

function mapNeedToCategory(need: InformationNeed, message: string): IntentCategory {
  if (/^hi\b|^hello\b|^hey\b/i.test(message.trim())) return 'general';
  switch (need) {
    case 'product_discovery':
      return 'product_discovery';
    case 'supplier_discovery':
      return 'supplier_discovery';
    case 'authenticated_operational_data':
      if (/payment|refund|revenue|stripe/i.test(message)) return 'payments';
      if (/ship|logistics|carrier/i.test(message)) return 'logistics';
      return 'commerce';
    case 'public_web':
    case 'current_news':
    case 'social_signal':
      return 'research';
    case 'mixed_research':
      return 'mixed';
    default:
      return 'general';
  }
}

function isGreeting(message: string): boolean {
  return /^(hi|hello|hey|good (morning|afternoon|evening))[\s!.]*$/i.test(message.trim());
}

/**
 * Run the full TradeOps Cohere agent runtime for one user message.
 */
export async function runCohereAgentLoop(
  input: AgentLoopRequest,
): Promise<TradeOpsCanonicalResponse> {
  const t0 = Date.now();
  const platform = getAiPlatformConfig();
  const provider = resolveAIProvider();
  const prompt = requirePrompt('tradeops-system');
  const requestId = newId('req');
  const conversationId = input.conversationId ?? newId('conv');
  const warnings: string[] = [];
  const toolsInvoked: string[] = [];
  const evidence: CanonicalEvidence[] = [];
  const actions: ProposedAction[] = [];
  const toolResults: Array<{ tool: string; ok: boolean; data: unknown }> = [];

  if (!input.tenantId) {
    return failEnvelope(input, requestId, conversationId, 'Tenant context required.', 'AITenantRequired');
  }

  if (!provider.configured) {
    return failEnvelope(
      input,
      requestId,
      conversationId,
      'AI provider is not configured. Set COHERE_API_KEY in server environment (never in the browser).',
      'AINotConfigured',
      provider.id,
    );
  }

  const need = classifyInformationNeed(input.message);
  let informationMode = mapNeedToMode(need);
  let category = mapNeedToCategory(need, input.message);

  // Greetings: short-circuit without tools/search
  if (isGreeting(input.message)) {
    const synth = await provider.generateStructured({
      system: prompt.text,
      user: `User said: ${input.message}\nRespond as a brief greeting only. JSON with short text, artifactType=answer, empty artifact {}, confidence=1, objectiveTitle=Greeting, objectiveDescription=Acknowledge user, successCriteria=[], intentCategory=general, informationMode=no_search, warnings=[].`,
      schema: SYNTHESIS_JSON_SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'tradeops_synthesis',
      temperature: 0.2,
      maxTokens: 400,
    });
    const validated = validateSynthesisPayload(synth.value ?? {});
    if (synth.ok && validated.ok && validated.value) {
      return buildEnvelope({
        input,
        requestId,
        conversationId,
        status: 'completed',
        category: 'general',
        informationMode: 'no_search',
        synthesis: validated.value,
        evidence: [],
        actions: [],
        warnings: [],
        provider: provider.id,
        model: synth.model,
        prompt,
        toolsInvoked: [],
        latencyMs: Date.now() - t0,
      });
    }
  }

  // --- Phase A: tools + search ---
  const maxRounds = Math.min(
    Number(process.env.AI_MAX_TOOL_ROUNDS) || platform.aiMaxToolCalls || 8,
    8,
  );

  // Suggest tools heuristically then let model refine
  const suggested = suggestCapabilitiesForObjective(input.message);
  const catalog = listCapabilitiesPublic().filter((c) => !c.write);

  const selection = await provider.selectTools({
    system: prompt.text,
    user: [
      `Tenant-scoped objective: ${input.message}`,
      `Information need: ${need}`,
      `Suggested tools: ${suggested.join(', ') || 'none'}`,
      `Permissions: ${(input.permissions ?? ['*']).join(', ')}`,
      'Select tools needed for evidence. Prefer authenticated operational tools for inventory/orders/payments.',
    ].join('\n'),
    tools: catalog.map((c) => ({
      name: c.name,
      description: c.description,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          dateFrom: { type: 'string' },
          dateTo: { type: 'string' },
        },
      },
    })),
  });

  const calls =
    selection.ok && selection.calls.length
      ? selection.calls.slice(0, maxRounds)
      : suggested.slice(0, 4).map((name) => ({
          name,
          arguments: { query: input.message, objective: input.message },
        }));

  for (const call of calls) {
    // Skip research web when operational-only or search disabled
    if (
      call.name.startsWith('research.') &&
      (input.disableSearch || need === 'authenticated_operational_data' || need === 'no_search')
    ) {
      continue;
    }
    toolsInvoked.push(call.name);
    const result = await invokeCapability({
      capability: call.name,
      parameters: { ...call.arguments, query: input.message, objective: input.message },
      tenantId: input.tenantId,
      operationalContext: input.operationalContext,
    });
    toolResults.push({ tool: call.name, ok: result.ok, data: result.data });
    warnings.push(...result.warnings.map(redactSecrets));
    for (const e of result.evidence) {
      evidence.push({
        id: newId('ev'),
        sourceType: e.sourceType === 'x' ? 'social' : (e.sourceType as CanonicalEvidence['sourceType']),
        provider: e.provider,
        title: e.title ?? e.provider,
        uri: e.url,
        excerpt: e.snippet,
        retrievedAt: e.retrievedAt,
        freshness: e.freshness === 'cached' ? 'cached' : e.freshness === 'live' ? 'live' : 'unknown',
        authority:
          e.sourceType === 'connector' || e.sourceType === 'database'
            ? 'first_party'
            : e.sourceType === 'x'
              ? 'social'
              : 'general_web',
      });
    }
    for (const a of result.actions) {
      actions.push({
        actionId: a.actionId,
        capability: a.capability,
        description: `Proposed ${a.capability}`,
        status: a.status === 'awaiting_approval' ? 'awaiting_approval' : 'recommended',
        riskLevel: a.requiresApproval ? 'high' : 'medium',
        requiresApproval: a.requiresApproval,
        parameters: Object.entries(a.parameters).map(([name, value]) => ({
          name,
          value: String(value),
        })),
      });
    }
  }

  // Search manager: internal retrieval + optional public web
  const wantsPublic =
    !input.disableSearch &&
    need !== 'no_search' &&
    need !== 'authenticated_operational_data';

  const webSearchEnabled =
    process.env.WEB_SEARCH_ENABLED === 'true' ||
    process.env.WEB_SEARCH_ENABLED === '1' ||
    platform.openaiWebSearchEnabled ||
    platform.tavilyConfigured;

  if (wantsPublic && !webSearchEnabled && !input.knowledgeDocuments?.length) {
    warnings.push(
      'Public web search is not configured (WEB_SEARCH_ENABLED=false and no search provider keys). Cannot invent external sources.',
    );
    informationMode = 'no_search';
  }

  if (input.knowledgeDocuments?.length || (wantsPublic && webSearchEnabled)) {
    toolsInvoked.push('search.manager');
    const search = await runSearchManager({
      objective: input.message,
      internalDocuments: input.knowledgeDocuments,
      internalOnly: !wantsPublic || !webSearchEnabled,
      policy: wantsPublic && webSearchEnabled ? undefined : { allowed: false },
    });
    warnings.push(...search.warnings.map(redactSecrets));
    for (const e of search.evidence) {
      evidence.push({
        id: newId('ev'),
        sourceType: e.sourceType === 'x' ? 'social' : (e.sourceType as CanonicalEvidence['sourceType']),
        provider: e.provider,
        title: e.title ?? e.provider,
        uri: e.url,
        excerpt: e.snippet,
        retrievedAt: e.retrievedAt,
        freshness: e.freshness === 'live' ? 'live' : e.freshness === 'cached' ? 'cached' : 'unknown',
        authority: e.provider === 'cohere' ? 'tenant_owned' : 'general_web',
      });
    }
    if (search.evidence.some((e) => e.provider === 'cohere' || e.provider === 'local_lexical')) {
      if (informationMode === 'no_search') informationMode = 'internal_retrieval';
      if (informationMode === 'public_web') informationMode = 'mixed_research';
    }
  }

  // Blocked public research with no evidence
  if (
    wantsPublic &&
    !webSearchEnabled &&
    evidence.length === 0 &&
    /trend|market|competitor|news|find current/i.test(input.message)
  ) {
    return buildEnvelope({
      input,
      requestId,
      conversationId,
      status: 'blocked',
      category,
      informationMode: 'public_web',
      synthesis: {
        text: 'I cannot look up current public information because web search is not configured on this server. No sources were invented. Enable WEB_SEARCH_ENABLED and a search provider, or attach internal knowledge documents.',
        artifactType: 'answer',
        artifact: { blockedReason: 'public_search_not_configured' },
        confidence: 0.9,
        objectiveTitle: 'Public research blocked',
        objectiveDescription: input.message,
        successCriteria: [],
        intentCategory: category,
        informationMode: 'public_web',
        warnings: warnings.slice(),
      },
      evidence: [],
      actions: [],
      warnings,
      provider: provider.id,
      model: undefined,
      prompt,
      toolsInvoked,
      latencyMs: Date.now() - t0,
    });
  }

  // --- Phase B: structured synthesis ---
  const synthesisUser = [
    `User objective: ${input.message}`,
    `Intent category hint: ${category}`,
    `Information mode hint: ${informationMode}`,
    '',
    'Tool results (verified by TradeOps — do not invent additional operational facts):',
    JSON.stringify(toolResults).slice(0, 8000),
    '',
    'Evidence:',
    evidence
      .slice(0, 16)
      .map((e) => `- [${e.sourceType}/${e.provider}] ${e.title} ${e.uri ?? ''} ${e.excerpt ?? ''}`)
      .join('\n') || '(none)',
    '',
    'Warnings:',
    warnings.join('; ') || '(none)',
    '',
    'Return structured JSON for the TradeOps synthesis schema.',
    'If write actions are appropriate, put them in proposedActions with requiresApproval=true.',
    'Never claim actions completed.',
  ].join('\n');

  let synthesisResult = await provider.generateStructured({
    system: prompt.text,
    user: synthesisUser,
    schema: SYNTHESIS_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: 'tradeops_synthesis',
    temperature: 0.2,
    maxTokens: Number(process.env.COHERE_MAX_TOKENS) || 4000,
  });

  let validated = validateSynthesisPayload(synthesisResult.value);

  // One repair attempt
  if (!validated.ok && synthesisResult.rawText) {
    warnings.push(...validated.errors.map((e) => `schema: ${e}`));
    synthesisResult = await provider.generateStructured({
      system: prompt.text,
      user: [
        synthesisUser,
        '',
        'Previous output failed validation:',
        validated.errors.join('; '),
        'Previous raw (truncated):',
        (synthesisResult.rawText ?? '').slice(0, 1500),
        'Fix and return valid JSON only.',
      ].join('\n'),
      schema: SYNTHESIS_JSON_SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'tradeops_synthesis',
      temperature: 0,
      maxTokens: 4000,
    });
    validated = validateSynthesisPayload(synthesisResult.value);
  }

  if (!validated.ok || !validated.value) {
    return buildEnvelope({
      input,
      requestId,
      conversationId,
      status: 'failed',
      category,
      informationMode,
      synthesis: {
        text: redactSecrets(
          synthesisResult.rawText?.slice(0, 2000) ||
            `Structured synthesis failed: ${validated.errors.join('; ') || synthesisResult.error || 'unknown'}`,
        ),
        artifactType: 'answer',
        artifact: { errors: validated.errors, code: synthesisResult.code },
        confidence: 0,
        objectiveTitle: 'Synthesis failed',
        objectiveDescription: input.message,
        successCriteria: [],
        intentCategory: category,
        informationMode,
        warnings: [...warnings, ...validated.errors],
      },
      evidence,
      actions,
      warnings: [...warnings, ...validated.errors],
      provider: provider.id,
      model: synthesisResult.model,
      prompt,
      toolsInvoked,
      latencyMs: Date.now() - t0,
    });
  }

  // Merge proposed actions from model
  for (const pa of validated.value.proposedActions ?? []) {
    actions.push({
      actionId: newId('action'),
      capability: pa.capability,
      description: pa.description,
      status: pa.requiresApproval ? 'awaiting_approval' : 'recommended',
      riskLevel: pa.riskLevel,
      requiresApproval: pa.requiresApproval || platform.aiRequireApprovalForWrites,
      parameters: pa.parameters ?? [],
    });
  }

  return buildEnvelope({
    input,
    requestId,
    conversationId,
    status: warnings.length && evidence.length === 0 ? 'partial' : 'completed',
    category: validated.value.intentCategory || category,
    informationMode: validated.value.informationMode || informationMode,
    synthesis: validated.value,
    evidence,
    actions,
    warnings: [...warnings, ...validated.value.warnings],
    provider: provider.id,
    model: synthesisResult.model,
    prompt,
    toolsInvoked,
    latencyMs: Date.now() - t0,
  });
}

function failEnvelope(
  input: AgentLoopRequest,
  requestId: string,
  conversationId: string,
  text: string,
  code: string,
  provider = 'none',
): TradeOpsCanonicalResponse {
  return {
    schemaVersion: '1.0.0',
    requestId,
    tenantId: input.tenantId || 'unknown',
    workspaceId: input.workspaceId,
    conversationId,
    status: 'failed',
    intent: {
      category: 'general',
      informationMode: 'no_search',
      language: input.locale ?? 'en',
      requiresLiveData: false,
    },
    objective: {
      title: 'Request failed',
      description: input.message,
      successCriteria: [],
    },
    output: {
      text,
      artifactType: 'answer',
      artifact: { code },
    },
    evidence: [],
    actions: [],
    warnings: [code],
    confidence: 0,
    generatedAt: new Date().toISOString(),
    meta: { provider },
  };
}

function buildEnvelope(args: {
  input: AgentLoopRequest;
  requestId: string;
  conversationId: string;
  status: TradeOpsCanonicalResponse['status'];
  category: IntentCategory;
  informationMode: InformationMode;
  synthesis: {
    text: string;
    artifactType: TradeOpsCanonicalResponse['output']['artifactType'];
    artifact: Record<string, unknown>;
    confidence: number;
    objectiveTitle: string;
    objectiveDescription: string;
    successCriteria: string[];
    intentCategory: IntentCategory;
    informationMode: InformationMode;
    warnings: string[];
  };
  evidence: CanonicalEvidence[];
  actions: ProposedAction[];
  warnings: string[];
  provider: string;
  model?: string;
  prompt: { id: string; version: string };
  toolsInvoked: string[];
  latencyMs: number;
}): TradeOpsCanonicalResponse {
  const s = args.synthesis;
  return {
    schemaVersion: '1.0.0',
    requestId: args.requestId,
    tenantId: args.input.tenantId,
    workspaceId: args.input.workspaceId,
    conversationId: args.conversationId,
    status: args.status,
    intent: {
      category: args.category,
      informationMode: args.informationMode,
      language: args.input.locale ?? 'en',
      requiresLiveData: args.informationMode !== 'no_search',
    },
    objective: {
      title: s.objectiveTitle,
      description: s.objectiveDescription,
      successCriteria: s.successCriteria,
    },
    output: {
      text: redactSecrets(s.text),
      artifactType: s.artifactType,
      artifact: s.artifact,
    },
    evidence: args.evidence,
    actions: args.actions,
    warnings: args.warnings.map(redactSecrets),
    confidence: Math.min(1, Math.max(0, s.confidence)),
    generatedAt: new Date().toISOString(),
    meta: {
      provider: args.provider,
      model: args.model,
      promptId: args.prompt.id,
      promptVersion: args.prompt.version,
      toolsInvoked: args.toolsInvoked,
      latencyMs: args.latencyMs,
    },
  };
}
