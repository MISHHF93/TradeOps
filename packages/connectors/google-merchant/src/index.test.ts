import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGoogleMerchantFeed,
  googleConnectorStatus,
  hasLiveGoogleCredentials,
  isWeekendLocal,
  nextWeekendMorning,
  runWeekendGooglePost,
} from './index';

describe('GoogleMerchantConnector boundary', () => {
  it('never claims connected without credentials', () => {
    assert.equal(hasLiveGoogleCredentials(null), false);
    assert.equal(googleConnectorStatus(undefined), 'credentials_required');
  });

  it('builds feed items with provenance and does not invent live success', async () => {
    const items = buildGoogleMerchantFeed([
      {
        externalId: 'sku-1',
        title: 'Test Bottle',
        description: 'Insulated bottle',
        targetPriceMinor: 2999,
        currency: 'USD',
        inventoryQuantity: 10,
        sourcePlatform: 'fixture-supplier',
        dataConfidence: 0.9,
        dataFreshnessAt: new Date().toISOString(),
        isFixtureSource: true,
      },
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.price.value, '29.99');
    assert.equal(items[0]?.isFixtureSource, true);

    const shadow = await runWeekendGooglePost({
      products: [
        {
          externalId: 'sku-1',
          title: 'Test Bottle',
          description: 'Insulated bottle',
          targetPriceMinor: 2999,
          currency: 'USD',
          inventoryQuantity: 10,
          sourcePlatform: 'fixture-supplier',
          dataConfidence: 0.9,
          dataFreshnessAt: new Date().toISOString(),
          isFixtureSource: true,
        },
      ],
    });
    assert.equal(shadow.mode, 'shadow');
    assert.equal(shadow.livePostSucceeded, false);
    assert.equal(shadow.postedCount, 0);
  });

  it('computes next weekend morning', () => {
    const wednesday = new Date('2026-07-15T12:00:00'); // Wed
    const next = nextWeekendMorning(wednesday, 9);
    assert.equal(next.getDay(), 6); // Saturday
    assert.equal(next.getHours(), 9);
    assert.equal(isWeekendLocal(new Date('2026-07-18T10:00:00')), true); // Sat
    assert.equal(isWeekendLocal(new Date('2026-07-15T10:00:00')), false); // Wed
  });
});
