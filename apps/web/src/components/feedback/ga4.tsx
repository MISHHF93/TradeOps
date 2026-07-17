'use client';

import Script from 'next/script';

/**
 * Optional GA4 — env-gated, public marketing only.
 * Never loads without NEXT_PUBLIC_GA4_ENABLED=true and a measurement ID.
 * Does not send private merchant/PII data (page path only via default gtag config).
 *
 * @see docs/TRADEOPS_GA4.md
 */
export function Ga4Analytics() {
  const enabled =
    process.env.NEXT_PUBLIC_GA4_ENABLED === 'true' || process.env.NEXT_PUBLIC_GA4_ENABLED === '1';
  const id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
  if (!enabled || !id) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', {
            anonymize_ip: true,
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}
