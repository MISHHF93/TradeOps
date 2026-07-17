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
      status: input?.authBypass ? 'administrative' : 'operational',
      description: input?.authBypass
        ? 'Hidden under TRADEOPS_ACCESS_MODE=founder_direct; route redirects to terminal. Architecture retained.'
        : 'Creates user + organization + session cookie via API.',
      evidence: 'POST /api/v1/auth/register · TRADEOPS_ACCESS_MODE',
    },
    {
      id: 'public.login',
      surface: 'public',
      name: 'Sign in',
      path: '/login',
      status: input?.authBypass ? 'administrative' : 'operational',
      description: input?.authBypass
        ? 'Not required in founder_direct; redirects to workspace. Session auth remains available.'
        : 'Session cookie auth against hashed passwords.',
      evidence: 'POST /api/v1/auth/login · TRADEOPS_ACCESS_MODE',
    },
    {
      id: 'app.founder_direct',
      surface: 'app',
      name: 'Direct Founder Access',
      path: '/terminal/cockpit',
      status: 'operational',
      description:
        'TRADEOPS_ACCESS_MODE=founder_direct initializes founder user+org and skips login UX. Org scoping and RBAC still apply.',
      evidence: 'FounderAccessService · GET /api/v1/public/access-mode',
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
    {
      id: 'public.platform',
      surface: 'public',
      name: 'SaaS platform overview',
      path: '/platform',
      status: 'operational',
      description: 'Multi-tenant packs, segments, control tower, entitlements narrative.',
      evidence: 'apps/web/src/app/platform/page.tsx',
    },
    {
      id: 'public.platform.plans',
      surface: 'public',
      name: 'Plans & entitlements',
      path: '/platform/plans',
      status: 'operational',
      description: 'Plan quotas published; server-side enforcement via saas-entitlements.',
      evidence: 'GET /api/v1/saas/packs · @tradeops/saas-entitlements',
    },

    // App — terminal
    {
      id: 'app.saas.cockpit',
      surface: 'app',
      name: 'Founder cockpit',
      path: '/terminal/cockpit',
      status: 'operational',
      description: 'Segment/plan/quotas + top opportunities + urgent actions.',
      evidence: 'GET /api/v1/saas/founder-cockpit',
    },
    {
      id: 'app.saas.control_tower',
      surface: 'app',
      name: 'Commerce control tower',
      path: '/terminal/control-tower',
      status: 'operational',
      description: 'Org-scoped ops signals: revenue proxy, approvals, connectors, AI issues.',
      evidence: 'GET /api/v1/saas/control-tower',
    },
    {
      id: 'app.saas.atp',
      surface: 'app',
      name: 'Available-to-promise inventory',
      path: '/terminal/products/:id',
      status: 'operational',
      description: 'Canonical ATP from on-hand, reserved, supplier, safety stock.',
      evidence: 'GET /api/v1/saas/atp/:productId',
    },
    {
      id: 'app.saas.customers',
      surface: 'app',
      name: 'Customer intelligence',
      path: '/terminal/customers',
      status: 'operational',
      description: 'LTV, churn risk, repeat probability with explainable factors.',
      evidence: 'GET /api/v1/saas/customers/intelligence',
    },
    {
      id: 'app.saas.agency',
      surface: 'app',
      name: 'Agency client orgs',
      path: '/terminal/agency',
      status: 'operational',
      description: 'Parent/client organization hierarchy; isolation by organizationId.',
      evidence: 'POST /api/v1/saas/agency/clients',
    },
    {
      id: 'app.watchlist',
      surface: 'app',
      name: 'Product watchlist',
      path: '/terminal/watchlist',
      status: 'operational',
      description: 'Org-scoped saved opportunities with audit on add/remove.',
      evidence: 'GET/POST/DELETE /api/v1/watchlist',
    },
    {
      id: 'app.ai.side_panel',
      surface: 'app',
      name: 'AI operator side panel',
      path: '/terminal/*',
      status: 'operational',
      description: 'Persistent shadow AI strip on terminal pages; full workspace at /terminal/ai.',
      evidence: 'apps/web/src/components/ai-side-panel.tsx',
    },
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
      name: 'Commerce process board',
      path: '/terminal/process',
      status: 'operational',
      description:
        'CommerceCase lifecycle board (legacy /terminal/pipeline redirects here). Stage counts from real DB rows.',
      evidence: 'GET /api/v1/commerce/process',
    },
    {
      id: 'app.live_http',
      surface: 'app',
      name: 'Live HTTP adapters (12)',
      path: '/terminal/connectors',
      status: 'operational',
      description:
        'Credential-gated Shopify, Stripe, FX, Woo, EasyPost, SerpAPI, BigCommerce, eBay, PayPal, ShipStation, Keepa, Square. Never fabricates payloads.',
      evidence: 'LIVE_HTTP_IMPLEMENTED + @tradeops/connector-live-http',
    },
    {
      id: 'app.production_isolation',
      surface: 'app',
      name: 'Production workspace isolation',
      path: '/terminal',
      status: 'operational',
      description:
        'Scanner/portfolio exclude fixture rows when TRADEOPS_PRODUCTION_WORKSPACE=1 (or production without simulation).',
      evidence: 'filterForProductionWorkspace + GET /api/v1/terminal/scanner isolation',
    },
    {
      id: 'app.ai.rag',
      surface: 'app',
      name: 'RAG knowledge engine',
      path: '/terminal/ai',
      status: 'operational',
      description:
        'Org-specific TF-IDF train/query over products, cases, runs, connectors. Optional xAI grounded answers with XAI_API_KEY. Not GPU fine-tuning.',
      evidence: 'POST /api/v1/ai/rag/train · POST /api/v1/ai/rag/query · docs/TRADEOPS_RAG_ENGINE.md',
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
      id: 'saas.segment_onboarding',
      surface: 'app',
      name: 'Segment onboarding',
      path: '/onboarding',
      status: 'operational',
      description: 'Choose individual/SMB/agency/enterprise; sets plan defaults + persona.',
      evidence: 'POST /api/v1/saas/onboarding',
    },
    {
      id: 'saas.founder_cockpit',
      surface: 'app',
      name: 'Founder cockpit',
      path: '/terminal/cockpit',
      status: 'operational',
      description: 'Persona-adaptive priorities: opportunities, cash, approvals.',
      evidence: 'GET /api/v1/saas/founder-cockpit',
    },
    {
      id: 'saas.entitlements',
      surface: 'app',
      name: 'Server-side entitlements',
      path: '/api/v1/saas/tenant',
      status: 'operational',
      description: 'Plan packs + quotas; not only UI-hidden.',
      evidence: '@tradeops/saas-entitlements',
    },
    {
      id: 'saas.channel_profit',
      surface: 'app',
      name: 'Channel profitability compare',
      path: '/api/v1/saas/channel-profitability/:id',
      status: 'operational',
      description: 'Contribution-based channel ranking — never revenue alone.',
      evidence: 'commerce-engine channel-profitability',
    },
    {
      id: 'saas.agentic_readiness',
      surface: 'app',
      name: 'Agentic commerce readiness',
      path: '/api/v1/saas/agentic-readiness',
      status: 'operational',
      description: 'Catalog readiness score; not a live UCP/ACP connection claim.',
      evidence: 'commerce-engine agentic-readiness',
    },
    {
      id: 'app.billing',
      surface: 'app',
      name: 'Billing',
      path: '/app/billing',
      status: 'coming_soon',
      description: 'Merchant plans and invoices — not launched. Entitlements exist without payment collection.',
      evidence: 'planned',
    },
    {
      id: 'public.ga4',
      surface: 'public',
      name: 'GA4 marketing analytics',
      path: 'env:NEXT_PUBLIC_GA4_*',
      status: process.env.NEXT_PUBLIC_GA4_ENABLED === 'true' ? 'operational' : 'administrative',
      description:
        'Optional env-gated gtag. Off by default. Never sends credentials or private merchant data.',
      evidence: 'apps/web/src/components/ga4.tsx · docs/TRADEOPS_GA4.md',
    },
    {
      id: 'local.auth_bypass',
      surface: 'api',
      name: 'Direct founder / AUTH_BYPASS identity',
      path: 'env:TRADEOPS_ACCESS_MODE',
      status: authBypass ? 'administrative' : 'unsupported',
      description: authBypass
        ? 'TRADEOPS_ACCESS_MODE=founder_direct (or legacy AUTH_BYPASS) resolves founder identity without login form. Protect private deploys.'
        : 'Session authentication required (authenticated / multi_tenant mode).',
      evidence: 'FounderAccessService · isAuthBypassEnabled()',
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
