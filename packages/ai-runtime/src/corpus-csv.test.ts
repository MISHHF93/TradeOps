import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  artifactCorpusToCsv,
  artifactToCorpusRow,
  escapeCsvCell,
  buildArtifactTextForRag,
} from './corpus-csv';

describe('corpus-csv', () => {
  it('escapes quotes and commas', () => {
    assert.equal(escapeCsvCell('a,b'), '"a,b"');
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  });

  it('builds searchable artifact text', () => {
    const t = buildArtifactTextForRag({
      productTitle: 'Water Bottle',
      title: 'Primary photo',
      purpose: 'primary',
      artifactType: 'image',
    });
    assert.match(t, /Water Bottle/);
    assert.match(t, /Primary photo/);
    assert.match(t, /primary/i);
  });

  it('emits CSV with headers and fixture label', () => {
    const row = artifactToCorpusRow({
      organizationId: 'org-1',
      artifactId: 'art-1',
      productId: 'p-1',
      productTitle: 'Bottle',
      artifactType: 'image',
      purpose: 'primary',
      sourceType: 'generated',
      sourcePlatform: 'fixture-supplier',
      title: 'Hero',
      description: 'Main listing image',
      rightsStatus: 'unknown',
      publicationStatus: 'ready',
      visibility: 'listing_eligible',
      isFixture: true,
      collectedAt: '2026-07-17T00:00:00.000Z',
    });
    assert.equal(row.dataClass, 'fixture');
    assert.equal(row.isFixture, 'true');
    const csv = artifactCorpusToCsv([row]);
    assert.match(csv, /^organizationId,/);
    assert.match(csv, /art-1/);
    assert.match(csv, /fixture/);
  });
});
