import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  looksLikeSystemPrompt,
  operatorRunDescription,
  sanitizeOperatorObjective,
} from './operator-objective-display';

describe('operator objective display', () => {
  it('returns clean user objectives unchanged', () => {
    const o = 'Find products worth evaluating in Canada.';
    assert.equal(sanitizeOperatorObjective(o), o);
  });

  it('strips workspace AI preamble (You are the single intelligent AI...)', () => {
    const polluted = [
      'You are the single intelligent AI for the Operator workspace (One User · One Workspace · One Objective · One AI).',
      'Mission: Run commerce evaluation.',
      'Allowed tools for this persona: search, rank.',
      'Focus objective (start here unless user overrides):',
      'Find products worth evaluating.',
    ].join('\n');
    assert.equal(sanitizeOperatorObjective(polluted), 'Find products worth evaluating.');
  });

  it('strips case state engine preamble via Operator objective marker', () => {
    const polluted = [
      'You are the TradeOps Commerce State Engine operator.',
      'Do not merely answer questions — select the highest-value valid transformation.',
      '',
      'Operator objective:',
      'Qualify top listing candidates for Shopify.',
    ].join('\n');
    assert.equal(
      sanitizeOperatorObjective(polluted),
      'Qualify top listing candidates for Shopify.',
    );
  });

  it('detects system prompts', () => {
    assert.equal(looksLikeSystemPrompt('You are TradeOps Intelligence'), true);
    assert.equal(looksLikeSystemPrompt('Rank SKUs by margin'), false);
  });

  it('description prefers plan summary over system blob', () => {
    const r = operatorRunDescription({
      objective:
        'You are the single intelligent AI for the Operator workspace.\n\nFocus objective (start here unless user overrides):\nScan inventory gaps',
      planJson: {
        responseSummary: '3 products ranked by contribution profit.',
        userObjective: 'Scan inventory gaps',
      },
    });
    assert.equal(r.objective, 'Scan inventory gaps');
    assert.equal(r.description, '3 products ranked by contribution profit.');
  });
});
