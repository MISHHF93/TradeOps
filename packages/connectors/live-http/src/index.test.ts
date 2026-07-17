import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  probeCredentials,
  liveSyncProvider,
  LIVE_HTTP_ADAPTER_KEYS,
} from './index';

describe('live-http adapters', () => {
  it('probeCredentials reports missing env without fabricating ready', () => {
    const r = probeCredentials('shopify-graphql-admin');
    // In CI without shopify env, not ready
    if (!process.env.SHOPIFY_ACCESS_TOKEN) {
      assert.equal(r.ready, false);
      assert.ok(r.missingKeys.length >= 1);
    }
  });

  it('liveSyncProvider never returns fabricated products without credentials', async () => {
    const prevShop = process.env.SHOPIFY_SHOP_DOMAIN;
    const prevToken = process.env.SHOPIFY_ACCESS_TOKEN;
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    delete process.env.SHOPIFY_ACCESS_TOKEN;
    const r = await liveSyncProvider('shopify-graphql-admin');
    assert.equal(r.ok, false);
    assert.equal(r.isLive, true);
    assert.match(String(r.error), /credentials_required|Missing/);
    assert.equal(r.data, undefined);
    if (prevShop) process.env.SHOPIFY_SHOP_DOMAIN = prevShop;
    if (prevToken) process.env.SHOPIFY_ACCESS_TOKEN = prevToken;
  });

  it('unknown provider with no credential map fails closed', async () => {
    const r = await liveSyncProvider('not-a-real-provider');
    assert.equal(r.ok, false);
    assert.ok(r.error);
  });

  it('new catalog adapters fail closed without credentials (never fabricate)', async () => {
    const providers = [
      'bigcommerce-rest',
      'ebay-sell',
      'paypal-rest',
      'shipstation-api',
      'keepa-api',
      'square-api',
    ] as const;
    for (const key of providers) {
      const r = await liveSyncProvider(key);
      assert.equal(r.ok, false, key);
      assert.equal(r.isLive, true, key);
      assert.equal(r.data, undefined, key);
      assert.match(String(r.error), /credentials_required|Missing|keepa requires/i, key);
    }
  });

  it('LIVE_HTTP_ADAPTER_KEYS covers all dispatch-wired providers', () => {
    assert.ok(LIVE_HTTP_ADAPTER_KEYS.includes('shopify-graphql-admin'));
    assert.ok(LIVE_HTTP_ADAPTER_KEYS.includes('bigcommerce-rest'));
    assert.ok(LIVE_HTTP_ADAPTER_KEYS.includes('ebay-sell'));
    assert.ok(LIVE_HTTP_ADAPTER_KEYS.includes('paypal-rest'));
    assert.ok(LIVE_HTTP_ADAPTER_KEYS.includes('shipstation-api'));
    assert.ok(LIVE_HTTP_ADAPTER_KEYS.includes('keepa-api'));
    assert.ok(LIVE_HTTP_ADAPTER_KEYS.includes('square-api'));
    assert.equal(LIVE_HTTP_ADAPTER_KEYS.length, 12);
  });
});
