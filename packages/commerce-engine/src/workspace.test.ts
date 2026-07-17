import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OPERATING_PERSONAS,
  PERSONA_DEFINITIONS,
  PROCEDURES,
  aiToolsForPersona,
  buildPersonaNav,
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

  it('builds persona nav with procedure groups only', () => {
    const nav = buildPersonaNav('researcher', { openTasks: 3 });
    assert.ok(nav.some((g) => g.id === 'procedures'));
    const task = nav.flatMap((g) => g.items).find((i) => i.id === 'tasks');
    assert.equal(task?.badge, '3');
    const hrefs = nav.flatMap((g) => g.items).map((i) => i.href);
    assert.equal(hrefs.some((h) => h.startsWith('/capital')), false);
  });

  it('resolveWorkspace assembles AI preamble and tools', () => {
    const ws = resolveWorkspace({
      organizationId: 'org-1',
      organizationName: 'Acme',
      storedPersona: 'operator',
      pendingApprovals: 2,
      openTasks: 1,
      openBlockers: 0,
    });
    assert.equal(ws.persona, 'operator');
    assert.equal(ws.recommendedNextAction?.href, '/terminal/approvals');
    assert.ok(ws.aiContextPreamble.includes('Operator workspace'));
    assert.ok(ws.allowedAiTools.includes('draftListing'));
    assert.ok(aiToolsForPersona('researcher').includes('scoreOpportunity'));
  });
});
