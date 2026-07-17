import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import {
  capitalModeCatalog,
  getCapitalProductMode,
  isGuaranteedReturnsEnabled,
  isInternalCustodyEnabled,
  isPooledInvestmentEnabled,
} from './capital-mode';

describe('capital product mode', () => {
  afterEach(() => {
    delete process.env.TRADEOPS_CAPITAL_MODE;
    delete process.env.TRADEOPS_POOLED_INVESTMENT_ENABLED;
    delete process.env.TRADEOPS_GUARANTEED_RETURNS_ENABLED;
    delete process.env.TRADEOPS_INTERNAL_CUSTODY_ENABLED;
    delete process.env.NODE_ENV;
  });

  it('defaults to client_owned', () => {
    delete process.env.TRADEOPS_CAPITAL_MODE;
    assert.equal(getCapitalProductMode({}), 'client_owned');
  });

  it('parses modes', () => {
    assert.equal(getCapitalProductMode({ TRADEOPS_CAPITAL_MODE: 'sandbox' }), 'sandbox');
    assert.equal(getCapitalProductMode({ TRADEOPS_CAPITAL_MODE: 'network' }), 'network');
  });

  it('forces pooled investment off in production', () => {
    assert.equal(
      isPooledInvestmentEnabled({
        NODE_ENV: 'production',
        TRADEOPS_POOLED_INVESTMENT_ENABLED: 'true',
      }),
      false,
    );
  });

  it('forces guaranteed returns off in production', () => {
    assert.equal(
      isGuaranteedReturnsEnabled({
        NODE_ENV: 'production',
        TRADEOPS_GUARANTEED_RETURNS_ENABLED: 'true',
      }),
      false,
    );
  });

  it('forces internal custody off in production', () => {
    assert.equal(
      isInternalCustodyEnabled({
        NODE_ENV: 'production',
        TRADEOPS_INTERNAL_CUSTODY_ENABLED: 'true',
      }),
      false,
    );
  });

  it('catalog exposes five rails and preferred language', () => {
    const c = capitalModeCatalog({ TRADEOPS_CAPITAL_MODE: 'client_owned' });
    assert.equal(c.mode, 'client_owned');
    assert.ok(c.rails.length >= 5);
    assert.ok(c.positioning.language.preferred.includes('commerce budget'));
    assert.equal(c.hardBlocks.pooledInvestment.enabled, false);
  });
});
