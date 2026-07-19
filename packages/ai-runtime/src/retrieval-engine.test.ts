import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getRetrievalEngine, retrievalEnginePublicStatus } from './retrieval-engine';

describe('Retrieval Engine', () => {
  it('falls back to local lexical without Cohere key', async () => {
    const engine = getRetrievalEngine({
      COHERE_API_KEY: '',
      COHERE_RETRIEVAL_ENABLED: 'true',
    });
    assert.equal(engine.id, 'local');
    const r = await engine.retrieve({
      query: 'BMW charge pipe aluminum',
      documents: [
        {
          id: '1',
          title: 'Aluminum charge pipe G42',
          body: 'Performance aluminum charge pipe for BMW M240i',
          sourceType: 'document',
          provider: 'catalog',
        },
        {
          id: '2',
          title: 'Winter tire kit',
          body: 'Snow tires for passenger cars',
          sourceType: 'document',
        },
      ],
      topK: 2,
    });
    assert.equal(r.ok, true);
    assert.equal(r.engine, 'local_lexical');
    assert.ok(r.hits.length >= 1);
    assert.equal(r.hits[0]?.id, '1');
  });

  it('reports cohere role in public status', () => {
    const s = retrievalEnginePublicStatus({
      COHERE_API_KEY: 'test',
      COHERE_RETRIEVAL_ENABLED: 'true',
    });
    assert.equal(s.cohereConfigured, true);
    assert.match(s.note, /not the sole generation runtime/i);
  });
});
