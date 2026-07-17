import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertSameOrganization,
  assertSameTenant,
  assertTenantAccess,
  buildTenantContext,
  roleHasPermission,
  tenantCacheKey,
  tenantWhere,
  TenantIsolationError,
} from '@tradeops/domain';

/**
 * Production multi-tenant isolation contracts.
 * Full HTTP integration requires Postgres; these lock the security rules the API enforces.
 */
describe('multi-tenant isolation contracts', () => {
  const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  it('blocks resource access across organizations', () => {
    assert.throws(() => assertSameOrganization(orgA, orgB), TenantIsolationError);
    assert.throws(() => assertSameTenant(orgA, orgB), TenantIsolationError);
  });

  it('allows access within the same organization', () => {
    assert.doesNotThrow(() => assertSameOrganization(orgA, orgA));
  });

  it('builds membership-scoped tenant context (no global user role)', () => {
    const ctx = buildTenantContext({
      userId: '11111111-1111-4111-8111-111111111111',
      tenantId: orgA,
      membershipId: '22222222-2222-4222-8222-222222222222',
      role: 'manager',
      workspaceId: '33333333-3333-4333-8333-333333333333',
    });
    assert.equal(ctx.tenantId, orgA);
    assert.equal(ctx.organizationId, orgA);
    assert.equal(ctx.role, 'manager');
    assert.ok(ctx.permissions.includes('products:write'));
    assert.throws(() => assertTenantAccess(orgB, ctx), TenantIsolationError);
  });

  it('tenant where helper requires org id', () => {
    assert.deepEqual(tenantWhere(orgA), { organizationId: orgA });
    assert.throws(() => tenantWhere(null), TenantIsolationError);
  });

  it('cache keys are tenant-prefixed', () => {
    assert.match(tenantCacheKey(orgA, 'rag'), new RegExp(orgA));
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
