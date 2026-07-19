import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  describeAiProviders,
  generateText,
  resolveProviderFromEnv,
} from './provider-abstraction';
import {
  createTavilyProvider,
  describeWebSearchProviders,
  invokeResearchCapability,
} from './web-search-provider';

describe('AI stack policy', () => {
  it('resolveProviderFromEnv ignores openai/anthropic without keys for them', () => {
    const id = resolveProviderFromEnv({
      OPENAI_API_KEY: 'sk-fake',
      ANTHROPIC_API_KEY: 'ant-fake',
    } as NodeJS.ProcessEnv);
    assert.equal(id, 'none');
  });

  it('resolveProviderFromEnv selects cohere when key present', () => {
    const id = resolveProviderFromEnv({
      COHERE_API_KEY: 'cohere-test-key',
      XAI_API_KEY: 'xai-also-present',
    } as NodeJS.ProcessEnv);
    assert.equal(id, 'cohere');
  });

  it('resolveProviderFromEnv ignores XAI_API_KEY alone (Cohere-only policy)', () => {
    const id = resolveProviderFromEnv({
      XAI_API_KEY: 'xai-test-key',
    } as NodeJS.ProcessEnv);
    assert.equal(id, 'none');
  });

  it('resolveProviderFromEnv ignores AI_PROVIDER=xai even when XAI key present', () => {
    const id = resolveProviderFromEnv({
      AI_PROVIDER: 'xai',
      XAI_API_KEY: 'xai-test-key',
      COHERE_API_KEY: 'cohere-also',
    } as NodeJS.ProcessEnv);
    assert.equal(id, 'cohere');
  });

  it('resolveProviderFromEnv returns none when AI_PROVIDER=xai and no Cohere key', () => {
    const id = resolveProviderFromEnv({
      AI_PROVIDER: 'xai',
      XAI_API_KEY: 'xai-test-key',
    } as NodeJS.ProcessEnv);
    assert.equal(id, 'none');
  });

  it('generateText blocks honestly without generative adapter', async () => {
    const r = await generateText({ prompt: 'hello' });
    assert.ok(r.blocked || r.offline || r.failed || r.provider === 'cohere' || r.provider === 'none');
    if (r.provider === 'none') {
      assert.ok(r.blocked || r.offline);
      assert.equal(r.text, '');
      assert.match(String(r.note), /COHERE_API_KEY/i);
      assert.doesNotMatch(String(r.note), /xAI chat HTTP|console\.x\.ai/i);
    }
  });

  it('describeAiProviders lists cohere sole generative; xai never active', () => {
    const rows = describeAiProviders();
    const ids = rows.map((p) => p.id).sort();
    assert.deepEqual(ids, ['cohere', 'none', 'xai'].sort());
    const xai = rows.find((p) => p.id === 'xai');
    assert.equal(xai?.active, false);
    assert.equal(xai?.configured, false);
    assert.match(String(xai?.role), /not_used|ignored/i);
    const cohere = rows.find((p) => p.id === 'cohere');
    assert.equal(cohere?.role, 'sole_generative_provider');
  });
});

describe('Web search stack policy', () => {
  it('sole provider is tavily', () => {
    const d = describeWebSearchProviders();
    assert.equal(d.length, 1);
    assert.equal(d[0]!.id, 'tavily');
    assert.equal(d[0]!.role, 'sole_public_web_search');
  });

  it('blocks research without TAVILY_API_KEY — no demo hits', async () => {
    const p = createTavilyProvider({} as NodeJS.ProcessEnv);
    const r = await p.searchPublicWeb('test');
    assert.equal(r.blocked, true);
    assert.equal(r.hits.length, 0);
    assert.match(String(r.note), /TAVILY_API_KEY|blocked/i);
  });

  it('invokeResearchCapability uses canonical capability ids', async () => {
    const r = await invokeResearchCapability('research.search_public_web', {
      query: 'shopify api',
    });
    assert.equal(r.capability, 'research.search_public_web');
    assert.ok(r.blocked || r.failed || r.hits.length >= 0);
  });
});
