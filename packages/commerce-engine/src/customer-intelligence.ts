/**
 * Customer intelligence heuristics — explainable factors, not black-box scores.
 */

export type CustomerOrderFact = {
  orderId: string;
  revenueMinor: number;
  contributionProfitMinor: number;
  returned: boolean;
  channel?: string;
  orderedAt: string;
};

export type CustomerProfileInput = {
  customerKey: string;
  orders: CustomerOrderFact[];
  acquisitionCostMinor?: number;
  supportTickets?: number;
  consentMarketing?: boolean;
};

export type CustomerIntelligenceResult = {
  customerKey: string;
  orderCount: number;
  lifetimeValueMinor: number;
  contributionLifetimeValueMinor: number;
  returnRate: number;
  repeatPurchaseProbability: number;
  churnRisk: number;
  acquisitionCostMinor: number;
  factors: Array<{ key: string; value: number | string; note: string }>;
  note: string;
};

export function analyzeCustomer(input: CustomerProfileInput): CustomerIntelligenceResult {
  const orders = input.orders;
  const orderCount = orders.length;
  const lifetimeValueMinor = orders.reduce((s, o) => s + o.revenueMinor, 0);
  const contributionLifetimeValueMinor = orders.reduce((s, o) => s + o.contributionProfitMinor, 0);
  const returns = orders.filter((o) => o.returned).length;
  const returnRate = orderCount === 0 ? 0 : returns / orderCount;

  // Simple recency/frequency heuristics
  const now = Date.now();
  const lastOrder = orders
    .map((o) => new Date(o.orderedAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  const daysSinceLast = lastOrder ? (now - lastOrder) / (1000 * 60 * 60 * 24) : 999;

  let repeatPurchaseProbability = 0.15;
  if (orderCount >= 2) repeatPurchaseProbability = 0.45;
  if (orderCount >= 4) repeatPurchaseProbability = 0.65;
  if (daysSinceLast < 30) repeatPurchaseProbability = Math.min(0.9, repeatPurchaseProbability + 0.15);
  if (returnRate > 0.3) repeatPurchaseProbability = Math.max(0.05, repeatPurchaseProbability - 0.2);

  let churnRisk = 20;
  if (daysSinceLast > 90) churnRisk = 55;
  if (daysSinceLast > 180) churnRisk = 75;
  if (orderCount === 0) churnRisk = 50;
  if ((input.supportTickets ?? 0) >= 3) churnRisk = Math.min(95, churnRisk + 15);
  if (returnRate > 0.4) churnRisk = Math.min(95, churnRisk + 10);

  return {
    customerKey: input.customerKey,
    orderCount,
    lifetimeValueMinor,
    contributionLifetimeValueMinor,
    returnRate: Math.round(returnRate * 1000) / 1000,
    repeatPurchaseProbability: Math.round(repeatPurchaseProbability * 1000) / 1000,
    churnRisk,
    acquisitionCostMinor: input.acquisitionCostMinor ?? 0,
    factors: [
      { key: 'orders', value: orderCount, note: 'Purchase frequency' },
      { key: 'days_since_last', value: Math.round(daysSinceLast), note: 'Recency' },
      { key: 'return_rate', value: returnRate, note: 'Return behavior' },
      {
        key: 'consent_marketing',
        value: input.consentMarketing ? 'yes' : 'unknown/no',
        note: 'Do not market without consent basis',
      },
    ],
    note: 'Heuristic customer intelligence for planning. Not credit scoring or automated discrimination.',
  };
}
