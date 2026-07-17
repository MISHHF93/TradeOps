import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyArtifactPurposeRules,
  classifyObjectiveIntentRules,
  classifyProductCategoryRules,
} from './ai-classifiers';

describe('AI classifiers (rules)', () => {
  it('classifies warranty document purpose', () => {
    const r = classifyArtifactPurposeRules({
      title: 'Product Warranty Card',
      description: '2 year guarantee terms',
      mimeType: 'application/pdf',
    });
    assert.equal(r.proposal, true);
    assert.equal(r.humanReviewRequired, true);
    assert.equal(r.labels.suggestedPurpose, 'warranty');
    assert.equal(r.source, 'rules');
  });

  it('classifies hero image purpose', () => {
    const r = classifyArtifactPurposeRules({
      title: 'Primary hero shot',
      mimeType: 'image/jpeg',
    });
    assert.equal(r.labels.suggestedPurpose, 'primary');
    assert.equal(r.labels.suggestedArtifactType, 'image');
  });

  it('classifies product category for earbuds', () => {
    const r = classifyProductCategoryRules({
      title: 'Wireless Bluetooth Earbuds Pro',
      description: 'noise cancelling headphones',
    });
    assert.equal(r.labels.suggestedCategory, 'Electronics');
  });

  it('classifies publish objective intent', () => {
    const r = classifyObjectiveIntentRules('Publish the approved listing to Shopify');
    assert.equal(r.labels.intent, 'publish');
    assert.equal(r.labels.approvalLikely, true);
  });

  it('classifies research objective', () => {
    const r = classifyObjectiveIntentRules(
      'Find products with margin above 25% for Canada',
    );
    assert.equal(r.labels.intent, 'research');
  });
});
