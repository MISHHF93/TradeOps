import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OBJECT_FSMS,
  buildRuntimeSnapshot,
  canObjectTransition,
  eventTypeForTransformation,
  planRuntimeExecution,
  summarizeOrgExecution,
} from './commerce-runtime';
import { resolveCommerceState } from './commerce-state-engine';
import type { CaseFacts } from './commerce-lifecycle';

const facts: CaseFacts = {
  hasProduct: true,
  hasOpportunity: true,
  opportunityScore: 70,
  expectedProfitMinor: 1200,
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

describe('commerce runtime', () => {
  it('defines FSMs with no empty transition maps for primary kinds', () => {
    for (const kind of ['commerce_case', 'listing', 'order', 'approval'] as const) {
      const fsm = OBJECT_FSMS[kind];
      assert.ok(fsm.states.length > 0);
      assert.ok(Object.keys(fsm.transitions).length > 0);
    }
    assert.equal(canObjectTransition('listing', 'draft', 'pending_approval'), true);
    assert.equal(canObjectTransition('listing', 'active', 'draft'), false);
  });

  it('builds runtime snapshot answering what process is executing', () => {
    const caseState = resolveCommerceState({
      caseId: 'c1',
      productId: 'p1',
      productTitle: 'Bamboo Desk',
      organizationId: 'org1',
      currentStage: 'evaluate',
      stageStatus: 'completed',
      facts,
      opportunityScore: 70,
      confidence: 0.8,
      expectedProfitMinor: 1200,
      persona: 'operator',
    });
    const snap = buildRuntimeSnapshot({
      organizationId: 'org1',
      persona: 'operator',
      caseState,
      connectors: [
        {
          providerKey: 'fixture-supplier',
          displayName: 'Fixture Supplier',
          isFixture: true,
          status: 'connected',
          capabilities: ['discover_products', 'compare_suppliers'],
        },
      ],
      pendingApprovals: 1,
    });
    assert.ok(snap.activeProcess);
    assert.equal(snap.activeProcess?.kind, 'commerce_case');
    assert.ok(snap.activeProcess?.label.includes('Bamboo'));
    assert.ok(snap.recommendation);
    assert.ok(snap.aiPreamble.includes('State Engine') || snap.aiPreamble.includes('transformation'));
    assert.ok(snap.concurrentProcesses.some((p) => p.kind === 'approval_gate'));
    assert.ok(snap.objectFsms.length >= 10);
  });

  it('plans execution and rejects non-blocker when blocked', () => {
    const caseState = resolveCommerceState({
      caseId: 'c2',
      productId: 'p2',
      currentStage: 'qualify',
      stageStatus: 'blocked',
      facts: { ...facts, blockedByPolicy: true, policyOutcome: 'blocked' },
      blockerCode: 'policy_blocked',
      blockerMessage: 'blocked',
    });
    const bad = planRuntimeExecution({ transformation: 'publish', caseState });
    assert.equal(bad.ok, false);
    const good = planRuntimeExecution({ transformation: 'resolve_blocker', caseState });
    assert.equal(good.ok, true);
    assert.equal(eventTypeForTransformation('publish'), 'ListingPublished');
  });

  it('summarizes org execution when idle', () => {
    const s = summarizeOrgExecution({
      organizationId: 'o',
      openCases: 0,
      blockedCases: 0,
      pendingApprovals: 0,
      avgFriction: 0,
    });
    assert.match(s.answer, /No Commerce Case/);
  });
});
