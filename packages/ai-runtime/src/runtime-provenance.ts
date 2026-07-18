/**
 * Response provenance + data mode — every AI response must declare how it was produced.
 * Never mix demo content into live mode. Never invent operational success.
 */

import type { DataMode, RuntimeProvenance } from './schemas/base-response';

export type { DataMode, RuntimeProvenance };

export type SimulationPolicy = {
  simulationEnabled: boolean;
  /** True only when NODE_ENV=production and simulation is on without explicit allow */
  productionSimulationRejected: boolean;
  responseCacheEnabled: boolean;
  aiRuntimeEnabled: boolean;
};

function truthy(v: string | undefined | null): boolean {
  if (v == null || v === '') return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/**
 * Read simulation / cache policy from env (platform flags only).
 * Production rejects implicit simulation.
 */
export function getSimulationPolicy(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SimulationPolicy {
  const sim =
    truthy(env.ENABLE_SIMULATION_MODE) ||
    truthy(env.TRADEOPS_SIMULATION_MODE);
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const allowProdSim = truthy(env.TRADEOPS_ALLOW_PRODUCTION_SIMULATION);
  const productionSimulationRejected = production && sim && !allowProdSim;

  // Cache off by default while validating real runtime (prompt temporary settings)
  const cacheRaw = env.AI_RESPONSE_CACHE_ENABLED;
  const responseCacheEnabled =
    cacheRaw === undefined || cacheRaw === ''
      ? false
      : truthy(cacheRaw);

  const aiRuntimeEnabled =
    env.AI_RUNTIME_ENABLED === undefined || env.AI_RUNTIME_ENABLED === ''
      ? true
      : truthy(env.AI_RUNTIME_ENABLED);

  return {
    simulationEnabled: sim && !productionSimulationRejected,
    productionSimulationRejected,
    responseCacheEnabled,
    aiRuntimeEnabled,
  };
}

export function buildProvenance(input: {
  dataMode: DataMode;
  aiProvider?: string | null;
  aiModel?: string | null;
  searchProvider?: string | null;
  toolNames?: string[];
  connectorNames?: string[];
  cacheHit?: boolean;
  traceId?: string;
  providerRequestId?: string;
}): RuntimeProvenance {
  const generatedAt = new Date().toISOString();
  const traceId = input.traceId ?? `trace_${Date.now().toString(36)}`;
  const tools = input.toolNames ?? [];
  const provider = input.aiProvider ?? null;
  const model = input.aiModel ?? null;
  const modeLabel =
    input.dataMode === 'live'
      ? 'Live'
      : input.dataMode === 'cached'
        ? 'Cached'
        : input.dataMode === 'simulation'
          ? 'Simulation'
          : 'Unavailable';
  const parts = [
    modeLabel,
    provider ? provider : null,
    model ? model : null,
    tools.length ? `${tools.length} tool${tools.length === 1 ? '' : 's'}` : null,
    `Generated ${new Date(generatedAt).toLocaleTimeString()}`,
  ].filter(Boolean);

  return {
    dataMode: input.dataMode,
    aiProvider: provider,
    aiModel: model,
    searchProvider: input.searchProvider ?? null,
    toolNames: tools,
    connectorNames: input.connectorNames ?? [],
    generatedAt,
    providerRequestId: input.providerRequestId,
    cacheHit: Boolean(input.cacheHit),
    traceId,
    sourceLabel: parts.join(' · '),
  };
}

/** Map config/provider absence to blocked envelope fields (no fabricated success). */
export function blockedReasonForMissingProvider(providerId: string): {
  status: 'blocked';
  errorCode: string;
  message: string;
  requiredAction: string;
} {
  const key =
    providerId === 'cohere'
      ? 'COHERE_API_KEY'
      : providerId === 'openai'
        ? 'OPENAI_API_KEY'
        : providerId === 'xai'
          ? 'XAI_API_KEY'
          : 'AI provider key';
  return {
    status: 'blocked',
    errorCode: 'AI_PROVIDER_NOT_CONFIGURED',
    message: `${providerId === 'none' ? 'AI' : providerId} is not configured.`,
    requiredAction: `Set ${key} in server environment (never NEXT_PUBLIC_*) and restart the API.`,
  };
}
