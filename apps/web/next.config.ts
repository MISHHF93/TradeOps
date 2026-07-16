import type { NextConfig } from 'next';

const apiPublicUrl = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tradeops/contracts'],
  env: {
    // Expose API origin to client components for credentialed auth calls.
    NEXT_PUBLIC_API_PUBLIC_URL: apiPublicUrl,
  },
};

export default nextConfig;
