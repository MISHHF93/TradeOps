import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { organizationSchema, permissionSchema, systemRoleSchema } from './identity';

describe('identity contracts', () => {
  it('accepts a valid organization payload', () => {
    const result = organizationSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Acme Commerce',
      slug: 'acme-commerce',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(result.success, true);
  });

  it('rejects invalid organization slugs', () => {
    const result = organizationSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Acme',
      slug: 'Acme_Commerce',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(result.success, false);
  });

  it('exposes a non-empty permission and role catalog', () => {
    assert.ok(permissionSchema.options.length > 5);
    assert.ok(systemRoleSchema.options.includes('owner'));
  });
});
