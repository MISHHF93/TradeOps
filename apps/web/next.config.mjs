/** @type {import('next').NextConfig} */
const apiPublicUrl = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:4000';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tradeops/contracts'],
  env: {
    // Expose API origin to client components for credentialed auth calls.
    NEXT_PUBLIC_API_PUBLIC_URL: apiPublicUrl,
  },
  /**
   * Consolidate legacy / redundant routes into the persona + process spine.
   * Source of truth for ownership: packages/commerce-engine ROUTE_OWNERSHIP.
   */
  async redirects() {
    return [
      { source: '/scanner', destination: '/terminal', permanent: false },
      { source: '/signup', destination: '/register', permanent: false },
      { source: '/terminal/pipeline', destination: '/terminal/process', permanent: false },
      { source: '/terminal/cockpit', destination: '/terminal/workspace/executive', permanent: false },
      {
        source: '/terminal/control-tower',
        destination: '/terminal/workspace/executive',
        permanent: false,
      },
      {
        source: '/terminal/finance',
        destination: '/terminal/finance/reconciliation',
        permanent: false,
      },
      // AI Operator is the right rail — full page duplicates the rail
      {
        source: '/terminal/ai',
        destination: '/terminal/objectives',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
