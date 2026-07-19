import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertProductionAiAssetsPresent,
  productionAiConfigPublic,
  PRODUCTION_AI_OWNERSHIP,
} from './production-ai-config';
import { requirePrompt } from './prompts/registry';
import { getSchema, requireSchema } from './schemas/registry';
import { listProviderTools } from './tools/provider-tools';
import { resolveAIProvider } from './provider/resolve-provider';
import { AGENT_CATALOG } from './agent-orchestration';
import { getCapability } from './capability-catalog';

describe('production AI configuration ownership', () => {
  it('declares TradeOps source ownership (not Playground)', () => {
    assert.equal(PRODUCTION_AI_OWNERSHIP.owner, 'TradeOps source code');
    assert.ok(PRODUCTION_AI_OWNERSHIP.notUsedForProductionConfig.includes('Cohere Playground'));
    assert.ok(PRODUCTION_AI_OWNERSHIP.ownsInSource.includes('system instructions'));
    assert.ok(PRODUCTION_AI_OWNERSHIP.ownsInSource.includes('tool authorization policies'));
    assert.ok(PRODUCTION_AI_OWNERSHIP.ownsInSource.includes('tool-result schemas'));
  });

  it('loads versioned system and developer prompts from registry', () => {
    const system = requirePrompt('tradeops-system');
    const developer = requirePrompt('tradeops-developer');
    assert.equal(system.id, 'tradeops-system');
    assert.equal(developer.id, 'tradeops-developer');
    assert.ok(system.text.includes('TradeOps Intelligence'));
    assert.ok(developer.text.includes('tenant isolation'));
  });

  it('loads all task prompts', () => {
    for (const id of [
      'task-operational',
      'task-research',
      'task-procurement',
      'task-compliance',
    ]) {
      const p = requirePrompt(id);
      assert.ok(p.text.length > 20, id);
    }
  });

  it('registers synthesis, tool_result, and canonical contracts', () => {
    const s = getSchema('tradeops_synthesis');
    assert.ok(s);
    assert.equal(s!.version, '1.0.0');
    requireSchema('tool_result');
    requireSchema('canonical_api_response');
    requireSchema('risk_assessment');
    requireSchema('analytics_report');
    requireSchema('procurement_plan');
    requireSchema('document_extraction');
  });

  it('assertProductionAiAssetsPresent succeeds', () => {
    assert.doesNotThrow(() => assertProductionAiAssetsPresent());
  });

  it('provider tools expose code-owned parameter schemas', () => {
    const tools = listProviderTools({ includeWrites: true });
    assert.ok(tools.length >= 10);
    const write = tools.find((t) => t.write);
    assert.ok(write);
    assert.ok(write!.requiresApproval);
    assert.equal(write!.parameters.type, 'object');
    const read = tools.find((t) => t.name === 'commerce.search_products');
    assert.ok(read);
    assert.equal(read!.write, false);
  });

  it('agent preferredTools reference capability catalog names', () => {
    for (const agent of AGENT_CATALOG) {
      for (const tool of agent.preferredTools) {
        assert.ok(
          getCapability(tool),
          `agent ${agent.id} preferredTools has unknown capability: ${tool}`,
        );
      }
    }
  });

  it('explicit AI_PROVIDER=cohere does not fall back to openai', () => {
    const p = resolveAIProvider({
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: '',
      OPENAI_API_KEY: 'sk-would-have-been-fallback',
    });
    assert.equal(p.id, 'cohere');
    assert.equal(p.configured, false);
  });

  it('public inventory never leaks secrets', () => {
    const snap = productionAiConfigPublic({
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: 'secret-must-not-appear',
      COHERE_CHAT_MODEL: 'command-a-03-2025',
    });
    const json = JSON.stringify(snap);
    assert.ok(!json.includes('secret-must-not-appear'));
    assert.equal(snap.provider.cohere.apiKeyConfigured, true);
    assert.equal(snap.integrity.systemPromptLoadable, true);
    assert.equal(snap.integrity.developerPromptLoadable, true);
    assert.equal(snap.integrity.taskPromptsLoadable, true);
    assert.equal(snap.integrity.toolResultSchemaLoadable, true);
    assert.equal(snap.integrity.canonicalContractLoadable, true);
    assert.equal(snap.integrity.playgroundNotUsed, true);
    assert.ok(snap.prompts.registered.length >= 6);
    assert.ok(snap.tools.capabilities.length >= 5);
    assert.ok(snap.tools.definitions.tools.length >= 5);
    assert.ok(snap.agents.agents.length >= 6);
    assert.ok(snap.runtime.phases.includes('phase_a_tool_selection'));
    assert.ok(snap.runtime.phases.includes('validate_synthesis_payload'));
  });
});
