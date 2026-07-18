/**
 * Resolve the active AIProvider from AI_PROVIDER env.
 * Default for this runtime activation: cohere when key present.
 */

import { getAiPlatformConfig } from '@tradeops/config';
import type { AIProvider } from './ai-provider';
import { createCohereProvider } from './cohere-provider';
import { createOpenAiAsProvider } from './openai-as-provider';

export function resolveAIProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AIProvider {
  const cfg = getAiPlatformConfig(env);
  const raw = (env.AI_PROVIDER ?? cfg.aiProvider ?? 'cohere').toString().trim().toLowerCase();

  if (raw === 'openai') {
    const openai = createOpenAiAsProvider(env);
    if (openai.configured) return openai;
    const cohere = createCohereProvider(env);
    if (cohere.configured) return cohere;
    return openai;
  }

  if (raw === 'xai') {
    // Prefer cohere for full interface when xAI selected without full provider
    const cohere = createCohereProvider(env);
    if (cohere.configured) return cohere;
    return createOpenAiAsProvider(env);
  }

  // cohere | auto | default
  const cohere = createCohereProvider(env);
  if (cohere.configured) return cohere;
  const openai = createOpenAiAsProvider(env);
  if (openai.configured) return openai;
  return cohere; // unconfigured fail-closed
}

export function aiProviderPublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const p = resolveAIProvider(env);
  return {
    activeProvider: p.id,
    configured: p.configured,
    note: 'TradeOps owns the agent. Provider is replaceable behind AIProvider.',
  };
}
