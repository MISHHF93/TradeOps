/**
 * Tenant-scoped keys for cache, queues, files, RAG, metrics, and notifications.
 * Always include tenantId (organizationId) as the first isolation segment.
 */

import { requireOrganizationId, TenantIsolationError } from './tenancy';

const SEP = ':';

function seg(value: string): string {
  return value.replace(/[:\s]/g, '_');
}

export function tenantKey(tenantId: string | null | undefined, ...parts: string[]): string {
  const id = requireOrganizationId(tenantId);
  return ['t', seg(id), ...parts.map(seg)].join(SEP);
}

export function tenantCacheKey(
  tenantId: string | null | undefined,
  namespace: string,
  ...parts: string[]
): string {
  return tenantKey(tenantId, 'cache', namespace, ...parts);
}

export function tenantRagIndexKey(tenantId: string | null | undefined): string {
  return tenantKey(tenantId, 'rag', 'index');
}

export function tenantQueueJobKey(
  tenantId: string | null | undefined,
  queue: string,
  jobId: string,
): string {
  return tenantKey(tenantId, 'queue', queue, jobId);
}

export function tenantMetricLabels(tenantId: string | null | undefined): {
  tenant_id: string;
} {
  return { tenant_id: requireOrganizationId(tenantId) };
}

export function tenantStoragePath(
  tenantId: string | null | undefined,
  ...segments: string[]
): string {
  const id = requireOrganizationId(tenantId);
  return [id, ...segments.map(seg)].join('/');
}

export function tenantNotificationChannel(
  tenantId: string | null | undefined,
  channel: string,
): string {
  return tenantKey(tenantId, 'notify', channel);
}

/**
 * Standard job payload envelope for queues/workers.
 * Every background job that touches merchant data must include organizationId.
 */
export type TenantJobPayload<T extends Record<string, unknown> = Record<string, unknown>> = {
  organizationId: string;
  workspaceId?: string;
  userId?: string;
  traceId?: string;
  data: T;
};

export function buildTenantJobPayload<T extends Record<string, unknown>>(
  organizationId: string | null | undefined,
  data: T,
  meta?: { workspaceId?: string; userId?: string; traceId?: string },
): TenantJobPayload<T> {
  return {
    organizationId: requireOrganizationId(organizationId),
    workspaceId: meta?.workspaceId,
    userId: meta?.userId,
    traceId: meta?.traceId,
    data,
  };
}

export function assertTenantJobPayload(
  payload: unknown,
): asserts payload is TenantJobPayload {
  if (!payload || typeof payload !== 'object') {
    throw new TenantIsolationError('Job payload missing');
  }
  const p = payload as TenantJobPayload;
  requireOrganizationId(p.organizationId);
}
