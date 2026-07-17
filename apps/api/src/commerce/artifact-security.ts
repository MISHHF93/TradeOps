/**
 * SSRF-safe remote URL validation and MIME allowlists for artifact ingestion.
 * Treat every remote file as untrusted.
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
]);

/** Max sync ingest size (bytes). Larger files must use async workers. */
export const ARTIFACT_SYNC_MAX_BYTES = 8 * 1024 * 1024;

export type SafeUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Validate a remote artifact URL before any server-side fetch.
 * Blocks loopback, private ranges, link-local, cloud metadata, and non-http(s).
 */
export function validateRemoteArtifactUrl(raw: string): SafeUrlResult {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'Invalid artifact URL' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { ok: false, reason: 'Only http(s) artifact URLs are allowed' };
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'Private/internal artifact URLs are blocked (SSRF protection)' };
  }
  if (
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|0\.)/.test(host) ||
    host === 'metadata'
  ) {
    return { ok: false, reason: 'Private network artifact URLs are blocked' };
  }
  // IPv6 unique-local / link-local
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return { ok: false, reason: 'Private IPv6 artifact URLs are blocked' };
  }
  return { ok: true, url: u };
}

export function assertSafeRemoteUrl(raw: string): URL {
  const r = validateRemoteArtifactUrl(raw);
  if (!r.ok) {
    const err = new Error(r.reason) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  return r.url;
}

const ALLOWED_MIME_PREFIXES = ['image/', 'video/'] as const;
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'text/plain',
  'model/gltf-binary',
  'model/gltf+json',
]);

export function isAllowedArtifactMime(mime: string): boolean {
  const m = mime.split(';')[0]!.trim().toLowerCase();
  if (ALLOWED_MIME_EXACT.has(m)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p));
}

/** SVG is allowed only after sanitization path; raw remote SVG is restricted. */
export function isUnsafeSvgPayload(body: string | Buffer, mime: string): boolean {
  if (!mime.toLowerCase().includes('svg')) return false;
  const text = typeof body === 'string' ? body : body.toString('utf8');
  // Block scriptable / external-resource SVG
  return /<script|javascript:|on\w+\s*=|xlink:href\s*=\s*["']?\s*https?:|data:text\/html/i.test(
    text,
  );
}

export function extensionFromMime(mime: string): string {
  const m = mime.split(';')[0]!.trim().toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('svg')) return 'svg';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('webm')) return 'webm';
  if (m.includes('gltf-binary') || m.includes('glb')) return 'glb';
  if (m.includes('gltf')) return 'gltf';
  if (m === 'text/plain') return 'txt';
  return 'bin';
}

export function artifactTypeFromMime(
  mime: string,
): 'image' | 'video' | 'document' | 'model_3d' | 'other' {
  const m = mime.split(';')[0]!.trim().toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.includes('gltf') || m.includes('glb')) return 'model_3d';
  if (m === 'application/pdf' || m === 'text/plain') return 'document';
  return 'other';
}

/** Simple dHash-style placeholder from first N bytes (not crypto). */
export function simplePerceptualHash(buf: Buffer): string {
  const sample = buf.subarray(0, Math.min(buf.length, 256));
  let h = 0n;
  for (let i = 0; i < sample.length; i++) {
    h = (h * 31n + BigInt(sample[i]!)) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? 'artifact';
  return base.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 200) || 'artifact';
}
