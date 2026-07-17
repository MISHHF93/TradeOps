/**
 * Normalized TradeOps capabilities exposed to Grok.
 * Vendor APIs sit behind adapters — the model never sees raw REST paths.
 */

export type CapabilityDomain =
  | 'commerce'
  | 'payments'
  | 'logistics'
  | 'analytics'
  | 'procurement'
  | 'research'
  | 'industrial';

export type CapabilityDescriptor = {
  name: string;
  domain: CapabilityDomain;
  description: string;
  write: boolean;
  requiresApproval: boolean;
  /** Prefer authenticated connector truth vs public search */
  informationClass: 'operational' | 'public_research' | 'calculation';
};

export const TRADEOPS_CAPABILITIES: CapabilityDescriptor[] = [
  // Commerce
  { name: 'commerce.search_products', domain: 'commerce', description: 'Search tenant product catalog', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'commerce.get_product', domain: 'commerce', description: 'Get product by id', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'commerce.publish_listing', domain: 'commerce', description: 'Publish listing to channel', write: true, requiresApproval: true, informationClass: 'operational' },
  { name: 'commerce.update_inventory', domain: 'commerce', description: 'Update inventory quantity', write: true, requiresApproval: true, informationClass: 'operational' },
  { name: 'commerce.get_orders', domain: 'commerce', description: 'List customer orders', write: false, requiresApproval: false, informationClass: 'operational' },
  // Payments
  { name: 'payments.get_transactions', domain: 'payments', description: 'List payment transactions', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'payments.create_checkout', domain: 'payments', description: 'Create checkout session', write: true, requiresApproval: true, informationClass: 'operational' },
  { name: 'payments.get_subscription', domain: 'payments', description: 'Get SaaS subscription', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'payments.issue_refund', domain: 'payments', description: 'Issue refund', write: true, requiresApproval: true, informationClass: 'operational' },
  // Logistics
  { name: 'logistics.get_rates', domain: 'logistics', description: 'Get shipping rates', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'logistics.create_shipment', domain: 'logistics', description: 'Create shipment', write: true, requiresApproval: true, informationClass: 'operational' },
  { name: 'logistics.track_shipment', domain: 'logistics', description: 'Track shipment', write: false, requiresApproval: false, informationClass: 'operational' },
  // Analytics
  { name: 'analytics.get_revenue', domain: 'analytics', description: 'Revenue metrics', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'analytics.get_conversion_funnel', domain: 'analytics', description: 'Conversion funnel', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'analytics.get_traffic', domain: 'analytics', description: 'Traffic metrics', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'analytics.compare_periods', domain: 'analytics', description: 'Compare metric periods', write: false, requiresApproval: false, informationClass: 'operational' },
  // Procurement
  { name: 'procurement.search_suppliers', domain: 'procurement', description: 'Search suppliers', write: false, requiresApproval: false, informationClass: 'operational' },
  { name: 'procurement.create_rfq', domain: 'procurement', description: 'Create RFQ draft', write: true, requiresApproval: true, informationClass: 'operational' },
  { name: 'procurement.compare_quotes', domain: 'procurement', description: 'Compare supplier quotes', write: false, requiresApproval: false, informationClass: 'calculation' },
  // Research (public web — not operational truth)
  { name: 'research.web_search', domain: 'research', description: 'Public web search (Tavily / xAI)', write: false, requiresApproval: false, informationClass: 'public_research' },
  { name: 'research.extract_url', domain: 'research', description: 'Extract content from URL', write: false, requiresApproval: false, informationClass: 'public_research' },
  { name: 'research.crawl_site', domain: 'research', description: 'Crawl website', write: false, requiresApproval: false, informationClass: 'public_research' },
  { name: 'research.deep_research', domain: 'research', description: 'Deep comparative research', write: false, requiresApproval: false, informationClass: 'public_research' },
  { name: 'research.search_x', domain: 'research', description: 'Social / market signals on X', write: false, requiresApproval: false, informationClass: 'public_research' },
];

export function listCapabilitiesPublic() {
  return TRADEOPS_CAPABILITIES.map((c) => ({
    name: c.name,
    domain: c.domain,
    description: c.description,
    write: c.write,
    requiresApproval: c.requiresApproval,
    informationClass: c.informationClass,
  }));
}

export function getCapability(name: string): CapabilityDescriptor | undefined {
  return TRADEOPS_CAPABILITIES.find((c) => c.name === name);
}
