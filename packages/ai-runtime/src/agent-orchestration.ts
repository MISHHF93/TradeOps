/**
 * AI Orchestration Layer — one runtime, multiple specialized agent roles.
 *
 * Agents are capability/persona specializations of the single Cohere agent loop,
 * not separate vendor runtimes. The orchestrator selects which roles participate.
 * Keep role ids aligned with @tradeops/domain AI_AGENT_ROLES.
 */

export const AI_AGENT_ROLES = [
  'orchestrator',
  'research',
  'commerce',
  'procurement',
  'supplier',
  'analytics',
  'operations',
  'compliance',
  'documentation',
] as const;

export type AiAgentRole = (typeof AI_AGENT_ROLES)[number];

export type AgentDefinition = {
  id: AiAgentRole;
  label: string;
  mission: string;
  /** Capability tool name prefixes or exact tools preferred */
  preferredTools: string[];
  /** Objectives that strongly select this agent */
  intentPatterns: RegExp[];
  personaAffinity: string[];
};

/**
 * preferredTools use capability-catalog names (source of truth).
 * Agent roles specialize one Cohere loop — they are not separate vendor runtimes.
 */
export const AGENT_CATALOG: AgentDefinition[] = [
  {
    id: 'orchestrator',
    label: 'Orchestrator',
    mission: 'Route work, coordinate specialists, assemble final envelope.',
    preferredTools: ['commerce.get_orders', 'analytics.get_revenue'],
    intentPatterns: [/.*/],
    personaAffinity: ['executive', 'administrator'],
  },
  {
    id: 'research',
    label: 'Research Agent',
    mission: 'Discover products, suppliers, demand, and public evidence.',
    preferredTools: [
      'research.web_search',
      'research.deep_research',
      'commerce.search_products',
      'procurement.search_suppliers',
    ],
    intentPatterns: [
      /\b(find|discover|research|market|competitor|trend|supplier|source)\b/i,
    ],
    personaAffinity: ['researcher'],
  },
  {
    id: 'commerce',
    label: 'Commerce Agent',
    mission: 'Listings, publish readiness, channel merchandising.',
    preferredTools: [
      'commerce.search_products',
      'commerce.get_product',
      'commerce.publish_listing',
      'commerce.update_inventory',
    ],
    intentPatterns: [/\b(list|listing|publish|merchandis|catalog|channel)\b/i],
    personaAffinity: ['operator'],
  },
  {
    id: 'procurement',
    label: 'Procurement Agent',
    mission: 'RFQ, landed cost, authorize sourcing, PO readiness.',
    preferredTools: [
      'procurement.search_suppliers',
      'procurement.create_rfq',
      'procurement.compare_quotes',
    ],
    intentPatterns: [/\b(procure|rfq|purchase|moq|landed|source order)\b/i],
    personaAffinity: ['operator', 'procurement'],
  },
  {
    id: 'supplier',
    label: 'Supplier Agent',
    mission: 'Supplier comparison, reliability, offer evaluation.',
    preferredTools: [
      'procurement.search_suppliers',
      'procurement.compare_quotes',
      'research.web_search',
    ],
    intentPatterns: [/\b(supplier|manufacturer|wholesale|vendor|oem)\b/i],
    personaAffinity: ['researcher', 'operator'],
  },
  {
    id: 'analytics',
    label: 'Analytics Agent',
    mission: 'Signals, portfolio, forecasts, outcome learning.',
    preferredTools: [
      'analytics.get_revenue',
      'analytics.get_conversion_funnel',
      'analytics.get_traffic',
      'analytics.compare_periods',
    ],
    intentPatterns: [/\b(signal|forecast|analy|kpi|portfolio|performance)\b/i],
    personaAffinity: ['analyst', 'executive'],
  },
  {
    id: 'operations',
    label: 'Operations Agent',
    mission: 'Orders, fulfillment, blockers, connector health.',
    preferredTools: [
      'commerce.get_orders',
      'logistics.track_shipment',
      'logistics.get_rates',
      'payments.get_transactions',
    ],
    intentPatterns: [/\b(orders?|fulfill\w*|ship\w*|ops|connector health|blockers?|tasks?)\b/i],
    personaAffinity: ['operator', 'developer'],
  },
  {
    id: 'compliance',
    label: 'Compliance Agent',
    mission: 'Policy risk, restricted goods, approval gates.',
    preferredTools: ['commerce.get_product', 'research.web_search'],
    intentPatterns: [/\b(policy|compliance|restricted|risk|approval|legal)\b/i],
    personaAffinity: ['administrator', 'executive'],
  },
  {
    id: 'documentation',
    label: 'Documentation Agent',
    mission: 'Specs, manuals, certificates, official sources.',
    preferredTools: ['research.extract_url', 'research.web_search', 'research.crawl_site'],
    intentPatterns: [/\b(manual|datasheet|spec|document|certif|sds)\b/i],
    personaAffinity: ['researcher', 'developer'],
  },
];

export type AgentPlan = {
  primary: AiAgentRole;
  supporting: AiAgentRole[];
  rationale: string;
  /** Always include orchestrator for envelope ownership */
  roles: AiAgentRole[];
};

/**
 * Route a natural-language objective to specialized agent roles.
 * Single runtime still executes; roles shape tools/prompts.
 */
export function planAgentsForObjective(
  objective: string,
  opts?: { persona?: string | null },
): AgentPlan {
  const o = objective.trim();
  const scores = new Map<AiAgentRole, number>();

  for (const agent of AGENT_CATALOG) {
    if (agent.id === 'orchestrator') continue;
    let score = 0;
    for (const re of agent.intentPatterns) {
      if (re.test(o)) score += 2;
    }
    if (opts?.persona && agent.personaAffinity.includes(opts.persona)) {
      score += 1;
    }
    if (score > 0) scores.set(agent.id, score);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const primary: AiAgentRole = ranked[0]?.[0] ?? 'research';
  const supporting = ranked
    .slice(1, 3)
    .map(([id]) => id)
    .filter((id) => id !== primary);

  const roles: AiAgentRole[] = ['orchestrator', primary, ...supporting];
  // uniqueness
  const uniq = [...new Set(roles)];

  return {
    primary,
    supporting,
    roles: uniq,
    rationale:
      ranked.length === 0
        ? 'Default research specialist under orchestrator (no strong intent match).'
        : `Primary=${primary} based on objective keywords` +
          (opts?.persona ? ` and persona=${opts.persona}` : ''),
  };
}

export function agentCatalogPublic() {
  return {
    runtime: 'single_cohere_code_first',
    note: 'Multiple agent roles share one AI runtime; orchestrator selects participants.',
    agents: AGENT_CATALOG.map((a) => ({
      id: a.id,
      label: a.label,
      mission: a.mission,
      preferredTools: a.preferredTools,
      personaAffinity: a.personaAffinity,
    })),
    roles: AI_AGENT_ROLES,
  };
}
