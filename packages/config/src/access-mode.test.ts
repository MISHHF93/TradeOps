import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FOUNDER_DIRECT_DEFAULTS,
  founderDirectPublicWarning,
  getAccessMode,
  isDirectIdentityEnabled,
  isFounderDirectAccess,
  isLikelyPublicDeployment,
  parseAccessMode,
} from './access-mode';

describe('access mode', () => {
  it('defaults to founder_direct', () => {
    assert.equal(parseAccessMode(undefined), 'founder_direct');
    assert.equal(parseAccessMode(''), 'founder_direct');
    assert.equal(getAccessMode({}), 'founder_direct');
  });

  it('parses authenticated and multi_tenant', () => {
    assert.equal(parseAccessMode('authenticated'), 'authenticated');
    assert.equal(parseAccessMode('multi-tenant'), 'multi_tenant');
    assert.equal(parseAccessMode('saas'), 'multi_tenant');
  });

  it('founder_direct enables identity without AUTH_BYPASS even in production', () => {
    assert.equal(
      isDirectIdentityEnabled({
        TRADEOPS_ACCESS_MODE: 'founder_direct',
        AUTH_BYPASS: false,
        NODE_ENV: 'production',
      }),
      true,
    );
  });

  it('legacy AUTH_BYPASS is development-only when not founder_direct', () => {
    assert.equal(
      isDirectIdentityEnabled({
        TRADEOPS_ACCESS_MODE: 'authenticated',
        AUTH_BYPASS: true,
        NODE_ENV: 'production',
      }),
      false,
    );
    assert.equal(
      isDirectIdentityEnabled({
        TRADEOPS_ACCESS_MODE: 'authenticated',
        AUTH_BYPASS: true,
        NODE_ENV: 'development',
      }),
      true,
    );
  });

  it('detects public deployment for warning', () => {
    assert.equal(isLikelyPublicDeployment({ WEB_ORIGIN: 'http://localhost:3000' }), false);
    assert.equal(
      isLikelyPublicDeployment({ WEB_ORIGIN: 'https://tradeops.example.com' }),
      true,
    );
    const warn = founderDirectPublicWarning({
      TRADEOPS_ACCESS_MODE: 'founder_direct',
      WEB_ORIGIN: 'https://app.example.com',
    });
    assert.match(String(warn), /Direct Founder Access is enabled/);
    assert.equal(
      founderDirectPublicWarning({
        TRADEOPS_ACCESS_MODE: 'founder_direct',
        WEB_ORIGIN: 'http://127.0.0.1:3000',
      }),
      null,
    );
  });

  it('exports deterministic founder defaults', () => {
    assert.equal(FOUNDER_DIRECT_DEFAULTS.email, 'founder@tradeops.local');
    assert.equal(FOUNDER_DIRECT_DEFAULTS.organizationSlug, 'demo-commerce');
    assert.ok(isFounderDirectAccess({ TRADEOPS_ACCESS_MODE: 'founder_direct' }));
  });
});
