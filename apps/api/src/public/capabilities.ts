/**
 * Launch-ready capability registry.
 * Every primary surface action is classified honestly for public launch.
 *
 * operational          — end-to-end wired, executable now
 * approval_controlled  — runs then requires human approval for consequence
 * credential_blocked   — code path exists; live external API needs credentials
 * coming_soon          — designed, not fully wired
 * administrative       — ops/dev only
 * unsupported          — intentionally not offered
 */

export type CapabilityStatus =
  | 'operational'
  | 'approval_controlled'
  | 'credential_blocked'
  | 'coming_soon'
  | 'administrative'
  | 'unsupported';

export type CapabilityEntry = {
  id: string;
  surface: 'public' | 'app' | 'api';
  name: string;
  path: string;
  status: CapabilityStatus;
  description: string;
  evidence: string;
};

export function listCapabilities(input?: {
  hasGoogleCredentials?: boolean;
  authBypass?: boolean;
  redisUp?: boolean;
}): CapabilityEntry[] {
  const hasGoogle = Boolean(input?.hasGoogleCredentials);
  const authBypass = Boolean(input?.authBypass);

  return [
    // Public
    {
      id: 'public.landing',
      surface: 'public',
      name: 'Public landing',
      path: '/',
      status: 'operational',
      description: 'Marketing home explaining TradeOps value and entry points.',
      evidence: 'apps/web/src/app/page.tsx',
    },
    {
      id: 'public.tools.profit',
      surface: 'public',
      name: 'Unit economics calculator',
      path: '/tools/profit',
      status: 'operational',
      description: 'Same commerce-engine math as terminal; no private store data.',
      evidence: 'POST /api/v1/public/tools/unit-economics',
    },
    {
      id: 'public.tools.score',
      surface: 'public',
      name: 'Opportunity score',
      path: '/tools/score',
      status: 'operational',
      description: 'Explainable 0–100 score.',
      evidence: 'POST /api/v1/public/tools/opportunity-score',
    },
    {
      id: 'public.tools.policy',
      surface: 'public',
      name: 'Policy gate',
      path: '/tools/policy',
      status: 'operational',
      description: 'Fail-closed restricted-category check.',
      evidence: 'POST /api/v1/public/tools/policy-check',
    },
    {
      id: 'public.register',
      surface: 'public',
      name: 'Merchant registration',
      path: '/register',
      status: 'operational',
      description: 'Creates user + organization + session cookie via API.',
      evidence: 'POST /api/v1/auth/register',
    },
    {
      id: 'public.login',
      surface: 'public',
      name: 'Sign in',
      path: '/login',
      status: 'operational',
      description: 'Session cookie auth against hashed passwords.',
      evidence: 'POST /api/v1/auth/login',
    },
    {
      id: 'public.capabilities',
      surface: 'public',
      name: 'Capability status matrix',
      path: '/status',
      status: 'operational',
      description: 'Public honesty board for what is operational vs blocked.',
      evidence: 'GET /api/v1/public/capabilities',
    },

    // App — terminal
    {
      id: 'app.scanner',
      surface: 'app',
      name: 'Market scanner',
      path: '/terminal',
      status: 'operational',
      description: 'Canonical opportunities with scores and signals.',
      evidence: 'GET /api/v1/terminal/scanner',
    },
    {
      id: 'app.ai.operator',
      surface: 'app',
      name: 'AI operator',
      path: '/terminal/ai',
      status: 'approval_controlled',
      description: 'Typed tools + critic/auditor; drafts go to approval queue. Shadow by default.',
      evidence: 'POST /api/v1/ai/operator/run',
    },
    {
      id: 'app.pipeline',
      surface: 'app',
      name: 'Commerce pipeline board',
      path: '/terminal/pipeline',
      status: 'operational',
      description: 'Stage counts from real DB rows.',
      evidence: 'GET /api/v1/terminal/pipeline',
    },
    {
      id: 'app.approvals',
      surface: 'app',
      name: 'Approval queue',
      path: '/terminal/approvals',
      status: 'operational',
      description: 'Human approve/reject for listings and POs.',
      evidence: 'POST /api/v1/approvals/:id/decide',
    },
    {
      id: 'app.orders',
      surface: 'app',
      name: 'Orders',
      path: '/terminal/orders',
      status: 'operational',
      description: 'Customer orders from DB; fixture ingest labeled.',
      evidence: 'GET /api/v1/orders',
    },
    {
      id: 'app.portfolio',
      surface: 'app',
      name: 'Portfolio risk',
      path: '/terminal/portfolio',
      status: 'operational',
      description: 'Aggregated contribution exposure from opportunities.',
      evidence: 'GET /api/v1/terminal/portfolio',
    },
    {
      id: 'app.cashflow',
      surface: 'app',
      name: 'Cash flow',
      path: '/terminal/cashflow',
      status: 'operational',
      description: 'Cash-before-payout estimates from unit economics.',
      evidence: 'commerce portfolio/cash views',
    },
    {
      id: 'app.connectors',
      surface: 'app',
      name: 'Connector registry',
      path: '/terminal/connectors',
      status: 'operational',
      description: 'Installations with fixture vs live-capable labels.',
      evidence: 'GET /api/v1/connectors',
    },
    {
      id: 'app.fixture.loop',
      surface: 'app',
      name: 'Fixture development loop',
      path: '/terminal',
      status: 'administrative',
      description: 'Full vertical slice using fixture connectors only — not live marketplaces.',
      evidence: 'POST /api/v1/terminal/demo-loop',
    },
    {
      id: 'app.google.weekend',
      surface: 'app',
      name: 'Weekend Google feed automation',
      path: '/terminal/automations',
      status: hasGoogle ? 'credential_blocked' : 'credential_blocked',
      description: hasGoogle
        ? 'Credentials present; live HTTP Content API client still not fully enabled — shadow prepare operational.'
        : 'Shadow feed prepare operational. Live post requires GOOGLE_MERCHANT_* OAuth.',
      evidence: 'POST /api/v1/automation/google/weekend/prepare',
    },
    {
      id: 'app.harmonize',
      surface: 'app',
      name: 'Product identity resolution',
      path: '/terminal/ai',
      status: 'operational',
      description: 'Confidence-scored matching; never auto-merge on title alone.',
      evidence: 'POST /api/v1/ai/harmonize',
    },

    // Live connectors
    {
      id: 'connector.shopify',
      surface: 'api',
      name: 'Shopify GraphQL Admin',
      path: 'registry:shopify-graphql-admin',
      status: 'credential_blocked',
      description: 'Registry + contracts ready. Needs authorized app + OAuth for live.',
      evidence: 'live-feed-registry + connector boundary',
    },
    {
      id: 'connector.amazon',
      surface: 'api',
      name: 'Amazon SP-API',
      path: 'registry:amazon-sp-api',
      status: 'credential_blocked',
      description: 'Requires seller authorization and SP-API roles.',
      evidence: 'live-feed-registry',
    },
    {
      id: 'connector.ebay',
      surface: 'api',
      name: 'eBay Sell APIs',
      path: 'registry:ebay-sell',
      status: 'credential_blocked',
      description: 'Inventory/orders/fulfillment path planned; needs OAuth.',
      evidence: 'live-feed-registry',
    },
    {
      id: 'connector.aliexpress',
      surface: 'api',
      name: 'AliExpress Dropshipping',
      path: 'registry:aliexpress-dropshipping',
      status: 'credential_blocked',
      description: 'Supplier path planned; authorized accounts only.',
      evidence: 'live-feed-registry',
    },
    {
      id: 'app.billing',
      surface: 'app',
      name: 'Billing',
      path: '/app/billing',
      status: 'coming_soon',
      description: 'Merchant plans and invoices — not launched.',
      evidence: 'planned',
    },
    {
      id: 'app.watchlist',
      surface: 'app',
      name: 'Watchlist',
      path: '/terminal/watchlist',
      status: 'coming_soon',
      description: 'Saved opportunity lists — schema path planned.',
      evidence: 'planned',
    },
    {
      id: 'local.auth_bypass',
      surface: 'api',
      name: 'Local AUTH_BYPASS identity',
      path: 'env:AUTH_BYPASS',
      status: authBypass ? 'administrative' : 'unsupported',
      description: authBypass
        ? 'Development only — API impersonates seeded owner without cookie. Forced off when NODE_ENV=production.'
        : 'Disabled (production or AUTH_BYPASS=false).',
      evidence: 'isAuthBypassEnabled()',
    },
  ];
}

export function capabilitySummary(entries: CapabilityEntry[]) {
  const counts: Record<CapabilityStatus, number> = {
    operational: 0,
    approval_controlled: 0,
    credential_blocked: 0,
    coming_soon: 0,
    administrative: 0,
    unsupported: 0,
  };
  for (const e of entries) counts[e.status] += 1;
  return {
    counts,
    launchRule:
      'Do not claim live marketplace operation for credential_blocked or coming_soon capabilities. Public pages never expose private merchant data.',
  };
}
