import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildIntelligenceBrief,
  generateInsights,
  insightsToPriorities,
  type IntelligenceSignals,
} from './intelligence-engine';

function base(over: Partial<IntelligenceSignals> = {}): IntelligenceSignals {
  return {
    persona: 'operator',
    organizationName: 'Acme',
    pendingApprovals: 0,
    openTasks: 0,
    openBlockers: 0,
    activeCaseCount: 0,
    connectorIssues: 0,
    productCount: 10,
    fixtureProductCount: 0,
    liveProductCount: 10,
    openOrderCount: 0,
    stalledCaseCount: 0,
    highOpportunityCount: 0,
    topOpportunityScore: null,
    liveConnectorCount: 1,
    recentObjectiveCount: 0,
    failedRunCount: 0,
    signalBuyCount: 0,
    signalBlockedCount: 0,
    simulationMode: false,
    ...over,
  };
}

describe('intelligence engine', () => {
  it('ranks blockers above opportunities for operators', () => {
    const insights = generateInsights(
      base({
        openBlockers: 2,
        highOpportunityCount: 5,
        topOpportunityScore: 90,
      }),
    );
    assert.ok(insights[0]?.kind === 'blocker' || insights[0]?.id === 'ins-blockers');
    assert.ok(
      insights[0]!.urgencyScore >
        (insights.find((i) => i.kind === 'opportunity')?.urgencyScore ?? 0),
    );
  });

  it('weights opportunities higher for researchers', () => {
    const op = generateInsights(
      base({
        persona: 'operator',
        highOpportunityCount: 3,
        topOpportunityScore: 80,
        connectorIssues: 1,
      }),
    );
    const re = generateInsights(
      base({
        persona: 'researcher',
        highOpportunityCount: 3,
        topOpportunityScore: 80,
        connectorIssues: 1,
      }),
    );
    const oppOp = op.find((i) => i.kind === 'opportunity')!;
    const oppRe = re.find((i) => i.kind === 'opportunity')!;
    assert.ok(oppRe.urgencyScore > oppOp.urgencyScore);
  });

  it('builds brief with focus objective and honesty', () => {
    const brief = buildIntelligenceBrief(
      base({
        pendingApprovals: 3,
        openBlockers: 1,
        openOrderCount: 4,
      }),
    );
    assert.ok(brief.attentionScore > 40);
    assert.ok(['critical', 'attention'].includes(brief.healthLabel));
    assert.ok(brief.focusObjective.length > 20);
    assert.ok(brief.insights.length >= 2);
    assert.ok(brief.narrative.includes('Acme'));
    assert.match(brief.honesty.note, /not fabricated/i);
  });

  it('stable health when quiet', () => {
    const brief = buildIntelligenceBrief(base());
    assert.equal(brief.healthLabel, 'stable');
    assert.ok(brief.topInsight?.kind === 'healthy');
  });

  it('maps insights to priorities with urgency tiers', () => {
    const insights = generateInsights(base({ openBlockers: 5 }));
    const pri = insightsToPriorities(insights);
    assert.ok(pri.length >= 1);
    assert.equal(pri[0]?.urgency, 'critical');
  });

  it('never invents product counts — empty store is data quality insight', () => {
    const insights = generateInsights(
      base({ productCount: 0, liveProductCount: 0, fixtureProductCount: 0 }),
    );
    assert.ok(insights.some((i) => i.id === 'ins-empty'));
  });
});
