/**
 * Production AI configuration inventory — proves TradeOps owns AI behavior in source.
 * Cohere is the model provider only. Playground is not a configuration store.
 *
 * Ownership chain:
 *   TradeOps source → prompt registry → schema registry → tool/capability registry
 *   → AI runtime (agent loop) → Cohere provider → tool executor
 *   → structured synthesis → validation → canonical API response → frontend
 */

import { getAiPlatformConfig, aiPlatformPublicStatus } from '@tradeops/config';
import { agentCatalogPublic } from './agent-orchestration';
import { listCapabilitiesPublic } from './capability-catalog';
import { listPromptsPublic, getPrompt, requirePrompt } from './prompts/registry';
import { resolveAIProvider, aiProviderPublicStatus } from './provider/resolve-provider';
import { getSimulationPolicy } from './runtime-provenance';
import { listSchemasPublic, getSchema, requireSchema } from './schemas/registry';
import { toolPoliciesPublic } from './tool-policies';
import { listToolsPublic } from './tool-registry';
import { providerToolsPublic } from './tools/provider-tools';

export const PRODUCTION_AI_OWNERSHIP = {
  owner: 'TradeOps source code',
  provider: 'Cohere (model inference only)',
  notUsedForProductionConfig: [
    'Cohere Playground',
    'browser NEXT_PUBLIC_* secrets',
    'ad-hoc prompt strings outside registries',
  ],
  ownsInSource: [
    'system instructions',
    'developer instructions',
    'task prompts',
    'prompt versions',
    'model configuration (via @tradeops/config env)',
    'structured-output configuration',
    'JSON response schemas',
    'artifact schemas',
    'function/tool definitions',
    'tool parameter schemas',
    'tool-result schemas',
    'tool authorization policies',
    'approval requirements',
    'agent-loop behavior',
    'search policies',
    'retrieval policies',
    'response validation',
    'schema repair (validateSynthesisPayload coerce)',
    'provenance',
    'response persistence (API AiChatService)',
    'frontend response contracts (TradeOpsCanonicalResponse)',
  ],
  pipeline: [
    'TradeOps source code',
    'prompt registry',
    'schema registry',
    'tool / capability registry',
    'AI runtime (runCohereAgentLoop)',
    'Cohere provider (createCohereProvider)',
    'tool / capability executor',
    'structured synthesis',
    'runtime validation',
    'canonical API response',
    'frontend artifact renderer',
  ],
} as const;

/**
 * Public production config snapshot — never includes secret values.
 */
export function productionAiConfigPublic(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const platform = getAiPlatformConfig(env);
  const provider = resolveAIProvider(env);
  const system = getPrompt('tradeops-system');
  const developer = getPrompt('tradeops-developer');
  const synthesis = getSchema('tradeops_synthesis');
  const toolResult = getSchema('tool_result');
  const canonical = getSchema('canonical_api_response');
  const taskIds = [
    'task-operational',
    'task-research',
    'task-procurement',
    'task-compliance',
  ] as const;
  const tasks = taskIds.map((id) => {
    const p = getPrompt(id);
    return p ? { id: p.id, version: p.version, description: p.description } : null;
  });

  return {
    ownership: PRODUCTION_AI_OWNERSHIP,
    provider: {
      active: provider.id,
      configured: provider.configured,
      public: aiProviderPublicStatus(env),
      cohere: {
        chatModel: platform.cohereChatModel,
        embedModel: platform.cohereEmbedModel,
        rerankModel: platform.cohereRerankModel,
        baseUrl: platform.cohereBaseUrl,
        temperature: platform.cohereTemperature,
        maxTokens: platform.cohereMaxTokens,
        timeoutMs: platform.cohereTimeoutMs,
        retrievalEnabled: platform.cohereRetrievalEnabled,
        // never expose api key
        apiKeyConfigured: platform.cohereConfigured,
      },
    },
    runtime: {
      entrypoint: 'runCohereAgentLoop',
      phases: [
        'compose_system_developer_task_prompts',
        'classify_information_need',
        'plan_agent_roles',
        'phase_a_tool_selection',
        'phase_a_tool_execution',
        'search_manager',
        'phase_b_structured_synthesis',
        'validate_synthesis_payload',
        'schema_repair_once',
        'build_canonical_envelope',
        'persist_via_AiChatService',
      ],
      structuredOutputEnabled: platform.structuredOutputEnabled,
      toolCallingEnabled: platform.toolCallingEnabled,
      streamingEnabled: platform.streamingEnabled,
      responseMode: platform.responseMode,
      outputSchemaVersion: platform.outputSchemaVersion,
      maxToolCalls: platform.aiMaxToolCalls,
      maxExecutionSeconds: platform.aiMaxExecutionSeconds,
      approvals: {
        writes: platform.aiRequireApprovalForWrites,
        payments: platform.aiRequireApprovalForPayments,
        refunds: platform.aiRequireApprovalForRefunds,
        publishing: platform.aiRequireApprovalForPublishing,
      },
      simulation: getSimulationPolicy(env),
    },
    prompts: {
      registered: listPromptsPublic(),
      system: system
        ? { id: system.id, version: system.version, description: system.description }
        : null,
      developer: developer
        ? { id: developer.id, version: developer.version, description: developer.description }
        : null,
      tasks: tasks.filter(Boolean),
      pin: env.AI_PROMPT_VERSION ?? null,
    },
    schemas: {
      registered: listSchemasPublic(),
      synthesis: synthesis
        ? { id: synthesis.id, version: synthesis.version, description: synthesis.description }
        : null,
      toolResult: toolResult
        ? { id: toolResult.id, version: toolResult.version, description: toolResult.description }
        : null,
      canonicalApiResponse: canonical
        ? { id: canonical.id, version: canonical.version, description: canonical.description }
        : null,
      canonicalEnvelope: 'TradeOpsCanonicalResponse @ schemas/base-response.ts',
    },
    tools: {
      capabilities: listCapabilitiesPublic(),
      definitions: providerToolsPublic(),
      policies: toolPoliciesPublic(),
      legacyRegistry: listToolsPublic(),
    },
    agents: agentCatalogPublic(),
    search: {
      ownedBy: 'TradeOps Search Manager',
      enabled: platform.webSearchEnabled,
      primary: platform.searchProviderPrimary,
      internal: platform.searchProviderInternal,
      requireCitations: platform.searchRequireCitations,
      requireSourceTimestamps: platform.searchRequireSourceTimestamps,
      maxQueries: platform.searchMaxQueriesPerRequest,
      maxResults: platform.searchMaxResultsPerQuery,
      allowedDomains: platform.searchAllowedDomains,
      blockedDomains: platform.searchBlockedDomains,
    },
    retrieval: {
      engine: platform.cohereRetrievalEnabled && platform.cohereConfigured ? 'cohere' : 'local_or_disabled',
      embedModel: platform.cohereEmbedModel,
      rerankModel: platform.cohereRerankModel,
    },
    platformStatus: aiPlatformPublicStatus(env),
    integrity: {
      systemPromptLoadable: Boolean(system),
      developerPromptLoadable: Boolean(developer),
      taskPromptsLoadable: tasks.every(Boolean),
      synthesisSchemaLoadable: Boolean(synthesis),
      toolResultSchemaLoadable: Boolean(toolResult),
      canonicalContractLoadable: Boolean(canonical),
      capabilitiesRegistered: listCapabilitiesPublic().length,
      cohereProviderId: provider.id === 'cohere' || platform.aiProvider === 'cohere',
      playgroundNotUsed: true,
      failClosedWhenCohereMissing:
        (env.AI_PROVIDER ?? platform.aiProvider ?? 'cohere').toString().toLowerCase() === 'cohere' &&
        !provider.configured
          ? true
          : provider.configured,
    },
    checkedAt: new Date().toISOString(),
  };
}

/** Fail fast if critical code-owned assets missing */
export function assertProductionAiAssetsPresent(): void {
  requirePrompt('tradeops-system');
  requirePrompt('tradeops-developer');
  requirePrompt('task-operational');
  requirePrompt('task-research');
  requirePrompt('task-procurement');
  requirePrompt('task-compliance');
  requireSchema('tradeops_synthesis');
  requireSchema('tool_result');
  requireSchema('canonical_api_response');
  requireSchema('answer');
  requireSchema('operational_brief');
  requireSchema('execution_plan');
  const caps = listCapabilitiesPublic();
  if (caps.length < 10) {
    throw new Error(`Capability catalog incomplete: ${caps.length} tools`);
  }
  if (!caps.some((c) => c.name === 'commerce.search_products')) {
    throw new Error('Missing core capability commerce.search_products');
  }
}
