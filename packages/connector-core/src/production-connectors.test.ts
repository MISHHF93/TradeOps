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
import { listLiveFeeds, listPlannedLiveFeeds } from './live-feed-registry';

describe('production connector catalog (union stack)', () => {
  it('registers approved local stack + production commerce/AI/industrial providers', () => {
    const list = listProductionConnectors();
    const ids = new Set(list.map((c) => c.id));
    // Local COS active stack
    for (const id of [
      'shopify-graphql-admin',
      'stripe-api',
      'easypost-api',
      'tavily-search',
      'cohere-ai',
      'google-analytics-4',
      'posthog-api',
      'sentry',
      'opentelemetry-collector',
    ]) {
      assert.ok(ids.has(id), `missing production connector ${id}`);
    }
    // Remote production catalog
    for (const id of [
      'quickbooks-online',
      'xero-api',
      'openai',
      'xai',
      'cohere',
      'open-exchange-rates',
      'avalara',
      'serpapi',
      'keepa-api',
      'sap-s4hana',
      'oracle-netsuite',
      'salsify-pim',
      'manhattan-wms',
      'taxjar',
    ]) {
      assert.ok(ids.has(id), `missing production connector ${id}`);
    }
    assert.ok(list.length >= 35);
    assert.ok(list.every((c) => c.isFixture === false));
    assert.ok(list.every((c) => c.maturity === 'operational'));
  });

  it('active live feeds include fixtures + operational only', () => {
    const feeds = listLiveFeeds();
    const keys = new Set(feeds.map((f) => f.providerKey));
    assert.ok(keys.has('shopify-graphql-admin'));
    assert.ok(keys.has('fixture-supplier'));
    assert.ok(keys.has('fixture-marketplace'));
    assert.ok(keys.has('cohere-ai'));
    assert.ok(keys.has('tavily-search'));
    assert.ok(!keys.has('openai'));
    assert.ok(!keys.has('amazon-sp-api'));
  });

  it('planned feeds never appear in active list', () => {
    const planned = listPlannedLiveFeeds();
    assert.ok(planned.some((p) => p.providerKey === 'amazon-sp-api'));
    assert.ok(planned.every((p) => p.maturity === 'planned'));
    const activeKeys = new Set(listLiveFeeds().map((f) => f.providerKey));
    for (const p of planned) {
      assert.ok(!activeKeys.has(p.providerKey));
    }
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

  it('listProductionRuntime includes capability maps for active stack', () => {
    const runtime = listProductionRuntime({} as NodeJS.ProcessEnv);
    assert.ok(CAPABILITY_PROVIDER_MAP.read_orders?.includes('shopify-graphql-admin'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('stripe-api'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('tavily-search'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('bigcommerce-rest'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('ebay-sell'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('paypal-rest'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('shipstation-api'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('keepa-api'));
    assert.ok(LIVE_HTTP_IMPLEMENTED.has('square-api'));
    // Union: master 12 + tavily-search
    assert.equal(LIVE_HTTP_IMPLEMENTED.size, 13);
  });
});
