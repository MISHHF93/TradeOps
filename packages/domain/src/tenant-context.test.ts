import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertTenantAccess,
  buildTenantContext,
  resolveEffectivePermissions,
  tenantHasPermission,
} from './tenant-context';
import { tenantCacheKey, tenantKey, tenantStoragePath } from './tenant-keys';
import { TenantIsolationError } from './tenancy';

describe('TenantContext', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  it('builds validated tenant context from membership fields', () => {
    const ctx = buildTenantContext({
      userId: 'u1',
      tenantId,
      membershipId: 'm1',
      role: 'owner',
      featureFlags: { industrial: true, beta: false },
      subscriptionPlan: 'growth',
      subscriptionStatus: 'active',
    });
    assert.equal(ctx.tenantId, tenantId);
    assert.equal(ctx.organizationId, tenantId);
    assert.equal(ctx.membershipId, 'm1');
    assert.ok(ctx.permissions.includes('org:write'));
    assert.deepEqual(ctx.featureFlags, ['industrial']);
  });

  it('rejects missing tenant or membership', () => {
    assert.throws(
      () =>
        buildTenantContext({
          userId: 'u1',
          tenantId: null,
          membershipId: 'm1',
          role: 'viewer',
        }),
      TenantIsolationError,
    );
    assert.throws(
      () =>
        buildTenantContext({
          userId: 'u1',
          tenantId,
          membershipId: null,
          role: 'viewer',
        }),
      TenantIsolationError,
    );
  });

  it('enforces resource tenant isolation', () => {
    const ctx = buildTenantContext({
      userId: 'u1',
      tenantId,
      membershipId: 'm1',
      role: 'admin',
    });
    assert.doesNotThrow(() => assertTenantAccess(tenantId, ctx));
    assert.throws(() => assertTenantAccess(other, ctx), TenantIsolationError);
  });

  it('applies allow/deny overrides with deny wins', () => {
    const perms = resolveEffectivePermissions({
      base: ['products:read', 'products:write'] as never,
      allows: ['ai:write'],
      denies: ['products:write'],
    });
    assert.ok(perms.includes('products:read' as never));
    assert.ok(perms.includes('ai:write' as never));
    assert.ok(!perms.includes('products:write' as never));
  });

  it('checks permission helper', () => {
    const ctx = buildTenantContext({
      userId: 'u1',
      tenantId,
      membershipId: 'm1',
      role: 'viewer',
    });
    assert.equal(tenantHasPermission(ctx, 'products:read'), true);
    assert.equal(tenantHasPermission(ctx, 'members:write'), false);
  });
});

describe('tenant keys', () => {
  const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('prefixes cache and storage keys with tenant id', () => {
    assert.equal(tenantKey(tenantId, 'rag', 'index'), `t:${tenantId}:rag:index`);
    assert.equal(tenantCacheKey(tenantId, 'intelligence', 'home'), `t:${tenantId}:cache:intelligence:home`);
    assert.equal(tenantStoragePath(tenantId, 'rag', 'index.json'), `${tenantId}/rag/index.json`);
  });

  it('rejects blank tenant in keys', () => {
    assert.throws(() => tenantKey(null, 'x'), TenantIsolationError);
  });
});
