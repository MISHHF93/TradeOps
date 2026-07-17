/**
 * Boot-time security assertions for TradeOps.
 * Prevent accidental exposure of founder_direct / weak secrets on public binds.
 */

export type SecurityBootEnv = {
  NODE_ENV?: string;
  API_HOST?: string;
  WEB_ORIGIN?: string;
  TRADEOPS_ACCESS_MODE?: string;
  AUTH_BYPASS?: boolean | string;
  APP_SECRET?: string;
  CREDENTIALS_MASTER_KEY?: string;
  /** Explicit opt-in to bind non-loopback with founder_direct (dangerous) */
  TRADEOPS_ALLOW_INSECURE_BIND?: string | boolean;
  /** Opt-in to public founder mode (still not multi-user SaaS) */
  TRADEOPS_ALLOW_PUBLIC_FOUNDER?: string | boolean;
};

const WEAK_SECRETS = new Set([
  'dev-only-change-me-to-a-long-random-string',
  'change-me',
  'secret',
  'password',
]);

const WEAK_KEY_PREFIXES = ['AAAA', 'aaaa', '0000'];

function truthy(v: unknown): boolean {
  if (v === true) return true;
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export function isLoopbackHost(host: string | undefined): boolean {
  const h = String(host ?? '')
    .trim()
    .toLowerCase();
  return (
    !h ||
    h === '127.0.0.1' ||
    h === 'localhost' ||
    h === '::1' ||
    h === '[::1]'
  );
}

/** True when API will accept connections from non-local network interfaces. */
export function isPublicNetworkBind(apiHost: string | undefined): boolean {
  const h = String(apiHost ?? '0.0.0.0')
    .trim()
    .toLowerCase();
  if (isLoopbackHost(h)) return false;
  // 0.0.0.0 / :: / * bind all interfaces — reachable via LAN/WAN if firewall allows
  if (h === '0.0.0.0' || h === '::' || h === '*' || h === '::0') return true;
  return true; // any explicit NIC IP is non-loopback
}

export function isWeakAppSecret(secret: string | undefined): boolean {
  const s = String(secret ?? '');
  if (s.length < 32) return true;
  if (WEAK_SECRETS.has(s)) return true;
  return false;
}

export function isWeakCredentialsKey(key: string | undefined): boolean {
  const k = String(key ?? '');
  if (k.length < 40) return true;
  return WEAK_KEY_PREFIXES.some((p) => k.startsWith(p));
}

export type SecurityBootResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  mode: 'locked_local' | 'authenticated' | 'insecure_opt_in' | 'production_hardened';
};

/**
 * Evaluate security posture. Does not throw — callers decide fail vs warn.
 */
export function evaluateSecurityBoot(env: SecurityBootEnv = process.env): SecurityBootResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const modeRaw = String(env.TRADEOPS_ACCESS_MODE ?? 'founder_direct')
    .toLowerCase()
    .replace(/-/g, '_');
  const founder =
    modeRaw === 'founder_direct' || modeRaw === 'founder' || modeRaw === 'direct' || !modeRaw;
  const publicBind = isPublicNetworkBind(env.API_HOST);
  const allowInsecure = truthy(env.TRADEOPS_ALLOW_INSECURE_BIND);
  const allowPublicFounder = truthy(env.TRADEOPS_ALLOW_PUBLIC_FOUNDER);
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';

  if (founder && publicBind && !allowInsecure && !allowPublicFounder) {
    errors.push(
      'INSECURE: TRADEOPS_ACCESS_MODE=founder_direct with API_HOST binding all/non-loopback interfaces. ' +
        'Anyone on the network can use the product as owner without login. ' +
        'Fix: set API_HOST=127.0.0.1 (recommended), OR set TRADEOPS_ACCESS_MODE=authenticated, ' +
        'OR set TRADEOPS_ALLOW_INSECURE_BIND=1 to accept the risk (not recommended on internet).',
    );
  }

  if (founder && publicBind && (allowInsecure || allowPublicFounder)) {
    warnings.push(
      'Founder-direct is intentionally allowed on a non-loopback bind. This is NOT multi-user SaaS security.',
    );
  }

  if (isWeakAppSecret(env.APP_SECRET)) {
    if (production || publicBind) {
      errors.push(
        'APP_SECRET is weak/default. Run: node scripts/generate-secrets.mjs and update .env',
      );
    } else {
      warnings.push('APP_SECRET is a development default — rotate before any shared deploy.');
    }
  }

  if (isWeakCredentialsKey(env.CREDENTIALS_MASTER_KEY)) {
    if (production || publicBind) {
      errors.push(
        'CREDENTIALS_MASTER_KEY is weak/default. Run: node scripts/generate-secrets.mjs',
      );
    } else {
      warnings.push('CREDENTIALS_MASTER_KEY is a development placeholder — rotate for real credentials.');
    }
  }

  if (production && founder && !allowPublicFounder) {
    errors.push(
      'NODE_ENV=production with founder_direct requires TRADEOPS_ALLOW_PUBLIC_FOUNDER=1 ' +
        '(private single-operator only). Prefer TRADEOPS_ACCESS_MODE=authenticated for internet SaaS.',
    );
  }

  const authBypass = truthy(env.AUTH_BYPASS);
  if (authBypass && production && !founder) {
    warnings.push('AUTH_BYPASS is ignored in production unless founder_direct is set.');
  }

  let mode: SecurityBootResult['mode'] = 'locked_local';
  if (production && !founder) mode = 'production_hardened';
  else if (founder && publicBind && (allowInsecure || allowPublicFounder)) mode = 'insecure_opt_in';
  else if (!founder) mode = 'authenticated';
  else mode = 'locked_local';

  return { ok: errors.length === 0, errors, warnings, mode };
}

/**
 * Fail the process if security posture is unsafe.
 * Set TRADEOPS_SECURITY_BOOT=warn to log only (not recommended).
 */
export function assertSecurityBoot(env: SecurityBootEnv = process.env): SecurityBootResult {
  const result = evaluateSecurityBoot(env);
  const soft = String(process.env.TRADEOPS_SECURITY_BOOT ?? '')
    .trim()
    .toLowerCase();
  const warnOnly = soft === 'warn' || soft === 'soft';

  for (const w of result.warnings) {
    console.warn(`[security] ${w}`);
  }
  if (!result.ok) {
    for (const e of result.errors) {
      console.error(`[security] ${e}`);
    }
    if (!warnOnly) {
      console.error(
        '[security] Boot refused. See docs/TRADEOPS_INTERNET_SECURITY.md or set TRADEOPS_SECURITY_BOOT=warn to override (unsafe).',
      );
      process.exit(1);
    }
  } else {
    console.log(`[security] Boot posture: ${result.mode}`);
  }
  return result;
}
