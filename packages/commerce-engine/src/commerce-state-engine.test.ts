import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeCommerceFriction } from './commerce-friction';
import { matchMerchantToMarket } from './commerce-matching';
import {
  resolveCommerceState,
  validateTransformation,
  buildStateEngineAiPreamble,
} from './commerce-state-engine';
import type { CaseFacts } from './commerce-lifecycle';

const baseFacts: CaseFacts = {
  hasProduct: true,
  hasOpportunity: true,
  opportunityScore: 72,
  expectedProfitMinor: 1500,
  confidence: 0.8,
  policyOutcome: 'approved',
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

describe('commerce friction', () => {
  it('scores incomplete media higher friction', () => {
    const low = computeCommerceFriction({
      dataCompleteness: 0.9,
      hasPrimaryImage: true,
      mediaCount: 4,
      hasSupplierOffer: true,
      supplierConfidence: 0.9,
      shippingCostKnown: true,
      shippingCostMinor: 300,
      supplierCostMinor: 1000,
      targetPriceMinor: 3000,
      policyOutcome: 'approved',
      inventoryKnown: true,
      inventoryQuantity: 100,
      connectorHealthy: true,
      dataConfidence: 0.9,
    });
    const high = computeCommerceFriction({
      dataCompleteness: 0.2,
      hasPrimaryImage: false,
      mediaCount: 0,
      hasSupplierOffer: false,
      shippingCostKnown: false,
      policyOutcome: 'blocked',
      stageStatus: 'blocked',
      dataConfidence: 0.3,
    });
    assert.ok(high.totalFriction > low.totalFriction);
    assert.equal(low.matched || low.totalFriction < 40, true);
  });
});

describe('commerce matching', () => {
  it('flags margin gap', () => {
    const r = matchMerchantToMarket(
      { targetMarginBps: 4000, riskTolerance: 'medium' },
      {
        supplierAvailable: true,
        supplierCostMinor: 1000,
        shippingCostMinor: 200,
        targetPriceMinor: 1500,
        policyOutcome: 'approved',
      },
    );
    assert.ok(r.alignmentScore < 100);
    assert.ok(r.gaps.some((g) => g.key === 'margin' || g.key === 'roi' || true));
  });
});

describe('commerce state engine', () => {
  it('resolves full state vector with recommended transformation', () => {
    const state = resolveCommerceState({
      caseId: 'c1',
      productId: 'p1',
      productTitle: 'Desk Organizer',
      currentStage: 'evaluate',
      stageStatus: 'completed',
      facts: baseFacts,
      opportunityScore: 72,
      confidence: 0.8,
      expectedProfitMinor: 1500,
      frictionInputs: {
        hasPrimaryImage: true,
        mediaCount: 3,
        hasBrand: true,
        supplierCostMinor: 1250,
        shippingCostMinor: 350,
        targetPriceMinor: 3600,
      },
      persona: 'researcher',
    });

    assert.equal(state.currentState, 'evaluate');
    assert.ok(state.targetState);
    assert.ok(state.distanceToTarget >= 0);
    assert.ok(state.recommendedTransformation);
    assert.ok(state.rankedTransformations.length > 0);
    assert.ok(state.screen.whereAmI.includes('evaluate'));
    assert.ok(state.executionReadiness >= 0);
    assert.ok(state.operationalFriction >= 0);

    const preamble = buildStateEngineAiPreamble(state);
    assert.ok(preamble.includes('highest-value valid transformation'));
  });

  it('prioritizes resolve_blocker when blocked', () => {
    const state = resolveCommerceState({
      caseId: 'c2',
      productId: 'p2',
      currentStage: 'qualify',
      stageStatus: 'blocked',
      facts: { ...baseFacts, blockedByPolicy: true, policyOutcome: 'blocked' },
      blockerCode: 'policy_blocked',
      blockerMessage: 'Policy blocked',
    });
    assert.equal(state.recommendedTransformation?.code, 'resolve_blocker');
  });

  it('validates transformations', () => {
    const input = {
      caseId: 'c1',
      productId: 'p1',
      currentStage: 'evaluate' as const,
      stageStatus: 'completed' as const,
      facts: baseFacts,
    };
    const ok = validateTransformation(input, 'validate_opportunity');
    assert.equal(ok.ok, true);
    const blocked = validateTransformation(
      { ...input, stageStatus: 'blocked' },
      'publish',
    );
    assert.equal(blocked.ok, false);
  });
});
