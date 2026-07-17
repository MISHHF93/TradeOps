/**
 * Stripe webhook signature verification without the Stripe SDK
 * (compatible with Windows App Control hosts).
 * Spec: https://docs.stripe.com/webhooks/signatures
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | undefined;
  secret: string;
  toleranceSeconds?: number;
}): { ok: true; timestamp: number } | { ok: false; reason: string } {
  if (!input.signatureHeader?.trim()) {
    return { ok: false, reason: 'Missing Stripe-Signature header' };
  }
  if (!input.secret.trim()) {
    return { ok: false, reason: 'STRIPE_WEBHOOK_SECRET not configured' };
  }

  const parts = Object.fromEntries(
    input.signatureHeader.split(',').map((p) => {
      const [k, ...rest] = p.split('=');
      return [k?.trim() ?? '', rest.join('=').trim()];
    }),
  );
  const timestamp = Number(parts.t);
  const v1 = parts.v1;
  if (!timestamp || !v1) {
    return { ok: false, reason: 'Malformed Stripe-Signature header' };
  }

  const tolerance = input.toleranceSeconds ?? 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return { ok: false, reason: 'Stripe webhook timestamp outside tolerance (replay protection)' };
  }

  const signedPayload = `${timestamp}.${input.rawBody}`;
  const expected = createHmac('sha256', input.secret).update(signedPayload, 'utf8').digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(v1, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'Invalid Stripe webhook signature' };
    }
  } catch {
    return { ok: false, reason: 'Signature comparison failed' };
  }

  return { ok: true, timestamp };
}

export function redactSecrets(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/sk_live|sk_test|whsec_|rk_live|rk_test/i.test(value)) return '[REDACTED]';
    return value;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/secret|password|card|cvv|cvc|pan|token/i.test(k) && typeof v === 'string') {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}
