import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  artifactTypeFromMime,
  extensionFromMime,
  isAllowedArtifactMime,
  isUnsafeSvgPayload,
  sanitizeFilename,
  simplePerceptualHash,
  validateRemoteArtifactUrl,
} from './artifact-security';

describe('artifact-security SSRF', () => {
  it('allows public https URLs', () => {
    const r = validateRemoteArtifactUrl('https://cdn.example.com/product.jpg');
    assert.equal(r.ok, true);
  });

  it('rejects localhost', () => {
    const r = validateRemoteArtifactUrl('http://localhost:4000/secret');
    assert.equal(r.ok, false);
  });

  it('rejects 127.0.0.1', () => {
    const r = validateRemoteArtifactUrl('http://127.0.0.1/x');
    assert.equal(r.ok, false);
  });

  it('rejects private 10.x', () => {
    const r = validateRemoteArtifactUrl('http://10.0.0.5/img.png');
    assert.equal(r.ok, false);
  });

  it('rejects private 192.168.x', () => {
    const r = validateRemoteArtifactUrl('http://192.168.1.1/a');
    assert.equal(r.ok, false);
  });

  it('rejects 172.16-31 private range', () => {
    assert.equal(validateRemoteArtifactUrl('http://172.16.0.1/a').ok, false);
    assert.equal(validateRemoteArtifactUrl('http://172.31.255.255/a').ok, false);
  });

  it('rejects cloud metadata endpoint', () => {
    const r = validateRemoteArtifactUrl('http://169.254.169.254/latest/meta-data/');
    assert.equal(r.ok, false);
  });

  it('rejects file:// and other schemes', () => {
    assert.equal(validateRemoteArtifactUrl('file:///etc/passwd').ok, false);
    assert.equal(validateRemoteArtifactUrl('ftp://files.example.com/a').ok, false);
  });

  it('rejects .internal hosts', () => {
    assert.equal(validateRemoteArtifactUrl('http://api.internal/x').ok, false);
  });
});

describe('artifact-security MIME and payload', () => {
  it('allows image/pdf/video MIME', () => {
    assert.equal(isAllowedArtifactMime('image/png'), true);
    assert.equal(isAllowedArtifactMime('application/pdf'), true);
    assert.equal(isAllowedArtifactMime('video/mp4'), true);
    assert.equal(isAllowedArtifactMime('text/html'), false);
    assert.equal(isAllowedArtifactMime('application/javascript'), false);
  });

  it('detects unsafe SVG', () => {
    assert.equal(
      isUnsafeSvgPayload('<svg><script>alert(1)</script></svg>', 'image/svg+xml'),
      true,
    );
    assert.equal(
      isUnsafeSvgPayload(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
        'image/svg+xml',
      ),
      false,
    );
  });

  it('maps mime to type and extension', () => {
    assert.equal(artifactTypeFromMime('image/jpeg'), 'image');
    assert.equal(artifactTypeFromMime('video/mp4'), 'video');
    assert.equal(artifactTypeFromMime('application/pdf'), 'document');
    assert.equal(extensionFromMime('image/webp'), 'webp');
  });

  it('sanitizes filenames against path traversal', () => {
    assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeFilename('C:\\windows\\system32\\x.png'), 'x.png');
  });

  it('produces stable perceptual hash for same buffer', () => {
    const a = Buffer.from('product-image-bytes-aaa');
    const b = Buffer.from('product-image-bytes-aaa');
    const c = Buffer.from('product-image-bytes-bbb');
    assert.equal(simplePerceptualHash(a), simplePerceptualHash(b));
    assert.notEqual(simplePerceptualHash(a), simplePerceptualHash(c));
  });
});
