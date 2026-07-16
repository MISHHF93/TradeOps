import { cookies } from 'next/headers';
import type { AuthResponse } from '@tradeops/contracts';
import { fetchSession } from './api';

/**
 * Resolve the current session via API.
 * When API AUTH_BYPASS is on (local only), /auth/me succeeds without a cookie.
 */
export async function getServerSession(): Promise<AuthResponse | null> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const result = await fetchSession(cookieHeader || undefined);
  if (!result.ok) {
    return null;
  }
  return result.data;
}
