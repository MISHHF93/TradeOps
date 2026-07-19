'use client';

import { useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';

/**
 * Once per product session: bootstrap media artifacts if none exist.
 * Silent / best-effort — does not block the page.
 */
export function AutoBootstrapMedia({
  productId,
  enabled = true,
}: {
  productId: string;
  enabled?: boolean;
}) {
  const ran = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'skip' | 'error'>('idle');

  useEffect(() => {
    if (!enabled || !productId || ran.current) return;
    ran.current = true;

    const key = `tradeops.media.bootstrap.${productId}`;
    try {
      if (sessionStorage.getItem(key) === '1') {
        setStatus('skip');
        return;
      }
    } catch {
      /* ignore */
    }

    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const listRes = await fetch(
          `${getApiBaseUrl()}/api/v1/products/${productId}/artifacts`,
          { credentials: 'include', headers: { Accept: 'application/json' } },
        );
        if (!listRes.ok) {
          if (!cancelled) setStatus('error');
          return;
        }
        const body = (await listRes.json()) as { artifacts?: unknown[] };
        if ((body.artifacts?.length ?? 0) > 0) {
          try {
            sessionStorage.setItem(key, '1');
          } catch {
            /* ignore */
          }
          if (!cancelled) setStatus('skip');
          return;
        }

        const boot = await fetch(
          `${getApiBaseUrl()}/api/v1/products/${productId}/artifacts/bootstrap`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          },
        );
        if (!boot.ok) {
          if (!cancelled) setStatus('error');
          return;
        }
        try {
          sessionStorage.setItem(key, '1');
        } catch {
          /* ignore */
        }
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, enabled]);

  if (status !== 'loading' && status !== 'done') return null;

  return (
    <p className="meta auto-bootstrap-media" role="status">
      {status === 'loading'
        ? 'Loading product media from sources…'
        : 'Media assets discovered and attached to this product.'}
    </p>
  );
}
