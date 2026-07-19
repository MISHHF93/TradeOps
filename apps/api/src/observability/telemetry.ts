/**
 * Honest observability hooks — OTel-ready, no fake green dashboards.
 * When OTEL_EXPORTER_OTLP_ENDPOINT is unset, metrics stay in-process counters.
 */

import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

const log = new Logger('Telemetry');

const counters: Record<string, number> = {
  webhooks_received: 0,
  webhooks_failed: 0,
  capability_resolve: 0,
  connector_probe: 0,
};

export function recordOpsMetric(name: keyof typeof counters | string, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function getOpsMetrics(): Record<string, number> {
  return { ...counters };
}

export function newTraceId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

export function opsLog(
  message: string,
  fields?: {
    traceId?: string;
    commerceCaseId?: string;
    providerKey?: string;
    eventType?: string;
    /** Canonical tenant id (= organizationId) */
    organizationId?: string;
    tenantId?: string;
    workspaceId?: string;
  },
): void {
  const tenant = fields?.tenantId ?? fields?.organizationId;
  const parts = [
    message,
    fields?.traceId ? `trace=${fields.traceId}` : null,
    tenant ? `tenant=${tenant.slice(0, 8)}` : null,
    fields?.workspaceId ? `ws=${fields.workspaceId.slice(0, 8)}` : null,
    fields?.commerceCaseId ? `case=${fields.commerceCaseId.slice(0, 8)}` : null,
    fields?.providerKey ? `provider=${fields.providerKey}` : null,
    fields?.eventType ? `event=${fields.eventType}` : null,
  ].filter(Boolean);
  log.log(parts.join(' '));
}

/** Tenant-dimension metric label helper for future OTel export. */
export function tenantMetricDims(organizationId: string | null | undefined): {
  tenant_id: string;
} | Record<string, never> {
  if (!organizationId) return {};
  return { tenant_id: organizationId };
}

/**
 * Optional OTLP bootstrap note — full SDK is deploy-time.
 * Avoid hard dependency on @opentelemetry/* for local PGlite installs.
 */
export function describeTelemetryConfig(): {
  otlpEndpoint: string | null;
  mode: 'noop_local' | 'otlp_configured';
  metrics: Record<string, number>;
  note: string;
} {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || null;
  return {
    otlpEndpoint: endpoint,
    mode: endpoint ? 'otlp_configured' : 'noop_local',
    metrics: getOpsMetrics(),
    note: endpoint
      ? 'OTLP endpoint set — wire NodeSDK in deploy image for full traces.'
      : 'No OTEL_EXPORTER_OTLP_ENDPOINT — using in-process metrics + structured logs only.',
  };
}
