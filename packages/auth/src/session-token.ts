import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/** Opaque session token returned to the browser once; only a hash is stored. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
