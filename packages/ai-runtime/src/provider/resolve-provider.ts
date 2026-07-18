/**
 * Resolve the active AIProvider from AI_PROVIDER env.
 *
 * Production default: Cohere. When AI_PROVIDER is explicitly `cohere`, do not
 * silently fall back to OpenAI — fail closed with configured=false so the
 * agent loop returns blocked + requiredAction (set COHERE_API_KEY).
 *
 * `auto` may fall back across configured providers for local development only.
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
    // Explicit openai: never silently switch to Cohere
    return openai;
  }

  if (raw === 'xai' || raw === 'gemini') {
    // Full xAI/Gemini providers are not first-class AIProvider adapters yet.
    // Prefer Cohere when configured; otherwise return unconfigured cohere fail-closed.
    const cohere = createCohereProvider(env);
    if (cohere.configured) return cohere;
    return cohere;
  }

  if (raw === 'auto') {
    const cohere = createCohereProvider(env);
    if (cohere.configured) return cohere;
    const openai = createOpenAiAsProvider(env);
    if (openai.configured) return openai;
    return cohere;
  }

  // cohere | default — production ownership: Cohere only (no silent OpenAI fallback)
  return createCohereProvider(env);
}

export function aiProviderPublicStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const p = resolveAIProvider(env);
  const requested = (env.AI_PROVIDER ?? getAiPlatformConfig(env).aiProvider ?? 'cohere')
    .toString()
    .trim()
    .toLowerCase();
  return {
    activeProvider: p.id,
    requestedProvider: requested,
    configured: p.configured,
    failClosed: requested === 'cohere' || requested === '' || requested === 'default',
    note: 'TradeOps owns the agent (prompts, tools, validation). Cohere is the model provider. Explicit AI_PROVIDER=cohere never falls back to OpenAI.',
  };
}
