/** All monetary math uses integer minor units (cents). Never floats for money. */

export type Money = {
  amountMinor: number;
  currency: string;
};

export function assertMinor(amountMinor: number, label = 'amount'): number {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`${label} must be an integer minor unit`);
  }
  return amountMinor;
}

export function sumMinor(...parts: number[]): number {
  return parts.reduce((acc, p) => acc + assertMinor(p), 0);
}

export function marginBps(netProfitMinor: number, revenueMinor: number): number {
  if (revenueMinor <= 0) {
    return 0;
  }
  return Math.round((netProfitMinor / revenueMinor) * 10_000);
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}
