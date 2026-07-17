'use client';

/**
 * Root error boundary (must include html/body).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#0b0f14',
          color: '#e8eef5',
          padding: 40,
        }}
      >
        <h1 style={{ fontSize: '1.25rem' }}>TradeOps failed to load</h1>
        <p style={{ opacity: 0.85 }}>{error?.message ?? 'Unknown error'}</p>
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
          If you just rebuilt the app, hard-refresh (Ctrl+Shift+R) or clear the tab cache.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/terminal/cockpit';
          }}
          style={{
            marginTop: 16,
            padding: '8px 14px',
            background: '#3b82f6',
            color: '#fff',
            border: 0,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Reload workspace
        </button>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            marginLeft: 8,
            padding: '8px 14px',
            background: 'transparent',
            color: '#e8eef5',
            border: '1px solid #334',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
