import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/** scrypt parameters — tuned for interactive login, not offline KDF extremes. */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

/**
 * Hash a password with scrypt (Node built-in — no native bcrypt dependency).
 * Format: scrypt$N$r$p$saltB64$keyB64
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (password.length > 128) {
    throw new Error('Password must be at most 128 characters');
  }

  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    'scrypt',
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltB64 = parts[4];
  const keyB64 = parts[5];
  if (!saltB64 || !keyB64 || !Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const salt = Buffer.from(saltB64, 'base64url');
  const expected = Buffer.from(keyB64, 'base64url');
  const derived = await scryptAsync(password, salt, expected.length, { N: n, r, p });

  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
