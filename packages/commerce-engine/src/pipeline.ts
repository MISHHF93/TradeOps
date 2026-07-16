/**
 * Canonical TradeOps commerce decision pipeline.
 * Stages are ordered; each produces artifacts the next stage consumes.
 */
export const PIPELINE_STAGES = [
  {
    id: 'market_data',
    title: 'Market data',
    description: 'Ingest supplier/marketplace observations via connectors',
  },
  {
    id: 'normalize',
    title: 'Product normalization',
    description: 'Map external records into canonical Product / SupplierOffer',
  },
  {
    id: 'forecast',
    title: 'Demand and profitability forecast',
    description: 'Baseline demand + unit economics with confidence',
  },
  {
    id: 'signal',
    title: 'BUY / SELL / HOLD / EXIT signal',
    description: 'Operational recommendation (not investment advice)',
  },
  {
    id: 'simulation',
    title: 'Simulation',
    description: 'Paper-trade the opportunity before capital risk',
  },
  {
    id: 'approval',
    title: 'Human approval',
    description: 'Required before listing publish or supplier PO execution',
  },
  {
    id: 'listing',
    title: 'Marketplace listing',
    description: 'Authorized create/update/pause of sales listing',
  },
  {
    id: 'customer_order',
    title: 'Customer order',
    description: 'Customer purchase on connected channel',
  },
  {
    id: 'supplier_po',
    title: 'Supplier purchase order',
    description: 'Procurement draft then approved send to supplier',
  },
  {
    id: 'fulfillment',
    title: 'Fulfillment',
    description: 'Shipment and delivery status',
  },
  {
    id: 'actual_profit',
    title: 'Actual profit',
    description: 'Realized contribution after fees, COGS, shipping, refunds',
  },
  {
    id: 'evaluation',
    title: 'Prediction evaluation and model improvement',
    description: 'Compare forecast vs outcome; record errors for model versioning',
  },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]['id'];

export type StageStatus = 'not_started' | 'ready' | 'in_progress' | 'complete' | 'blocked';

export type PipelineStageState = {
  id: PipelineStageId;
  title: string;
  description: string;
  status: StageStatus;
  count: number;
  detail?: string;
};
