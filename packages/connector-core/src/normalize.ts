/**
 * Canonical payload normalization — external webhook/poll payloads → business events.
 * Business logic must not consume raw vendor shapes.
 */

import type { OpsBusinessEvent } from './ops-center';

export type NormalizedBusPayload = {
  eventType: OpsBusinessEvent | string;
  canonical: Record<string, unknown>;
  confidence: number;
  isFixture: boolean;
  providerKey: string;
  topic: string;
  rawRef?: string;
};

export type NormalizeInput = {
  providerKey: string;
  topic: string;
  raw: Record<string, unknown>;
  isFixture?: boolean;
};

/**
 * Map provider+topic+raw body into a standardized bus event + canonical fragment.
 */
export function normalizeExternalPayload(input: NormalizeInput): NormalizedBusPayload {
  const providerKey = input.providerKey;
  const topic = (input.topic || 'unknown').toLowerCase();
  const raw = input.raw ?? {};
  const isFixture =
    Boolean(input.isFixture) ||
    providerKey.startsWith('fixture') ||
    raw.isFixture === true ||
    raw.__fixture === true;

  // Orders (fixture marketplace + generic)
  if (
    topic.includes('order') ||
    topic.includes('orders/create') ||
    raw.type === 'order' ||
    raw.order != null ||
    (raw.externalId != null && raw.totalMinor != null)
  ) {
    const order = (raw.order as Record<string, unknown>) ?? raw;
    return {
      eventType: 'OrderCreated',
      canonical: {
        kind: 'order',
        externalId: String(order.externalId ?? order.id ?? raw.id ?? `ord-${Date.now()}`),
        status: String(order.status ?? 'paid'),
        currency: String(order.currency ?? 'USD'),
        totalMinor: Number(order.totalMinor ?? order.total_minor ?? order.amount ?? 0),
        lines: Array.isArray(order.lines) ? order.lines : [],
        sourcePlatform: providerKey,
        placedAt: String(order.placedAt ?? order.created_at ?? new Date().toISOString()),
      },
      confidence: isFixture ? 0.95 : 0.7,
      isFixture,
      providerKey,
      topic,
    };
  }

  if (topic.includes('inventory') || raw.type === 'inventory') {
    return {
      eventType: 'InventoryChanged',
      canonical: {
        kind: 'inventory',
        externalSku: String(raw.sku ?? raw.externalSku ?? raw.id ?? 'unknown'),
        quantity: Number(raw.quantity ?? raw.available ?? 0),
        sourcePlatform: providerKey,
      },
      confidence: 0.75,
      isFixture,
      providerKey,
      topic,
    };
  }

  // Payments (Stripe-shaped or explicit)
  if (
    providerKey.includes('stripe') ||
    providerKey.includes('paypal') ||
    topic.includes('payment') ||
    topic.includes('charge') ||
    String(raw.type ?? '').includes('payment') ||
    String(raw.type ?? '').includes('charge')
  ) {
    const failed =
      topic.includes('fail') ||
      String(raw.type ?? '').includes('failed') ||
      raw.status === 'failed';
    return {
      eventType: failed ? 'PaymentFailed' : 'WebhookReceived',
      canonical: {
        kind: 'payment',
        externalId: String(raw.id ?? raw.payment_intent ?? `pay-${Date.now()}`),
        status: failed ? 'failed' : String(raw.status ?? 'captured'),
        amountMinor: Number(raw.amount ?? raw.amount_received ?? 0),
        currency: String(raw.currency ?? 'USD').toUpperCase(),
        sourcePlatform: providerKey,
      },
      confidence: 0.8,
      isFixture,
      providerKey,
      topic,
    };
  }

  if (topic.includes('shipment') || topic.includes('fulfill') || raw.type === 'shipment') {
    const delayed =
      topic.includes('delay') || raw.status === 'exception' || raw.status === 'delayed';
    return {
      eventType: delayed ? 'ShipmentDelayed' : 'WebhookReceived',
      canonical: {
        kind: 'shipment',
        externalId: String(raw.id ?? raw.tracking ?? `ship-${Date.now()}`),
        status: String(raw.status ?? 'in_transit'),
        trackingNumber: raw.trackingNumber ?? raw.tracking ?? null,
        sourcePlatform: providerKey,
      },
      confidence: 0.7,
      isFixture,
      providerKey,
      topic,
    };
  }

  if (topic.includes('listing') || topic.includes('product/publish')) {
    return {
      eventType: 'ListingPublished',
      canonical: {
        kind: 'listing',
        externalId: String(raw.id ?? raw.listingId ?? `lst-${Date.now()}`),
        status: String(raw.status ?? 'active'),
        sourcePlatform: providerKey,
      },
      confidence: 0.75,
      isFixture,
      providerKey,
      topic,
    };
  }

  if (topic.includes('disconnect') || topic.includes('app/uninstalled')) {
    return {
      eventType: 'ConnectorDisconnected',
      canonical: {
        kind: 'connector',
        providerKey,
        reason: String(raw.reason ?? topic),
      },
      confidence: 0.9,
      isFixture,
      providerKey,
      topic,
    };
  }

  // Never drop: pass-through as WebhookReceived
  return {
    eventType: 'WebhookReceived',
    canonical: {
      kind: 'unknown',
      providerKey,
      topic,
      keys: Object.keys(raw).slice(0, 20),
    },
    confidence: 0.4,
    isFixture,
    providerKey,
    topic,
    rawRef: 'bodyJson',
  };
}

export function buildIdempotencyKey(
  organizationId: string,
  providerKey: string,
  topic: string,
  raw: Record<string, unknown>,
): string {
  const ext =
    typeof raw.id === 'string'
      ? raw.id
      : typeof raw.event_id === 'string'
        ? raw.event_id
        : typeof raw.externalId === 'string'
          ? raw.externalId
          : null;
  if (ext) return `${organizationId}:${providerKey}:${topic}:${ext}`;
  const slice = JSON.stringify(raw).slice(0, 200);
  let h = 0;
  for (let i = 0; i < slice.length; i++) h = (h * 31 + slice.charCodeAt(i)) | 0;
  return `${organizationId}:${providerKey}:${topic}:h${Math.abs(h)}`;
}
