/**
 * Double-entry helpers for Commerce Capital.
 * Balances are derived from journal lines — never trust a lone mutable balance field.
 */

import { randomUUID } from 'node:crypto';

export type LedgerLine = {
  accountCode: string;
  direction: 'debit' | 'credit';
  amountMinor: number;
  memo: string;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
};

export type JournalDraft = {
  journalId: string;
  lines: LedgerLine[];
  currency: string;
};

/** Balanced journal: sum(debits) === sum(credits) */
export function assertJournalBalanced(lines: LedgerLine[]): void {
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    if (line.amountMinor <= 0) {
      throw new Error(`Ledger line amount must be positive: ${line.accountCode}`);
    }
    if (line.direction === 'debit') debits += line.amountMinor;
    else if (line.direction === 'credit') credits += line.amountMinor;
    else throw new Error(`Invalid direction: ${line.direction}`);
  }
  if (debits !== credits) {
    throw new Error(`Unbalanced journal: debits=${debits} credits=${credits}`);
  }
}

export function buildFundingJournal(input: {
  amountMinor: number;
  currency: string;
  campaignId: string;
  commitmentId: string;
}): JournalDraft {
  const journalId = randomUUID();
  const lines: LedgerLine[] = [
    {
      accountCode: 'cash_safeguarded',
      direction: 'debit',
      amountMinor: input.amountMinor,
      memo: `Funding received for campaign ${input.campaignId}`,
      idempotencyKey: `fund_debit_${input.commitmentId}`,
      referenceType: 'capital_commitment',
      referenceId: input.commitmentId,
    },
    {
      accountCode: 'capital_liability',
      direction: 'credit',
      amountMinor: input.amountMinor,
      memo: `Capital liability for commitment ${input.commitmentId}`,
      idempotencyKey: `fund_credit_${input.commitmentId}`,
      referenceType: 'capital_commitment',
      referenceId: input.commitmentId,
    },
  ];
  assertJournalBalanced(lines);
  return { journalId, lines, currency: input.currency };
}

export function buildDisbursementJournal(input: {
  amountMinor: number;
  currency: string;
  disbursementId: string;
  budgetLine: string;
}): JournalDraft {
  const journalId = randomUUID();
  const lines: LedgerLine[] = [
    {
      accountCode: `expense_${input.budgetLine}`,
      direction: 'debit',
      amountMinor: input.amountMinor,
      memo: `Disbursement ${input.disbursementId} (${input.budgetLine})`,
      idempotencyKey: `disb_debit_${input.disbursementId}`,
      referenceType: 'capital_disbursement',
      referenceId: input.disbursementId,
    },
    {
      accountCode: 'cash_safeguarded',
      direction: 'credit',
      amountMinor: input.amountMinor,
      memo: `Cash out for disbursement ${input.disbursementId}`,
      idempotencyKey: `disb_credit_${input.disbursementId}`,
      referenceType: 'capital_disbursement',
      referenceId: input.disbursementId,
    },
  ];
  assertJournalBalanced(lines);
  return { journalId, lines, currency: input.currency };
}

export function deriveBalances(
  entries: Array<{ accountCode: string; direction: string; amountMinor: number }>,
): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const e of entries) {
    const sign = e.direction === 'debit' ? 1 : -1;
    bal[e.accountCode] = (bal[e.accountCode] ?? 0) + sign * e.amountMinor;
  }
  return bal;
}
