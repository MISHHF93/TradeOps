import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCatalogAdapter,
  normalizeCatalogProduct,
  runLiveProjection,
} from './live-projection';

describe('live projection', () => {
  it('normalizes catalog products', () => {
    const item = normalizeCatalogProduct({
      id: 'p1',
      title: 'Centrifugal Pump',
      targetPriceMinor: 184000,
      currency: 'usd',
      isFixture: true,
    });
    assert.equal(item.price?.amount, 1840);
    assert.equal(item.dataMode, 'fixture');
    assert.ok(item.url.includes('p1'));
  });

  it('streams projected items from catalog adapter', async () => {
    const adapter = createCatalogAdapter([
      {
        id: 'a',
        title: 'Industrial centrifugal pump 2HP',
        description: 'Stainless steel pump',
        targetPriceMinor: 150000,
        currency: 'USD',
      },
      {
        id: 'b',
        title: 'Garden hose',
        description: 'not relevant',
        targetPriceMinor: 2000,
        currency: 'USD',
      },
    ]);

    const events: string[] = [];
    let projected = 0;
    for await (const ev of runLiveProjection({
      queryId: 'qry_test',
      query: 'industrial pump',
      sources: [adapter],
      maxItems: 10,
      enableRerank: false,
    })) {
      events.push(ev.type);
      if (ev.type === 'item.projected') projected += 1;
    }

    assert.ok(events.includes('query.started'));
    assert.ok(events.includes('item.projected'));
    assert.ok(events.includes('query.completed'));
    assert.ok(projected >= 1);
  });
});
