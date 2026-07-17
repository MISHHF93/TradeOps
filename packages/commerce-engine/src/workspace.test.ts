import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OPERATING_PERSONAS,
  PERSONA_DEFINITIONS,
  PROCEDURES,
  aiToolsForPersona,
  buildPersonaNav,
  listWorkspaceInventory,
  resolveAiNavigation,
  resolveOperatingPersona,
  resolveWorkspace,
} from './workspace';

describe('workspace personas', () => {
  it('defines six operating personas with homes and procedures', () => {
    assert.equal(OPERATING_PERSONAS.length, 6);
    for (const id of OPERATING_PERSONAS) {
      const d = PERSONA_DEFINITIONS[id];
      assert.ok(d.homeHref.includes('/terminal/workspace/'));
      assert.ok(d.procedures.length > 0);
      for (const pid of d.procedures) {
        const proc = PROCEDURES[pid];
        assert.ok(proc, pid);
        assert.equal(proc.persona, id);
        assert.ok(proc.steps.length > 0);
      }
    }
  });

  it('maps legacy stored personas', () => {
    assert.equal(resolveOperatingPersona('founder'), 'researcher');
    assert.equal(resolveOperatingPersona('procurement'), 'operator');
    assert.equal(resolveOperatingPersona('finance'), 'executive');
    assert.equal(resolveOperatingPersona('agency'), 'administrator');
    assert.equal(resolveOperatingPersona('auditor'), 'executive');
    assert.equal(resolveOperatingPersona('developer'), 'developer');
  });

  it('builds lean Focus + More nav (not a feature dump)', () => {
    const nav = buildPersonaNav('researcher', { openTasks: 3 });
    assert.ok(nav.some((g) => g.id === 'focus'));
    assert.ok(nav.some((g) => g.id === 'more'));
    assert.equal(nav.some((g) => g.id === 'procedures'), false);
    const focus = nav.find((g) => g.id === 'focus')!;
    assert.ok(focus.items.length <= 7, 'focus should stay lean');
    const hrefs = nav.flatMap((g) => g.items).map((i) => i.href);
    assert.equal(hrefs.some((h) => h.startsWith('/capital')), false);
    // tasks live under More for researcher — badge not required on primary
    assert.ok(hrefs.includes('/terminal'));
  });

  it('executive focus includes brief, decisions, revenue, AI', () => {
    const nav = buildPersonaNav('executive', { pendingApprovals: 2 });
    const focus = nav.find((g) => g.id === 'focus')!;
    const labels = focus.items.map((i) => i.label);
    assert.ok(labels.some((l) => /brief|executive/i.test(l)));
    assert.ok(labels.some((l) => /decision|approv/i.test(l)));
    assert.ok(labels.some((l) => /AI/i.test(l)));
    const decisions = focus.items.find((i) => i.id === 'decisions');
    assert.equal(decisions?.badge, '2');
  });

  it('resolveWorkspace assembles surface + intelligence + AI preamble', () => {
    const ws = resolveWorkspace({
      organizationId: 'org-1',
      organizationName: 'Acme',
      storedPersona: 'operator',
      pendingApprovals: 2,
      openTasks: 1,
      openBlockers: 0,
      intelligence: {
        productCount: 5,
        liveProductCount: 5,
        fixtureProductCount: 0,
        openOrderCount: 3,
        liveConnectorCount: 1,
      },
    });
    assert.equal(ws.persona, 'operator');
    assert.ok(ws.recommendedNextAction?.href);
    assert.ok(ws.aiContextPreamble.includes('Operator') || ws.aiContextPreamble.includes('intelligence'));
    assert.ok(ws.allowedAiTools.includes('draftListing'));
    assert.ok(aiToolsForPersona('researcher').includes('scoreOpportunity'));
    assert.ok(ws.surface.todaysPriorities.length >= 1);
    assert.ok(ws.surface.aiBriefing.length > 20);
    assert.ok(ws.surface.activeObjectives.length >= 1);
    assert.ok(ws.surface.keyKpis.length >= 3);
    assert.ok(ws.operatingPrinciple.includes('One Workspace'));
    assert.ok(ws.intelligence);
    assert.ok(typeof ws.intelligence!.attentionScore === 'number');
    assert.ok(ws.surface.insights && ws.surface.insights.length >= 1);
    assert.ok(ws.surface.focusObjective);
  });

  it('AI navigation routes natural language to workspaces', () => {
    const ship = resolveAiNavigation('Show my delayed shipments', 'operator');
    assert.equal(ship.matched, true);
    assert.equal(ship.href, '/terminal/fulfillment');
    const conn = resolveAiNavigation('Review connector health', 'developer');
    assert.equal(conn.href, '/terminal/connectors');
    const empty = resolveAiNavigation('', 'executive');
    assert.equal(empty.matched, false);
  });

  it('inventory exposes IA map principles and routes', () => {
    const inv = listWorkspaceInventory();
    assert.ok(inv.principles.includes('One AI'));
    assert.ok(inv.routeOwnership.length >= 20);
    assert.ok(inv.focusNav.every((f) => f.focusItems <= 7));
  });
});
