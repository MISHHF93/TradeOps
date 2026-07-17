import { cookies } from 'next/headers';
import { apiFetch, DEFAULT_API_TIMEOUT_MS } from './api';

export async function cookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

export async function terminalGet<T>(path: string) {
  const cookie = await cookieHeader();
  return apiFetch<T>(path, {
    cookieHeader: cookie,
    // Scanner / pipeline / portfolio can be slow on PGlite under load.
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
  });
}

export type ScannerRow = {
  productId: string;
  product: string;
  description?: string;
  category: string;
  brand?: string | null;
  sourcePlatform: string;
  supplier: string;
  supplierCostMinor: number;
  shippingCostMinor: number;
  estimatedMarketplaceFeesMinor: number;
  estimatedAdvertisingAllowanceMinor: number;
  targetSellingPriceMinor: number;
  expectedNetProfitMinor: number;
  expectedMarginBps: number;
  demandScore: number;
  trendScore: number;
  competitionScore: number;
  supplierReliability: number;
  shippingReliability: number;
  reviewHealth: number;
  returnRiskScore: number;
  policyRiskScore: number;
  forecastConfidence: number;
  currentSignal: string;
  lastDataUpdate: string;
  currency: string;
  score: number;
  hasActiveListing: boolean;
  rating?: number;
  reviewCount?: number;
  primaryImageUrl?: string | null;
  mediaCount?: number;
  galleryImageUrls?: string[];
};
