import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLATFORM_ENV_MANIFEST,
  TENANT_SCOPED_CREDENTIAL_NAMES,
  environmentManifestPublicStatus,
  listRequiredProductionEnv,
} from './environment-manifest';

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
  });
});
