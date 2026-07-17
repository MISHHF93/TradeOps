import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import {
  assertFinancialGate,
  capitalWriteMode,
  financialDomainCatalog,
  isFinancialGateEnabled,
  listFinancialGates,
} from './financial-gates';

describe('financial feature gates', () => {
  const keys = [
    'CAPITAL_NETWORK_ENABLED',
    'PUBLIC_CAMPAIGNS_ENABLED',
    'PROFIT_SHARING_ENABLED',
    'EQUITY_OFFERINGS_ENABLED',
    'POOLED_INVESTMENT_ENABLED',
    'AUTOMATED_INVESTMENT_ADVICE_ENABLED',
    'CAPITAL_CUSTODY_ENABLED',
    'DISTRIBUTIONS_ENABLED',
    'MARKETPLACE_CONNECT_ENABLED',
    'PRIVATE_AGREEMENT_LEDGER_ENABLED',
    'CAPITAL_SANDBOX_ENABLED',
    'INVESTOR_ONBOARDING_ENABLED',
  ] as const;

  afterEach(() => {
    for (const k of keys) delete process.env[k];
  });

  it('defaults investment-sensitive gates to disabled', () => {
    for (const k of keys) delete process.env[k];
    assert.equal(isFinancialGateEnabled('CAPITAL_NETWORK_ENABLED'), false);
    assert.equal(isFinancialGateEnabled('PUBLIC_CAMPAIGNS_ENABLED'), false);
    assert.equal(isFinancialGateEnabled('PROFIT_SHARING_ENABLED'), false);
    assert.equal(isFinancialGateEnabled('EQUITY_OFFERINGS_ENABLED'), false);
    assert.equal(isFinancialGateEnabled('POOLED_INVESTMENT_ENABLED'), false);
    assert.equal(isFinancialGateEnabled('DISTRIBUTIONS_ENABLED'), false);
    assert.equal(isFinancialGateEnabled('CAPITAL_CUSTODY_ENABLED'), false);
  });

  it('defaults capital sandbox to enabled for dry-run design', () => {
    delete process.env.CAPITAL_SANDBOX_ENABLED;
    assert.equal(isFinancialGateEnabled('CAPITAL_SANDBOX_ENABLED'), true);
    assert.equal(capitalWriteMode(), 'sandbox');
  });

  it('assertFinancialGate throws when disabled', () => {
    delete process.env.CAPITAL_NETWORK_ENABLED;
    assert.throws(() => assertFinancialGate('CAPITAL_NETWORK_ENABLED'), /disabled/i);
  });

  it('can enable a gate explicitly', () => {
    process.env.PRIVATE_AGREEMENT_LEDGER_ENABLED = 'true';
    assert.equal(isFinancialGateEnabled('PRIVATE_AGREEMENT_LEDGER_ENABLED'), true);
    assert.equal(capitalWriteMode(), 'private_agreement');
  });

  it('catalog exposes separated financial domains', () => {
    const c = financialDomainCatalog();
    assert.ok(c.domains.length >= 4);
    assert.ok(c.gates.length >= 10);
    assert.ok(
      c.honesty.note.toLowerCase().includes('not') ||
        c.honesty.note.toLowerCase().includes('managed commerce'),
    );
  });

  it('listFinancialGates returns all keys', () => {
    assert.ok(listFinancialGates().some((g) => g.key === 'CAPITAL_SANDBOX_ENABLED'));
  });
});
