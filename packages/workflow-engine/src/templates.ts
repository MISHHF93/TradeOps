/**
 * Versioned reusable automation templates.
 * Definitions are code-first; org customizations persist via API runs.
 */

export type WorkflowTriggerFamily =
  | 'scheduled_interval'
  | 'manual'
  | 'webhook_event'
  | 'supplier_cost_change'
  | 'supplier_stock_change'
  | 'marketplace_order'
  | 'margin_change'
  | 'tracking_delay'
  | 'forecast_horizon'
  | 'connector_failure';

export type WorkflowTemplate = {
  key: string;
  name: string;
  version: string;
  description: string;
  trigger: WorkflowTriggerFamily;
  requiresApproval: boolean;
  steps: string[];
  variables: string[];
  /** What this template can do today inside TradeOps */
  executionStatus: 'operational_partial' | 'shadow_only' | 'coming_soon';
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'product_opportunity_discovery',
    name: 'Product Opportunity Discovery',
    version: '1.0.0',
    description:
      'Interval/manual: score products, filter by margin/policy, queue top opportunities for review.',
    trigger: 'scheduled_interval',
    requiresApproval: false,
    steps: [
      'load_authorized_products',
      'calculate_landed_and_contribution',
      'evaluate_policy',
      'score_opportunity',
      'filter_qualifying',
      'write_shadow_summary',
      'notify_operator',
    ],
    variables: ['minMarginBps', 'maxPolicyRisk', 'topN'],
    executionStatus: 'operational_partial',
  },
  {
    key: 'margin_protection',
    name: 'Margin Protection',
    version: '1.0.0',
    description:
      'On cost/fee change: recompute contribution; propose price change when below floor; require approval.',
    trigger: 'supplier_cost_change',
    requiresApproval: true,
    steps: [
      'recalculate_contribution',
      'compare_margin_floor',
      'draft_price_adjustment',
      'request_approval',
      'apply_if_approved',
      'verify_listing_state',
    ],
    variables: ['marginFloorBps', 'maxAutoDeltaBps'],
    executionStatus: 'shadow_only',
  },
  {
    key: 'inventory_protection',
    name: 'Inventory Protection',
    version: '1.0.0',
    description: 'When supplier stock falls: reduce sync qty or pause listing after approval.',
    trigger: 'supplier_stock_change',
    requiresApproval: true,
    steps: [
      'inspect_active_listings',
      'compute_oversell_risk',
      'draft_inventory_update',
      'request_approval_if_pause',
      'reconcile_external',
    ],
    variables: ['minStock', 'pauseBelow'],
    executionStatus: 'coming_soon',
  },
  {
    key: 'supplier_routing',
    name: 'Supplier Routing',
    version: '1.0.0',
    description: 'Paid order → compare suppliers → draft PO → approval → submit (when connector live).',
    trigger: 'marketplace_order',
    requiresApproval: true,
    steps: [
      'match_product',
      'compare_suppliers',
      'select_supplier',
      'create_po_draft',
      'request_approval',
      'submit_po',
    ],
    variables: ['maxDeliveryDays', 'minReliability'],
    executionStatus: 'operational_partial',
  },
  {
    key: 'delivery_exception',
    name: 'Delivery Exception',
    version: '1.0.0',
    description: 'Tracking delay → assess severity → draft customer message → financial action needs approval.',
    trigger: 'tracking_delay',
    requiresApproval: true,
    steps: [
      'load_order_and_promise',
      'assess_severity',
      'draft_customer_message',
      'recommend_remedy',
      'request_approval_if_financial',
    ],
    variables: ['promiseWindowHours'],
    executionStatus: 'coming_soon',
  },
  {
    key: 'forecast_evaluation',
    name: 'Forecast Evaluation',
    version: '1.0.0',
    description: 'At horizon: compare forecast vs actual; write evaluation record; surface governance metrics.',
    trigger: 'forecast_horizon',
    requiresApproval: false,
    steps: [
      'load_forecasts',
      'load_actuals',
      'compute_errors',
      'persist_prediction_outcomes',
      'notify_governance',
    ],
    variables: ['modelVersion'],
    executionStatus: 'operational_partial',
  },
];

export function getWorkflowTemplate(key: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key);
}

export function listWorkflowTemplates(): WorkflowTemplate[] {
  return [...WORKFLOW_TEMPLATES];
}
