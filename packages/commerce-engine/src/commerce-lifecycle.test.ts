import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canTransition,
  computeNextAction,
  inferStageFromFacts,
  validateStageTransition,
  type CaseFacts,
} from './commerce-lifecycle';

const base: CaseFacts = {
  hasProduct: true,
  hasOpportunity: false,
  hasListingDraft: false,
  hasActiveListing: false,
  hasPendingApproval: false,
  hasPaidOrder: false,
  hasSupplierPo: false,
  hasFulfillment: false,
  hasDelivered: false,
  hasOutcome: false,
  blockedByPolicy: false,
};

describe('commerce-lifecycle', () => {
  it('infers discover after product import', () => {
    const s = inferStageFromFacts(base);
    assert.equal(s.currentStage, 'discover');
    assert.equal(s.stageStatus, 'completed');
  });

  it('infers evaluate when opportunity scored', () => {
    const s = inferStageFromFacts({
      ...base,
      hasOpportunity: true,
      opportunityScore: 72,
    });
    assert.equal(s.currentStage, 'evaluate');
  });

  it('blocks qualify when policy blocked', () => {
    const s = inferStageFromFacts({
      ...base,
      hasOpportunity: true,
      opportunityScore: 80,
      blockedByPolicy: true,
      policyOutcome: 'blocked',
    });
    assert.equal(s.currentStage, 'qualify');
    assert.equal(s.stageStatus, 'blocked');
  });

  it('infers approve when pending approval', () => {
    const s = inferStageFromFacts({
      ...base,
      hasListingDraft: true,
      hasPendingApproval: true,
    });
    assert.equal(s.currentStage, 'approve');
    assert.equal(s.stageStatus, 'waiting');
  });

  it('infers publish when active listing', () => {
    const s = inferStageFromFacts({
      ...base,
      hasActiveListing: true,
    });
    assert.equal(s.currentStage, 'publish');
  });

  it('rejects invalid transition publish → discover', () => {
    assert.equal(canTransition('publish', 'discover'), false);
    const v = validateStageTransition('publish', 'discover', base);
    assert.equal(v.ok, false);
  });

  it('allows discover → evaluate with product', () => {
    const v = validateStageTransition('discover', 'evaluate', base);
    assert.equal(v.ok, true);
  });

  it('blocks prepare → approve without listing draft', () => {
    const v = validateStageTransition('prepare', 'approve', base);
    assert.equal(v.ok, false);
    assert.ok(v.missing?.includes('listing_draft'));
  });

  it('computes stage-aware next action', () => {
    const a = computeNextAction({
      currentStage: 'evaluate',
      stageStatus: 'completed',
      productId: 'p1',
      caseId: 'c1',
      facts: { ...base, hasOpportunity: true },
    });
    assert.equal(a.code, 'qualify');
    assert.match(a.href ?? '', /process\/c1/);
  });
});
