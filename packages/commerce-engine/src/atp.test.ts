import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateAtp } from './atp';

describe('ATP', () => {
  it('computes available to sell net of reserved and safety', () => {
    const r = calculateAtp({
      onHand: 100,
      reserved: 20,
      inbound: 10,
      damaged: 5,
      returnsPending: 0,
      supplierAvailable: 50,
      safetyStock: 15,
      channelAllocatedElsewhere: 0,
    });
    assert.equal(r.availableToSell, 60); // 100-20-5-15
    assert.ok(r.availableToPromise >= r.availableToSell);
    assert.equal(r.oversellRisk, 'none');
  });

  it('flags high oversell when reserved exceeds on-hand', () => {
    const r = calculateAtp({
      onHand: 10,
      reserved: 20,
      inbound: 0,
      damaged: 0,
      returnsPending: 0,
      supplierAvailable: 0,
      safetyStock: 0,
      channelAllocatedElsewhere: 0,
    });
    assert.equal(r.oversellRisk, 'high');
  });
});
