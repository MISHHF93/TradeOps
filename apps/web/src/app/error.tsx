'use client';

import { useEffect } from 'react';

/**
 * Route error boundary — recovers from stale chunk errors after rebuilds.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[TradeOps]', error);
  }, [error]);

  const chunkFail =
    /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(
      error?.message ?? '',
    );

  return (
    <section className="hero" style={{ maxWidth: 560, margin: '40px auto' }}>
      <p className="pill">Application error</p>
      <h1>{chunkFail ? 'App was updated' : 'Something went wrong'}</h1>
      <p className="lede">
        {chunkFail
          ? 'A new build is running and this tab loaded old JavaScript. Reload to continue.'
          : (error?.message ?? 'An unexpected client error occurred.')}
      </p>
      <div className="cta-row">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            if (chunkFail) {
              window.location.href = '/terminal/cockpit';
              return;
            }
            reset();
          }}
        >
          {chunkFail ? 'Reload workspace' : 'Try again'}
        </button>
        <a className="btn ghost" href="/terminal/cockpit">
          Command center
        </a>
      </div>
      {error?.digest ? <p className="meta">Digest: {error.digest}</p> : null}
    </section>
  );
}
