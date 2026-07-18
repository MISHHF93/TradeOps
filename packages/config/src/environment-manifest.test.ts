import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLATFORM_ENV_MANIFEST,
  TENANT_SCOPED_CREDENTIAL_NAMES,
  environmentManifestPublicStatus,
  listRequiredProductionEnv,
} from './environment-manifest';
import { FINANCIAL_GATE_ENV_NAMES } from './financial-gates';

describe('environment manifest', () => {
  it('has unique names', () => {
    const names = PLATFORM_ENV_MANIFEST.map((v) => v.name);
    assert.equal(names.length, new Set(names).size);
  });

  it('never marks secrets as browser-public storage incorrectly', () => {
    for (const v of PLATFORM_ENV_MANIFEST) {
      if (v.secret) {
        assert.notEqual(v.storage, 'browser_public', v.name);
        assert.equal(v.serverOnly, true, v.name);
      }
    }
  });

  it('requires COHERE_API_KEY in production list', () => {
    assert.ok(listRequiredProductionEnv().includes('COHERE_API_KEY'));
  });

  it('public status never includes secret values', () => {
    const s = environmentManifestPublicStatus({
      NODE_ENV: 'development',
      COHERE_API_KEY: 'super-secret-should-not-appear',
      AI_PROVIDER: 'cohere',
    });
    const json = JSON.stringify(s);
    assert.ok(!json.includes('super-secret-should-not-appear'));
    assert.equal(s.ai.cohereKeyConfigured, true);
    assert.equal(s.ai.provider, 'cohere');
  });

  it('lists tenant-scoped credential names', () => {
    assert.ok(TENANT_SCOPED_CREDENTIAL_NAMES.includes('SHOPIFY_ACCESS_TOKEN'));
    assert.ok(TENANT_SCOPED_CREDENTIAL_NAMES.includes('EASYPOST_API_KEY'));
    assert.ok(TENANT_SCOPED_CREDENTIAL_NAMES.includes('AMAZON_SP_CLIENT_SECRET'));
  });

  it('includes every FinancialGateKey env name', () => {
    const names = new Set(PLATFORM_ENV_MANIFEST.map((v) => v.name));
    for (const gate of FINANCIAL_GATE_ENV_NAMES) {
      assert.ok(names.has(gate), `missing financial gate ${gate}`);
    }
  });

  it('covers live-http commerce probe credentials in vault list', () => {
    for (const key of [
      'SHOPIFY_ACCESS_TOKEN',
      'WOOCOMMERCE_CONSUMER_SECRET',
      'PAYPAL_CLIENT_SECRET',
      'SERPAPI_API_KEY',
      'FEDEX_CLIENT_ID',
    ] as const) {
      assert.ok(
        (TENANT_SCOPED_CREDENTIAL_NAMES as readonly string[]).includes(key),
        key,
      );
    }
  });
});
