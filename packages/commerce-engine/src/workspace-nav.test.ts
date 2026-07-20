import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFallbackNav,
  buildPersonaNav,
  listTerminalDestinations,
  OPERATING_PERSONAS,
} from './workspace';

describe('AI-first persona nav', () => {
  for (const persona of OPERATING_PERSONAS) {
    it(`buildPersonaNav(${persona}) returns primary · admin · more`, () => {
      const groups = buildPersonaNav(persona);
      assert.deepEqual(
        groups.map((g) => g.id),
        ['primary', 'admin', 'more'],
      );
      assert.ok(groups[0]!.items.length >= 3, 'primary has Home · Cases · Connections');
      const labels = groups[0]!.items.map((i) => i.label);
      assert.ok(labels.includes('Home'));
      assert.ok(labels.includes('Cases'));
      assert.ok(labels.includes('Connections'));
      assert.ok(groups[1]!.items.length >= 1, 'admin not empty');
    });

    it(`buildPersonaNav(${persona}) has unique hrefs across groups`, () => {
      const groups = buildPersonaNav(persona);
      const hrefs: string[] = [];
      for (const g of groups) {
        for (const item of g.items) {
          const base = item.href.split('?')[0] ?? item.href;
          hrefs.push(base);
        }
      }
      assert.equal(hrefs.length, new Set(hrefs).size, hrefs.join(', '));
    });

    it(`buildPersonaNav(${persona}) omits industrial without pack`, () => {
      const groups = buildPersonaNav(persona, { packs: {} });
      const all = groups.flatMap((g) => g.items.map((i) => i.href)).join(' ');
      assert.ok(!all.includes('/terminal/industrial'), all);
      assert.ok(!all.includes('/terminal/live-examples'), all);
    });

    it(`buildPersonaNav(${persona}) includes industrial when pack on`, () => {
      const groups = buildPersonaNav(persona, { packs: { industrial: true } });
      const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
      assert.ok(hrefs.some((h) => h.startsWith('/terminal/industrial')), hrefs.join(', '));
    });
  }

  it('buildFallbackNav matches buildPersonaNav researcher', () => {
    assert.deepEqual(
      buildFallbackNav('researcher').map((g) => g.id),
      buildPersonaNav('researcher').map((g) => g.id),
    );
  });

  it('listTerminalDestinations includes discover and connectors', () => {
    const list = listTerminalDestinations();
    const hrefs = new Set(list.map((d) => d.href));
    assert.ok(hrefs.has('/terminal'));
    assert.ok(hrefs.has('/terminal/connectors'));
    assert.ok(hrefs.has('/terminal/process'));
  });
});
