import type { Metadata } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export function publicPageMeta(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE.replace(/\/$/, '')}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${input.title} · TradeOps`,
      description: input.description,
      url,
      siteName: 'TradeOps',
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
}

export const noIndexMeta: Metadata = {
  robots: { index: false, follow: false },
};
