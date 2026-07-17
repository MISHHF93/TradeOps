/**
 * Available-to-Promise (ATP) inventory engine.
 * Maps external stock notions into canonical availability.
 */

export type InventorySnapshot = {
  onHand: number;
  reserved: number;
  inbound: number;
  damaged: number;
  returnsPending: number;
  supplierAvailable: number;
  safetyStock: number;
  /** Units allocated exclusively to other channels */
  channelAllocatedElsewhere: number;
  /** Transfer lead time in days from alternate warehouse (0 if same) */
  transferDays?: number;
};

export type AtpResult = {
  availableToSell: number;
  availableToPromise: number;
  projectedAvailability: number;
  oversellRisk: 'none' | 'low' | 'medium' | 'high';
  replenishmentNeed: number;
  expectedFulfillmentDays: number;
  lines: Array<{ key: string; quantity: number }>;
  note: string;
};

export function calculateAtp(input: InventorySnapshot): AtpResult {
  const onHand = Math.max(0, Math.floor(input.onHand));
  const reserved = Math.max(0, Math.floor(input.reserved));
  const inbound = Math.max(0, Math.floor(input.inbound));
  const damaged = Math.max(0, Math.floor(input.damaged));
  const returnsPending = Math.max(0, Math.floor(input.returnsPending));
  const supplierAvailable = Math.max(0, Math.floor(input.supplierAvailable));
  const safety = Math.max(0, Math.floor(input.safetyStock));
  const allocatedElsewhere = Math.max(0, Math.floor(input.channelAllocatedElsewhere));

  const sellableOnHand = Math.max(0, onHand - reserved - damaged - allocatedElsewhere);
  const availableToSell = Math.max(0, sellableOnHand - safety);
  const projected = availableToSell + inbound + returnsPending;
  // ATP can include near-term inbound + supplier for dropship-style ops
  const availableToPromise = availableToSell + inbound + Math.min(supplierAvailable, Math.max(0, safety * 2));

  let oversellRisk: AtpResult['oversellRisk'] = 'none';
  if (reserved > onHand) oversellRisk = 'high';
  else if (availableToSell <= 0 && supplierAvailable <= 0) oversellRisk = 'high';
  else if (availableToSell < safety) oversellRisk = 'medium';
  else if (availableToSell < safety * 2) oversellRisk = 'low';

  const replenishmentNeed = Math.max(0, safety * 2 - availableToSell - inbound);

  let expectedFulfillmentDays = 1;
  if (availableToSell > 0) expectedFulfillmentDays = 1;
  else if (inbound > 0) expectedFulfillmentDays = 3;
  else if (supplierAvailable > 0) expectedFulfillmentDays = 7 + (input.transferDays ?? 0);
  else expectedFulfillmentDays = 14;

  return {
    availableToSell,
    availableToPromise,
    projectedAvailability: projected,
    oversellRisk,
    replenishmentNeed,
    expectedFulfillmentDays,
    lines: [
      { key: 'on_hand', quantity: onHand },
      { key: 'reserved', quantity: reserved },
      { key: 'damaged', quantity: damaged },
      { key: 'allocated_elsewhere', quantity: allocatedElsewhere },
      { key: 'safety_stock', quantity: safety },
      { key: 'inbound', quantity: inbound },
      { key: 'returns_pending', quantity: returnsPending },
      { key: 'supplier_available', quantity: supplierAvailable },
    ],
    note: 'Canonical ATP. External marketplace stock remains source-of-truth until reconciled.',
  };
}
