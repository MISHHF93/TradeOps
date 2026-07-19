import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildFallbackNav,
  buildPersonaNav,
  listTerminalDestinations,
  OPERATING_PERSONAS,
} from './workspace';

describe('hybrid persona nav', () => {
  for (const persona of OPERATING_PERSONAS) {
    it(`buildPersonaNav(${persona}) returns focus · operate · platform · more`, () => {
      const groups = buildPersonaNav(persona);
      assert.deepEqual(
        groups.map((g) => g.id),
        ['focus', 'operate', 'platform', 'more'],
      );
      assert.ok(groups[0]!.items.length >= 4, 'focus has primary items');
      assert.ok(groups[1]!.items.length >= 1, 'operate not empty after dedupe');
      assert.ok(groups[2]!.items.length >= 1, 'platform not empty after dedupe');
    });

    it(`buildPersonaNav(${persona}) has unique hrefs across groups`, () => {
      const groups = buildPersonaNav(persona);
      const hrefs: string[] = [];
      for (const g of groups) {
        for (const item of g.items) {
          const base = item.href.split('?')[0] ?? item.href;
          // procedure deep-links share persona home path with query — allow those
          if (item.id.startsWith('proc-')) continue;
          hrefs.push(base);
        }
      }
      assert.equal(hrefs.length, new Set(hrefs).size, hrefs.join(', '));
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
    assert.ok(hrefs.has('/terminal/ai'));
  });
});
