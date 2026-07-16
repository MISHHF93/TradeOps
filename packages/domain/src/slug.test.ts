import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidOrganizationSlug, slugifyOrganizationName } from './slug';
import { roleHasPermission } from './rbac';
import { assertSameOrganization, TenantIsolationError } from './tenancy';

describe('slugifyOrganizationName', () => {
  it('normalizes names into slugs', () => {
    assert.equal(slugifyOrganizationName('  Acme Commerce Co. '), 'acme-commerce-co');
  });
});

describe('isValidOrganizationSlug', () => {
  it('accepts canonical slugs', () => {
    assert.equal(isValidOrganizationSlug('acme-commerce'), true);
  });

  it('rejects uppercase and underscores', () => {
    assert.equal(isValidOrganizationSlug('Acme_Commerce'), false);
  });
});

describe('roleHasPermission', () => {
  it('grants owners settings write', () => {
    assert.equal(roleHasPermission('owner', 'settings:write'), true);
  });

  it('denies viewers write access', () => {
    assert.equal(roleHasPermission('viewer', 'products:write'), false);
  });
});

describe('assertSameOrganization', () => {
  it('allows matching tenant context', () => {
    assert.doesNotThrow(() =>
      assertSameOrganization(
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
      ),
    );
  });

  it('blocks cross-tenant access', () => {
    assert.throws(
      () =>
        assertSameOrganization(
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ),
      TenantIsolationError,
    );
  });
});
