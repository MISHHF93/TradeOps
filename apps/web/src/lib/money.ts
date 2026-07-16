export function formatMoney(amountMinor: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}
