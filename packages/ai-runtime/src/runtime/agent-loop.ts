/**
 * Two-stage Cohere agent loop:
 * Phase A — tool selection (model chooses tools; TradeOps executes)
 * Phase B — structured synthesis (schema-constrained final response)
 */

import { getAiPlatformConfig } from '@tradeops/config';
import { planAgentsForObjective, AGENT_CATALOG } from '../agent-orchestration';
import { invokeCapability, suggestCapabilitiesForObjective } from '../capability-executor';
import { requirePrompt } from '../prompts/registry';
import { resolveAIProvider } from '../provider/resolve-provider';
import { providerToolsForSelect } from '../tools/provider-tools';
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
import {
  blockedReasonForMissingProvider,
  buildProvenance,
  getSimulationPolicy,
  type DataMode,
} from '../runtime-provenance';

export type AgentLoopRequest = {
  message: string;
  tenantId: string;
  userId?: string;
  conversationId?: string;
  workspaceId?: string;
  permissions?: string[];
  /** Prior turns for multi-turn prompt execution (user/assistant only). */
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
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
  const history = (input.history ?? [])
    .filter((h) => h.content?.trim() && (h.role === 'user' || h.role === 'assistant'))
    .slice(-12);
  const warnings: string[] = [];
  const toolsInvoked: string[] = [];
  const evidence: CanonicalEvidence[] = [];
  const actions: ProposedAction[] = [];
  const toolResults: Array<{ tool: string; ok: boolean; data: unknown }> = [];

  const simPolicy = getSimulationPolicy();
  if (simPolicy.productionSimulationRejected) {
    return failEnvelope(
      input,
      requestId,
      conversationId,
      'Simulation mode is not allowed in production without TRADEOPS_ALLOW_PRODUCTION_SIMULATION=1.',
      'SIMULATION_NOT_ALLOWED_IN_PRODUCTION',
      'none',
      'blocked',
      'unavailable',
    );
  }
  if (!simPolicy.aiRuntimeEnabled) {
    return failEnvelope(
      input,
      requestId,
      conversationId,
      'AI runtime is disabled (AI_RUNTIME_ENABLED=false).',
      'AI_RUNTIME_DISABLED',
      'none',
      'blocked',
      'unavailable',
    );
  }

  if (!input.tenantId) {
    return failEnvelope(
      input,
      requestId,
      conversationId,
      'Tenant context required.',
      'AI_TENANT_REQUIRED',
      'none',
      'blocked',
      'unavailable',
    );
  }

  if (!provider.configured) {
    const br = blockedReasonForMissingProvider(provider.id || 'cohere');
    return failEnvelope(
      input,
      requestId,
      conversationId,
      `${br.message} ${br.requiredAction}`,
      br.errorCode,
      provider.id,
      'blocked',
      'unavailable',
      br.requiredAction,
    );
  }

  const need = classifyInformationNeed(input.message);
  let informationMode = mapNeedToMode(need);
  let category = mapNeedToCategory(need, input.message);
  const agentPlan = planAgentsForObjective(input.message);
  const developer = requirePrompt('tradeops-developer');
  const taskPromptId =
    category === 'research' || category === 'product_discovery' || category === 'supplier_discovery'
      ? 'task-research'
      : category === 'procurement'
        ? 'task-procurement'
        : category === 'commerce' || category === 'payments' || category === 'logistics'
          ? 'task-operational'
          : need === 'authenticated_operational_data'
            ? 'task-operational'
            : null;
  const taskPrompt = taskPromptId ? requirePrompt(taskPromptId) : null;
  const composedSystem = [
    prompt.text,
    '',
    '--- Developer instructions ---',
    developer.text,
    taskPrompt ? `\n--- Task instructions (${taskPrompt.id}@${taskPrompt.version}) ---\n${taskPrompt.text}` : '',
    '',
    `Agent plan: primary=${agentPlan.primary}; roles=${agentPlan.roles.join(',')}`,
    agentPlan.rationale,
  ]
    .filter(Boolean)
    .join('\n');

  // Greetings: real Cohere text (not a canned static string). Use free-form chat
  // then wrap into the canonical envelope — full JSON schema is overkill for "hi".
  if (isGreeting(input.message)) {
    const gen = await provider.generateText({
      system: [
        composedSystem,
        '',
        'The user is greeting you. Reply in 1–3 short sentences.',
        'Be warm and professional. Offer help with products, inventory, listings, or research.',
        'Do not invent inventory, orders, shipments, or metrics.',
        'Do not claim tools ran. Do not paste the system policy back to the user.',
      ].join('\n'),
      user: input.message,
      history,
      temperature: 0.5,
      maxTokens: 220,
    });
    if (!gen.ok || !gen.text?.trim()) {
      return failEnvelope(
        input,
        requestId,
        conversationId,
        gen.error ?? 'Cohere failed to generate a greeting.',
        gen.code ?? 'AI_PROVIDER_FAILED',
        provider.id,
        'failed',
        'unavailable',
      );
    }
    return buildEnvelope({
      input,
      requestId,
      conversationId,
      status: 'completed',
      dataMode: simPolicy.simulationEnabled ? 'simulation' : 'live',
      category: 'general',
      informationMode: 'no_search',
      synthesis: {
        text: gen.text.trim(),
        artifactType: 'answer',
        artifact: {
          nlu: {
            intent: 'greeting',
            category: 'general',
            informationMode: 'no_search',
            requiresTools: false,
          },
        },
        confidence: 1,
        objectiveTitle: 'Greeting',
        objectiveDescription: 'Acknowledge the user and offer operational help',
        successCriteria: ['User is greeted', 'No fabricated operational data'],
        intentCategory: 'general',
        informationMode: 'no_search',
        warnings: [],
      },
      evidence: [],
      actions: [],
      warnings: simPolicy.simulationEnabled ? ['SIMULATION_MODE'] : [],
      provider: provider.id,
      model: gen.model,
      prompt,
      toolsInvoked: [],
      latencyMs: Date.now() - t0,
    });
  }

  // --- Phase A: tools + search ---
  const maxRounds = Math.min(
    Number(process.env.AI_MAX_TOOL_ROUNDS) || platform.aiMaxToolCalls || 8,
    8,
  );

  // Suggest tools heuristically then let model refine using code-owned tool catalog
  const suggested = suggestCapabilitiesForObjective(input.message);
  // Prefer agent-role tools when orchestration selected a specialist
  const roleTools =
    AGENT_CATALOG.find((a) => a.id === agentPlan.primary)?.preferredTools ?? [];
  const providerTools = providerToolsForSelect({ includeWrites: false });

  const selection = await provider.selectTools({
    system: composedSystem,
    user: [
      `Tenant-scoped objective: ${input.message}`,
      `Information need: ${need}`,
      `Agent primary: ${agentPlan.primary}; roles=${agentPlan.roles.join(',')}`,
      `Preferred tools for role: ${roleTools.join(', ') || 'none'}`,
      `Suggested tools: ${suggested.join(', ') || 'none'}`,
      `Permissions: ${(input.permissions ?? ['*']).join(', ')}`,
      'Select tools needed for evidence. Prefer authenticated operational tools for inventory/orders/payments.',
      'Parameter schemas are TradeOps-owned — do not invent tool names outside the catalog.',
      'If the user only greets or asks a definitional question, return {"calls":[]}.',
    ].join('\n'),
    tools: providerTools,
  });

  // Prefer model tool selection. Only force heuristic tools when the model failed
  // AND the information need actually requires tools (never force tools for pure Q&A).
  const calls =
    selection.ok && selection.calls.length
      ? selection.calls.slice(0, maxRounds)
      : need !== 'no_search' && suggested.length
        ? suggested.slice(0, 4).map((name) => ({
            name,
            arguments: { query: input.message, objective: input.message },
          }))
        : [];

  // Free-form / definitional / canary: skip schema synthesis — use live generateText.
  // (Structured schema often rejects short free-form with "artifact required".)
  if (need === 'no_search' && calls.length === 0 && !input.knowledgeDocuments?.length) {
    const gen = await provider.generateText({
      system: [
        composedSystem,
        '',
        'Answer the user directly in clear language.',
        'Do not invent inventory, orders, shipments, or marketplace metrics.',
        'Do not claim tools ran. Do not paste the system policy.',
        'If the user asks for an exact phrase or format, follow it when safe.',
      ].join('\n'),
      user: input.message,
      history,
      temperature: 0.4,
      maxTokens: Number(process.env.COHERE_MAX_TOKENS) || 2000,
    });
    if (!gen.ok || !gen.text?.trim()) {
      return failEnvelope(
        input,
        requestId,
        conversationId,
        gen.error ?? 'Cohere free-form generation failed.',
        gen.code ?? 'AI_PROVIDER_FAILED',
        provider.id,
        'failed',
        'unavailable',
      );
    }
    return buildEnvelope({
      input,
      requestId,
      conversationId,
      status: 'completed',
      dataMode: simPolicy.simulationEnabled ? 'simulation' : 'live',
      category,
      informationMode: 'no_search',
      synthesis: {
        text: gen.text.trim(),
        artifactType: 'answer',
        artifact: { nlu: { path: 'freeform_generateText', need } },
        confidence: 0.85,
        objectiveTitle:
          input.message.length > 80 ? `${input.message.slice(0, 77)}…` : input.message,
        objectiveDescription: input.message,
        successCriteria: ['Answered without inventing operational facts'],
        intentCategory: category,
        informationMode: 'no_search',
        warnings: [],
      },
      evidence: [],
      actions: [],
      warnings: simPolicy.simulationEnabled ? ['SIMULATION_MODE'] : [],
      provider: provider.id,
      model: gen.model,
      prompt,
      toolsInvoked: [],
      latencyMs: Date.now() - t0,
    });
  }

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

  // Master switch WEB_SEARCH_ENABLED must be on AND at least one adapter key present.
  // Never invent public citations when search is off or unconfigured.
  const searchAdapterReady =
    (platform.openaiWebSearchEnabled && platform.openaiConfigured) ||
    platform.tavilyConfigured ||
    (platform.xaiWebSearchEnabled && platform.xaiConfigured);
  const webSearchEnabled = platform.webSearchEnabled && searchAdapterReady;

  if (wantsPublic && !webSearchEnabled && !input.knowledgeDocuments?.length) {
    warnings.push(
      platform.webSearchEnabled
        ? 'Public web search is enabled but no search provider key is configured. Cannot invent external sources.'
        : 'Public web search is not configured (WEB_SEARCH_ENABLED=false). Cannot invent external sources.',
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

  // Blocked public research with no evidence — differentiated from operational blockers
  if (
    wantsPublic &&
    !webSearchEnabled &&
    evidence.length === 0 &&
    /trend|market|competitor|news|find current|tariff|sentiment|on x\b/i.test(
      input.message,
    )
  ) {
    const missingAdapters: string[] = [];
    if (!platform.webSearchEnabled) missingAdapters.push('WEB_SEARCH_ENABLED=false');
    if (!platform.tavilyConfigured) missingAdapters.push('TAVILY_API_KEY');
    if (!platform.openaiConfigured || !platform.openaiWebSearchEnabled) {
      missingAdapters.push('OPENAI_API_KEY (web search)');
    }
    if (!platform.xaiConfigured || !platform.xaiWebSearchEnabled) {
      missingAdapters.push('XAI_API_KEY (optional web)');
    }
    const requiredAction =
      'Set WEB_SEARCH_ENABLED=true and configure TAVILY_API_KEY (preferred) or OPENAI_API_KEY, then restart the API.';
    return buildEnvelope({
      input,
      requestId,
      conversationId,
      status: 'blocked',
      dataMode: 'unavailable',
      category,
      informationMode: 'public_web',
      synthesis: {
        text: [
          'I cannot look up current public information because web search is not configured on this server.',
          'No sources were invented.',
          `Missing/disabled: ${missingAdapters.join(', ') || 'search adapters'}.`,
          'For inventory, orders, or catalog questions use operational prompts (tenant data) instead of public research.',
        ].join(' '),
        artifactType: 'answer',
        artifact: {
          blockedReason: 'public_search_not_configured',
          errorCode: 'WEB_SEARCH_NOT_CONFIGURED',
          requiredAction,
          missingAdapters,
        },
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
      warnings: [...warnings, 'WEB_SEARCH_NOT_CONFIGURED'],
      provider: provider.id,
      model: undefined,
      prompt,
      toolsInvoked,
      latencyMs: Date.now() - t0,
      errorCode: 'WEB_SEARCH_NOT_CONFIGURED',
      requiredAction,
    });
  }

  // Operational tools all failed with no evidence → explicit blocker (not vague Cohere prose)
  const opsToolResults = toolResults.filter(
    (t) => !t.tool.startsWith('research.') && t.tool !== 'search.manager',
  );
  const allOpsMissing =
    opsToolResults.length > 0 &&
    opsToolResults.every((t) => {
      const d = t.data as { error?: string } | null;
      return !t.ok && d?.error === 'operational_data_required';
    }) &&
    evidence.length === 0;

  if (allOpsMissing && need === 'authenticated_operational_data') {
    const meta =
      input.operationalContext &&
      typeof input.operationalContext.meta === 'object' &&
      input.operationalContext.meta
        ? (input.operationalContext.meta as Record<string, unknown>)
        : {};
    const failedCaps = opsToolResults.map((t) => t.tool).join(', ');
    const requiredAction =
      'Connect a live commerce connector (e.g. Shopify/Stripe), sync products into the tenant catalog, or ensure the organization has operational rows in the database.';
    return buildEnvelope({
      input,
      requestId,
      conversationId,
      status: 'blocked',
      dataMode: 'unavailable',
      category,
      informationMode: 'authenticated_operational',
      synthesis: {
        text: [
          'This objective needs tenant operational data (products, inventory, orders, or payments).',
          `Capabilities that had no data: ${failedCaps || 'none'}.`,
          meta.dataClass
            ? `Tenant snapshot dataClass=${String(meta.dataClass)} (products=${String(meta.productCount ?? 0)}, live=${String(meta.liveProductCount ?? 0)}, orders=${String(meta.orderCount ?? 0)}).`
            : 'No tenant operational snapshot was available.',
          'Nothing was invented from the public web.',
        ].join(' '),
        artifactType: 'answer',
        artifact: {
          blockedReason: 'operational_data_required',
          errorCode: 'OPERATIONAL_DATA_REQUIRED',
          requiredAction,
          failedCapabilities: opsToolResults.map((t) => t.tool),
          snapshotMeta: meta,
        },
        confidence: 0.95,
        objectiveTitle: 'Operational data required',
        objectiveDescription: input.message,
        successCriteria: [],
        intentCategory: category,
        informationMode: 'authenticated_operational',
        warnings: warnings.slice(),
      },
      evidence: [],
      actions: [],
      warnings: [...warnings, 'OPERATIONAL_DATA_REQUIRED'],
      provider: provider.id,
      model: undefined,
      prompt,
      toolsInvoked,
      latencyMs: Date.now() - t0,
      errorCode: 'OPERATIONAL_DATA_REQUIRED',
      requiredAction,
    });
  }

  // Surface fixture/mixed catalog honesty only when operational tools ran
  const snapMeta =
    input.operationalContext &&
    typeof input.operationalContext.meta === 'object' &&
    input.operationalContext.meta
      ? (input.operationalContext.meta as Record<string, unknown>)
      : null;
  const usedOperationalTools = toolResults.some(
    (t) => !t.tool.startsWith('research.') && t.tool !== 'search.manager',
  );
  if (usedOperationalTools && snapMeta?.dataClass === 'TEST_FIXTURE') {
    warnings.push(
      'TENANT_DATA_CLASS=TEST_FIXTURE: analyze only as fixture/demo catalog — never claim live Shopify/Stripe.',
    );
  } else if (usedOperationalTools && snapMeta?.dataClass === 'MIXED') {
    warnings.push(
      'TENANT_DATA_CLASS=MIXED: label fixture vs live products when citing inventory or opportunities.',
    );
  }

  // --- Phase B: structured synthesis ---
  const synthesisUser = [
    `User objective: ${input.message}`,
    `Intent category hint: ${category}`,
    `Information mode hint: ${informationMode}`,
    snapMeta
      ? `Tenant snapshot meta: ${JSON.stringify(snapMeta)}`
      : 'Tenant snapshot meta: (none)',
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
    'Ground the answer in the tool results and evidence above — cite specific product titles, SKUs, quantities, or case blockers when present.',
    'If dataClass is TEST_FIXTURE, say so clearly.',
    'If write actions are appropriate, put them in proposedActions with requiresApproval=true.',
    'Never claim actions completed.',
  ].join('\n');

  let synthesisResult = await provider.generateStructured({
    system: composedSystem,
    user: synthesisUser,
    history,
    schema: SYNTHESIS_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: 'tradeops_synthesis',
    temperature: 0.2,
    maxTokens: Number(process.env.COHERE_MAX_TOKENS) || 4000,
  });

  let validated = validateSynthesisPayload(synthesisResult.value);

  // One repair attempt (code-owned schema repair path)
  if (!validated.ok && synthesisResult.rawText) {
    warnings.push(...validated.errors.map((e) => `schema: ${e}`));
    synthesisResult = await provider.generateStructured({
      system: composedSystem,
      user: [
        synthesisUser,
        '',
        'Previous output failed validation:',
        validated.errors.join('; '),
        'Previous raw (truncated):',
        (synthesisResult.rawText ?? '').slice(0, 1500),
        'Fix and return valid JSON only with all required keys.',
      ].join('\n'),
      history,
      schema: SYNTHESIS_JSON_SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'tradeops_synthesis',
      temperature: 0,
      maxTokens: 4000,
    });
    validated = validateSynthesisPayload(synthesisResult.value);
  }

  if (!synthesisResult.ok) {
    return failEnvelope(
      input,
      requestId,
      conversationId,
      synthesisResult.error ?? 'Cohere synthesis call failed.',
      synthesisResult.code ?? 'AI_PROVIDER_FAILED',
      provider.id,
      'failed',
      'unavailable',
    );
  }

  if (!validated.ok || !validated.value) {
    // Prefer live model text over a dead schema error when Cohere did answer.
    const raw = (synthesisResult.rawText ?? '').trim();
    let recoveredText = '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { text?: unknown };
        if (typeof parsed?.text === 'string' && parsed.text.trim()) {
          recoveredText = parsed.text.trim();
        }
      } catch {
        /* not JSON */
      }
      if (!recoveredText) {
        // Strip fenced JSON noise; keep plain prose if present
        recoveredText = raw
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        if (recoveredText.startsWith('{') && recoveredText.includes('"text"')) {
          const m = recoveredText.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/);
          if (m?.[1]) {
            recoveredText = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
        }
      }
    }

    if (recoveredText && recoveredText.length > 2 && !recoveredText.startsWith('{')) {
      warnings.push(
        `SCHEMA_SOFT_FAIL: ${validated.errors.join('; ') || 'validation failed'} — returned live model text`,
      );
      return buildEnvelope({
        input,
        requestId,
        conversationId,
        status: 'partial',
        dataMode: simPolicy.simulationEnabled ? 'simulation' : 'live',
        category,
        informationMode,
        synthesis: {
          text: redactSecrets(recoveredText),
          artifactType: 'answer',
          artifact: {
            schemaSoftFail: true,
            errors: validated.errors,
          },
          confidence: 0.6,
          objectiveTitle: 'Answer (schema soft-fail)',
          objectiveDescription: input.message,
          successCriteria: [],
          intentCategory: category,
          informationMode,
          warnings: warnings.slice(),
        },
        evidence,
        actions,
        warnings,
        provider: provider.id,
        model: synthesisResult.model,
        prompt,
        toolsInvoked,
        latencyMs: Date.now() - t0,
      });
    }

    return buildEnvelope({
      input,
      requestId,
      conversationId,
      status: 'failed',
      dataMode: 'unavailable',
      category,
      informationMode,
      synthesis: {
        text: redactSecrets(
          `Structured synthesis failed after validation. ${validated.errors.join('; ') || synthesisResult.error || 'unknown'}`,
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

  const dataMode: DataMode = simPolicy.simulationEnabled ? 'simulation' : 'live';
  const finalStatus: TradeOpsCanonicalResponse['status'] =
    warnings.some((w) => /not configured|blocked|cannot invent|OPERATIONAL_DATA/i.test(w)) &&
    evidence.length === 0
      ? 'partial'
      : warnings.length && evidence.length === 0
        ? 'partial'
        : 'completed';

  // Provenance: which code-owned prompts and agent roles participated
  const synthesisWithOwnership = {
    ...validated.value,
    artifact: {
      ...validated.value.artifact,
      agentPlan: {
        primary: agentPlan.primary,
        roles: agentPlan.roles,
        rationale: agentPlan.rationale,
      },
      promptIds: {
        system: `${prompt.id}@${prompt.version}`,
        developer: `${developer.id}@${developer.version}`,
        task: taskPrompt ? `${taskPrompt.id}@${taskPrompt.version}` : null,
      },
      schemaId: 'tradeops_synthesis@1.0.0',
      configOwner: 'tradeops_source_code',
    },
  };

  return buildEnvelope({
    input,
    requestId,
    conversationId,
    status: finalStatus,
    dataMode,
    category: validated.value.intentCategory || category,
    informationMode: validated.value.informationMode || informationMode,
    synthesis: synthesisWithOwnership,
    evidence,
    actions,
    warnings: [
      ...warnings,
      ...validated.value.warnings,
      ...(simPolicy.simulationEnabled ? ['SIMULATION_MODE'] : []),
    ],
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
  status: TradeOpsCanonicalResponse['status'] = 'failed',
  dataMode: DataMode = 'unavailable',
  requiredAction?: string,
): TradeOpsCanonicalResponse {
  const provenance = buildProvenance({
    dataMode,
    aiProvider: provider === 'none' ? null : provider,
    aiModel: null,
    toolNames: [],
    traceId: requestId,
  });
  return {
    schemaVersion: '1.0.0',
    requestId,
    tenantId: input.tenantId || 'unknown',
    workspaceId: input.workspaceId,
    conversationId,
    status,
    dataMode,
    provenance,
    intent: {
      category: 'general',
      informationMode: 'no_search',
      language: input.locale ?? 'en',
      requiresLiveData: false,
    },
    objective: {
      title: status === 'blocked' ? 'Request blocked' : 'Request failed',
      description: input.message,
      successCriteria: [],
    },
    output: {
      text: redactSecrets(text),
      artifactType: 'answer',
      artifact: { code, errorCode: code, requiredAction },
    },
    evidence: [],
    actions: [],
    warnings: [code],
    confidence: 0,
    generatedAt: provenance.generatedAt,
    errorCode: code,
    requiredAction,
    meta: { provider },
  };
}

function buildEnvelope(args: {
  input: AgentLoopRequest;
  requestId: string;
  conversationId: string;
  status: TradeOpsCanonicalResponse['status'];
  dataMode: DataMode;
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
  errorCode?: string;
  requiredAction?: string;
}): TradeOpsCanonicalResponse {
  const s = args.synthesis;
  const searchProv = args.toolsInvoked.some((t) => t.includes('search') || t.includes('research'))
    ? 'search_manager'
    : null;
  const provenance = buildProvenance({
    dataMode: args.dataMode,
    aiProvider: args.provider,
    aiModel: args.model ?? null,
    searchProvider: searchProv,
    toolNames: args.toolsInvoked,
    traceId: args.requestId,
    cacheHit: false,
  });
  const errorCode =
    args.errorCode ??
    (typeof s.artifact?.errorCode === 'string' ? s.artifact.errorCode : undefined);
  const requiredAction =
    args.requiredAction ??
    (typeof s.artifact?.requiredAction === 'string'
      ? s.artifact.requiredAction
      : undefined);
  return {
    schemaVersion: '1.0.0',
    requestId: args.requestId,
    tenantId: args.input.tenantId,
    workspaceId: args.input.workspaceId,
    conversationId: args.conversationId,
    status: args.status,
    dataMode: args.dataMode,
    provenance,
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
    generatedAt: provenance.generatedAt,
    errorCode,
    requiredAction,
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
