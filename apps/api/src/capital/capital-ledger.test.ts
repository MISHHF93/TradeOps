import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertJournalBalanced,
  buildDisbursementJournal,
  buildFundingJournal,
  deriveBalances,
} from './capital-ledger';

describe('capital ledger', () => {
  it('rejects unbalanced journals', () => {
    assert.throws(
      () =>
        assertJournalBalanced([
          {
            accountCode: 'a',
            direction: 'debit',
            amountMinor: 100,
            memo: 'x',
            idempotencyKey: '1',
          },
          {
            accountCode: 'b',
            direction: 'credit',
            amountMinor: 50,
            memo: 'y',
            idempotencyKey: '2',
          },
        ]),
      /Unbalanced/,
    );
  });

  it('builds balanced funding journal', () => {
    const j = buildFundingJournal({
      amountMinor: 25_000,
      currency: 'CAD',
      campaignId: 'c1',
      commitmentId: 'cm1',
    });
    assert.equal(j.lines.length, 2);
    assertJournalBalanced(j.lines);
  });

  it('builds balanced disbursement journal', () => {
    const j = buildDisbursementJournal({
      amountMinor: 1000,
      currency: 'CAD',
      disbursementId: 'd1',
      budgetLine: 'inventory',
    });
    assertJournalBalanced(j.lines);
  });

  it('derives balances from entries', () => {
    const bal = deriveBalances([
      { accountCode: 'cash', direction: 'debit', amountMinor: 100 },
      { accountCode: 'cash', direction: 'credit', amountMinor: 40 },
      { accountCode: 'liability', direction: 'credit', amountMinor: 60 },
    ]);
    assert.equal(bal.cash, 60);
    assert.equal(bal.liability, -60);
  });
});
