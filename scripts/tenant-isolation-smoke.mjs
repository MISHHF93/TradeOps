#!/usr/bin/env node
/**
 * Smoke: multi-tenant isolation APIs while founder_direct stack is up.
 * Usage: node scripts/tenant-isolation-smoke.mjs
 */
const API = process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000';

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: 'application/json' },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`Tenant isolation smoke → ${API}`);

  const live = await get('/api/v1/health/live');
  assert(live.status === 200 && live.body?.status === 'up', 'API not live');

  const ctx = await get('/api/v1/tenancy/context');
  assert(ctx.status === 200, `tenancy/context HTTP ${ctx.status}`);
  assert(ctx.body?.tenantId, 'missing tenantId');
  assert(ctx.body?.membershipId, 'missing membershipId');
  assert(ctx.body?.organizationId === ctx.body?.tenantId, 'tenantId !== organizationId');
  assert(Array.isArray(ctx.body?.permissions) && ctx.body.permissions.length > 0, 'no permissions');
  console.log(
    `  context ok tenant=${ctx.body.organizationSlug || ctx.body.tenantId.slice(0, 8)} role=${ctx.body.role} ws=${ctx.body.workspaceSlug || ctx.body.workspaceId?.slice(0, 8) || '—'}`,
  );

  const workspaces = await get('/api/v1/tenancy/workspaces');
  assert(workspaces.status === 200 && Array.isArray(workspaces.body), 'workspaces failed');
  assert(workspaces.body.length >= 1, 'expected default workspace');
  assert(
    workspaces.body.every((w) => w.organizationId === ctx.body.organizationId),
    'workspace org mismatch',
  );
  console.log(`  workspaces ok count=${workspaces.body.length}`);

  const members = await get('/api/v1/tenancy/members');
  assert(members.status === 200 && Array.isArray(members.body), 'members failed');
  assert(members.body.some((m) => m.userId === ctx.body.userId), 'self not in members');
  console.log(`  members ok count=${members.body.length}`);

  const teams = await get('/api/v1/tenancy/teams');
  assert(teams.status === 200 && Array.isArray(teams.body), 'teams failed');
  console.log(`  teams ok count=${teams.body.length}`);

  // Public must not expose private tenant data
  const publicCaps = await get('/api/v1/public/capabilities');
  assert(publicCaps.status === 200, 'public capabilities failed');
  assert(!publicCaps.body?.tenantId, 'public capabilities leaked tenantId');
  console.log('  public surface ok (no tenant leak)');

  // Scanner is org-scoped (200 under founder)
  const scanner = await get('/api/v1/terminal/scanner');
  assert(scanner.status === 200, `scanner HTTP ${scanner.status}`);
  console.log('  scanner ok');

  console.log('Tenant isolation smoke PASSED');
}

main().catch((err) => {
  console.error('Tenant isolation smoke FAILED:', err.message);
  process.exit(1);
});
