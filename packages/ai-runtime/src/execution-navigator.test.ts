import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExecutionPackage,
  frameObjective,
  rankOptionScore,
  summarizeExecutionPackage,
} from './execution-navigator';
import { classifyObjective } from './operator-cycle';

describe('execution navigator', () => {
  it('ranks options preferring high impact and low effort', () => {
    const high = rankOptionScore({
      impact: 5,
      effort: 1,
      confidence: 0.9,
      businessValue: 5,
    });
    const low = rankOptionScore({
      impact: 2,
      effort: 5,
      confidence: 0.5,
      businessValue: 2,
    });
    assert.ok(high > low);
  });

  it('frames research objectives as read-only analysis', () => {
    const c = classifyObjective(
      'Find three products under $20 with 25% margin for Canada',
    );
    const framed = frameObjective(
      'Find three products under $20 with 25% margin for Canada',
      c,
    );
    assert.equal(framed.objectiveType, 'READ_ONLY_ANALYSIS');
    assert.ok(framed.goal.length > 10);
    assert.ok(framed.desiredOutcome.length > 10);
    assert.equal(framed.approvalRequired, false);
  });

  it('builds full 10-section execution package without fabricating live connectors', () => {
    const pkg = buildExecutionPackage({
      objective:
        'Find three products under $20 supplier cost that could sell in Canada with at least a 25% expected margin.',
      loopMode: 'shadow',
      snapshot: {
        productCount: 12,
        fixtureProductCount: 10,
        liveProductCount: 2,
        connectors: [
          {
            providerKey: 'fixture-supplier',
            status: 'connected',
            isFixture: true,
          },
          {
            providerKey: 'shopify-graphql-admin',
            status: 'credentials_required',
            isFixture: false,
          },
        ],
        openCommerceCases: 1,
        recentOperatorRuns: 3,
        simulationMode: false,
        hasLiveHttpReady: [],
      },
      cycle: {
        plan: {
          steps: ['a'],
          toolsToCall: ['searchConnectedProducts'],
          interpretation: 'test',
        },
        toolTrace: [],
        recommendations: [
          {
            rank: 1,
            actionClass: 'read_only',
            title: 'Sample Product',
            rationale: 'Good margin',
            evidence: {},
            assumptions: [],
            missingData: [],
            calculation: {},
            forecast: {},
            confidence: 0.8,
            policyRiskScore: 10,
            approvalRequired: false,
            expectedOutcome: {},
            proposedAction: 'evaluateProduct',
          },
        ],
        critic: { issues: [], severity: 'none', notes: 'ok' },
        auditor: {
          calculationOk: true,
          policyOk: true,
          permissionsOk: true,
          identityOk: true,
          issues: [],
          notes: 'ok',
        },
        decision: 'accept',
        decisionNote: 'ok',
        loopMode: 'shadow',
        objectiveType: 'READ_ONLY_ANALYSIS',
        riskClass: 'read_only',
        approvalRequired: false,
        timeline: [],
        sources: [{ name: 'fixture-supplier', status: 'connected', detail: 'Fixture' }],
        responseSummary: 'Found 1 product',
        candidateStats: {
          retrieved: 12,
          normalized: 12,
          rejectedMissingCost: 0,
          passedPolicy: 8,
          ranked: 1,
        },
        filtersApplied: {},
      },
      priorKnowledge: [
        {
          id: 'prior-1',
          objectivePattern: 'READ_ONLY_ANALYSIS',
          lesson: 'Always check fixture counts',
          evidenceSummary: 'prior run',
          confidence: 0.9,
          createdAt: new Date().toISOString(),
        },
      ],
      runId: 'run-test-1',
    });

    assert.equal(pkg.packageVersion, '1.0');
    assert.ok(pkg.objective.goal);
    assert.ok(pkg.currentState.productCount === 12);
    assert.ok(pkg.liveEvidence.length >= 2);
    assert.ok(pkg.recommendations.length >= 1);
    assert.ok(pkg.recommendations.some((r) => r.recommended));
    assert.ok(pkg.executionPlan.tasks.length >= 3);
    assert.ok(pkg.timeline.immediate.length >= 1);
    assert.ok(pkg.dependencies.length >= 1);
    assert.ok(pkg.risks.length >= 1);
    assert.ok(pkg.executionStatus.overall);
    assert.ok(pkg.verification.criteria.length >= 1);
    assert.ok(pkg.knowledgeBaseDelta.length >= 1);
    assert.ok(pkg.priorKnowledgeApplied.length >= 1);
    assert.ok(pkg.honesty.fixtureOrSimulationEvidenceCount >= 0);

    // No fabricated "connected" for shopify without credentials in evidence of readiness
    assert.equal(pkg.currentState.connectorSummary.connected, 0);

    const summary = summarizeExecutionPackage(pkg);
    assert.match(summary, /OBJECTIVE:/);
    assert.match(summary, /STATUS:/);
  });

  it('publish objectives require approval and include approval risk', () => {
    const pkg = buildExecutionPackage({
      objective: 'Publish listing for top product to marketplace',
      snapshot: {
        productCount: 1,
        fixtureProductCount: 0,
        liveProductCount: 1,
        connectors: [
          {
            providerKey: 'shopify-graphql-admin',
            status: 'connected',
            isFixture: false,
          },
        ],
        hasLiveHttpReady: ['shopify-graphql-admin'],
      },
    });
    assert.equal(pkg.objective.approvalRequired, true);
    assert.ok(pkg.risks.some((r) => r.id === 'risk-unapproved-publish'));
    assert.ok(pkg.dependencies.some((d) => d.id === 'dep-human-approval'));
  });
});
