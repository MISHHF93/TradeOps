import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluateAmazonMediaReadiness,
  evaluateEbayMediaReadiness,
  evaluateGoogleMediaReadiness,
  evaluateShopifyMediaReadiness,
  mapToEbayMediaResource,
  mapToShopifyMediaType,
  selectListingMedia,
} from './channel-media-rules';
import { discoverSupplierArtifacts, discoverFromCsvMediaRow } from './supplier-artifact-adapter';
import { analyzeArtifactContent } from './artifact-analysis';
import { createLocalArtifactStorage } from './artifact-storage';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const sampleRows = [
  {
    id: 'a1',
    artifactType: 'image',
    purpose: 'primary',
    publicationStatus: 'ready',
    rightsStatus: 'supplier_authorized',
    visibility: 'listing_eligible',
    width: 1200,
    height: 1200,
  },
  {
    id: 'a2',
    artifactType: 'image',
    purpose: 'gallery',
    publicationStatus: 'ready',
    rightsStatus: 'supplier_authorized',
    visibility: 'listing_eligible',
    width: 1000,
    height: 1000,
  },
  {
    id: 'a3',
    artifactType: 'document',
    purpose: 'specification',
    publicationStatus: 'ready',
    rightsStatus: 'supplier_authorized',
    visibility: 'listing_eligible',
    width: null,
    height: null,
  },
];

describe('channel-media-rules', () => {
  it('Google readiness passes high-res authorized primary', () => {
    const g = evaluateGoogleMediaReadiness(sampleRows);
    assert.equal(g.listingEligible, true);
    assert.equal(g.details.resolutionOk, true);
    assert.equal(g.details.additionalImages, 1);
  });

  it('Google blocks unknown rights', () => {
    const g = evaluateGoogleMediaReadiness([
      {
        ...sampleRows[0]!,
        rightsStatus: 'unknown',
      },
    ]);
    assert.equal(g.listingEligible, false);
    assert.ok(g.issues.some((i) => /rights/i.test(i)));
  });

  it('Google flags sub-500 resolution', () => {
    const g = evaluateGoogleMediaReadiness([
      { ...sampleRows[0]!, width: 200, height: 200 },
    ]);
    assert.equal(g.listingEligible, false);
    assert.equal(g.details.resolutionOk, false);
  });

  it('Shopify maps media types and counts models', () => {
    assert.equal(mapToShopifyMediaType('image'), 'IMAGE');
    assert.equal(mapToShopifyMediaType('external_video'), 'EXTERNAL_VIDEO');
    assert.equal(mapToShopifyMediaType('model_3d'), 'MODEL_3D');
    const s = evaluateShopifyMediaReadiness([
      ...sampleRows,
      {
        artifactType: 'model_3d',
        purpose: 'other',
        publicationStatus: 'discovered',
        rightsStatus: 'unknown',
        visibility: 'internal',
        width: null,
        height: null,
      },
    ]);
    assert.equal(s.details.models3d, 1);
    assert.equal(s.publishStatus, 'credential_blocked');
  });

  it('eBay rejects legacy UploadSiteHostedPictures path in metadata', () => {
    const e = evaluateEbayMediaReadiness(sampleRows);
    assert.match(String(e.details.legacyUploadSiteHostedPictures), /do_not_use/);
    assert.equal(mapToEbayMediaResource('document'), 'DOCUMENT');
  });

  it('Amazon is credential-blocked and does not free-republish', () => {
    const a = evaluateAmazonMediaReadiness(sampleRows);
    assert.equal(a.listingEligible, false);
    assert.equal(a.publishStatus, 'credential_blocked');
    assert.match(String(a.details.republishPolicy), /not_implied/);
  });

  it('selectListingMedia prefers primary and skips restricted', () => {
    const sel = selectListingMedia(
      [
        ...sampleRows,
        {
          id: 'bad',
          artifactType: 'image',
          purpose: 'gallery',
          publicationStatus: 'ready',
          rightsStatus: 'restricted',
          visibility: 'restricted',
          width: 800,
          height: 800,
        },
      ],
      'fixture_marketplace',
    );
    assert.equal(sel.selectedArtifactIds[0], 'a1');
    assert.ok(!sel.selectedArtifactIds.includes('bad'));
  });
});

describe('supplier-artifact-adapter', () => {
  it('discovers images videos docs from supplier record', () => {
    const d = discoverSupplierArtifacts({
      title: 'Test',
      imageUrl: 'https://cdn.example.com/p.jpg',
      images: ['https://cdn.example.com/g1.jpg'],
      videoUrl: 'https://www.youtube.com/watch?v=abc',
      documents: [{ url: 'https://cdn.example.com/spec.pdf', type: 'specification' }],
      manuals: ['https://cdn.example.com/manual.pdf'],
      certificates: ['https://cdn.example.com/ce.pdf'],
    });
    assert.ok(d.some((x) => x.purpose === 'primary'));
    assert.ok(d.some((x) => x.artifactType === 'external_video'));
    assert.ok(d.some((x) => x.purpose === 'manual'));
    assert.ok(d.some((x) => x.purpose === 'compliance'));
  });

  it('parses CSV media row', () => {
    const d = discoverFromCsvMediaRow({
      title: 'SKU1',
      image_url: 'https://cdn.example.com/a.png',
      manual_url: 'https://cdn.example.com/m.pdf',
    });
    assert.ok(d.length >= 2);
  });
});

describe('artifact-analysis proposals', () => {
  it('labels image analysis as proposal', () => {
    const p = analyzeArtifactContent({
      artifactId: 'x',
      artifactType: 'image',
      purpose: 'primary',
      title: 'Bamboo Desk Organizer',
      width: 1200,
      height: 1200,
    });
    assert.equal(p.proposal, true);
    assert.equal(p.humanReviewRequired, true);
    assert.equal(p.analysis.listingSuitability, 'candidate');
  });

  it('classifies document purpose', () => {
    const p = analyzeArtifactContent({
      artifactId: 'd1',
      artifactType: 'document',
      purpose: 'warranty',
      title: 'Warranty sheet',
      bodyTextSample: 'Limited warranty 12 months',
    });
    assert.equal(p.analysis.documentType, 'warranty');
    assert.equal(p.analysis.warrantyTerms, true);
  });
});

describe('artifact-storage local provider', () => {
  it('writes and reads tenant-scoped keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tradeops-art-'));
    try {
      const s = createLocalArtifactStorage(dir);
      const key = s.resolveKey({
        organizationId: 'org1',
        productId: 'prod1',
        artifactId: 'art1',
        name: 'original.txt',
      });
      assert.match(key, /^organizations\/org1\/products\/prod1\/artifacts\/art1\//);
      s.writeObject(key, Buffer.from('hello'));
      assert.equal(s.readObject(key).toString('utf8'), 'hello');
      assert.equal(s.exists(key), true);
      assert.equal(s.accessPolicy.publicBucket, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
