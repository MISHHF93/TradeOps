import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CAPABILITY_PROVIDER_MAP,
  LIVE_HTTP_IMPLEMENTED,
  getProductionConnector,
  listProductionConnectors,
  listProductionRuntime,
  resolveCredentialStatus,
} from './production-connectors';

describe('production connector catalog', () => {
  it('registers commerce, payments, logistics, marketing, analytics, accounting, AI', () => {
    const list = listProductionConnectors();
    const ids = new Set(list.map((c) => c.id));
    for (const id of [
      'shopify-graphql-admin',
      'amazon-sp-api',
      'ebay-sell',
      'woocommerce-rest',
      'bigcommerce-rest',
      'stripe-api',
      'paypal-rest',
      'easypost-api',
      'shipstation-api',
      'google-ads',
      'meta-marketing',
      'google-analytics-4',
      'quickbooks-online',
      'xero-api',
      'openai',
      'xai',
      'open-exchange-rates',
      'avalara',
      'serpapi',
      'keepa-api',
    ]) {
      assert.ok(ids.has(id), `missing production connector ${id}`);
    }
    assert.ok(list.length >= 30);
    assert.ok(list.every((c) => c.isFixture === false));
  });

  it('never marks liveReady without credentials', () => {
    const shopify = getProductionConnector('shopify-graphql-admin')!;
    const env = { ...process.env };
    delete env.SHOPIFY_SHOP_DOMAIN;
    delete env.SHOPIFY_ACCESS_TOKEN;
    const cred = resolveCredentialStatus(shopify, env);
    assert.equal(cred.ready, false);
    assert.equal(cred.status, 'credentials_required');
    assert.ok(cred.missingKeys.length >= 1);
  });

  it('marks ready only when all env keys present', () => {
    const stripe = getProductionConnector('stripe-api')!;
    const cred = resolveCredentialStatus(stripe, {
      STRIPE_SECRET_KEY: 'sk_test_fake',
    } as NodeJS.ProcessEnv);
    assert.equal(cred.ready, true);
    assert.equal(cred.status, 'connected');
  });

  it('listProductionRuntime includes capability maps', () => {
    const runtime = listProductionRuntime({} as NodeJS.ProcessEnv);
    assert.ok(runtime.every((r) => r.liveReady === false));
    assert.ok(CAPABILITY_PROVIDER_MAP.read_orders?.includes('shopify-graphql-admin'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('stripe-api'));
  });
});
