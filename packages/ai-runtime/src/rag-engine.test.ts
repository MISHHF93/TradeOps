import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRagIndex,
  queryRagIndex,
  retrieve,
  tokenize,
  type RagDocument,
} from './rag-engine';
import { isLlmConfigured, resolveXaiApiKey } from './llm-client';

describe('rag engine', () => {
  const docs: RagDocument[] = [
    {
      id: 'p1',
      sourceType: 'product',
      sourceId: 'prod-1',
      title: 'Insulated Water Bottle 32oz',
      body: 'Stainless steel bottle for outdoor hiking. Supplier cost low. Canada shipping friendly. Margin opportunity above 25%.',
      tags: ['outdoor', 'canada'],
      isFixture: true,
    },
    {
      id: 'p2',
      sourceType: 'product',
      sourceId: 'prod-2',
      title: 'Wireless Earbuds Pro',
      body: 'Bluetooth earbuds with charging case. High return risk. Marketplace fees apply. Shopify listing draft ready.',
      tags: ['electronics'],
      isFixture: false,
    },
    {
      id: 'c1',
      sourceType: 'commerce_case',
      sourceId: 'case-1',
      title: 'Case: bottle evaluate stage',
      body: 'Commerce case for water bottle stuck in evaluate. Next action: prepare listing draft after policy pass.',
      isFixture: true,
    },
  ];

  it('tokenizes and drops stopwords', () => {
    const t = tokenize('The Water Bottle is for the hiking trail');
    assert.ok(t.includes('water'));
    assert.ok(t.includes('bottle'));
    assert.ok(!t.includes('the'));
    assert.ok(!t.includes('for'));
  });

  it('trains an index and retrieves relevant product knowledge', () => {
    const index = buildRagIndex('org-1', docs);
    assert.equal(index.stats.documentCount, 3);
    assert.ok(index.stats.chunkCount >= 3);
    assert.equal(index.stats.modelVersion, 'rag-tfidf-v1');
    assert.ok(index.stats.fixtureChunks >= 1);

    const hits = retrieve(index, 'canada water bottle margin hiking', { topK: 3 });
    assert.ok(hits.length >= 1);
    assert.ok(
      hits[0]!.title.toLowerCase().includes('bottle') ||
        hits[0]!.text.toLowerCase().includes('bottle'),
    );
  });

  it('can exclude fixtures from retrieval', () => {
    const index = buildRagIndex('org-1', docs);
    const hits = retrieve(index, 'wireless earbuds bluetooth shopify', {
      topK: 5,
      excludeFixtures: true,
    });
    assert.ok(hits.every((h) => !h.isFixture));
    assert.ok(hits.some((h) => h.title.toLowerCase().includes('earbuds')));
  });

  it('queryRagIndex builds grounded context without inventing hits', () => {
    const index = buildRagIndex('org-1', docs);
    const empty = queryRagIndex(index, 'zzzznonexistenttermxyz123');
    // may be empty or very low — grounded context must not invent product claims
    assert.match(empty.honesty.note, /not fabricated/i);
    assert.equal(empty.honesty.embeddingModel, 'rag-tfidf-v1');

    const q = queryRagIndex(index, 'commerce case evaluate listing draft bottle');
    assert.ok(q.groundedContext.includes('Retrieved org knowledge') || q.hits.length === 0);
    if (q.hits.length) {
      assert.ok(q.citations.length === q.hits.length);
    }
  });

  it('LLM key helpers fail closed without env', () => {
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.GROK_API_KEY;
    assert.equal(resolveXaiApiKey({}), undefined);
    assert.equal(isLlmConfigured({}), false);
    if (prev) process.env.XAI_API_KEY = prev;
  });
});
