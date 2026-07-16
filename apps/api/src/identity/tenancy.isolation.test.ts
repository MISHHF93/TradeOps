import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSameOrganization, roleHasPermission, TenantIsolationError } from '@tradeops/domain';

/**
 * M1 isolation contract tests.
 * Full HTTP integration requires Postgres; these lock the security rules the API enforces.
 */
describe('multi-tenant isolation contracts', () => {
  const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  it('blocks resource access across organizations', () => {
    assert.throws(() => assertSameOrganization(orgA, orgB), TenantIsolationError);
  });

  it('allows access within the same organization', () => {
    assert.doesNotThrow(() => assertSameOrganization(orgA, orgA));
  });

  it('viewer cannot write members', () => {
    assert.equal(roleHasPermission('viewer', 'members:write'), false);
    assert.equal(roleHasPermission('owner', 'members:write'), true);
  });

  it('developer lacks product write', () => {
    assert.equal(roleHasPermission('developer', 'products:write'), false);
    assert.equal(roleHasPermission('developer', 'developer:write'), true);
  });
});
