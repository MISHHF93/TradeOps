import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateEnvironmentConfig, envValidationPublicStatus } from './env-validation';

const strongSecret = 'a'.repeat(40);
const strongKey = Buffer.from('x'.repeat(32)).toString('base64');

describe('env validation', () => {
  it('allows development without Cohere key (warning only)', () => {
    const r = validateEnvironmentConfig({
      NODE_ENV: 'development',
      AI_PROVIDER: 'cohere',
      DATABASE_URL: 'postgresql://localhost/db',
      APP_SECRET: strongSecret,
      CREDENTIALS_MASTER_KEY: strongKey,
      WEB_ORIGIN: 'http://localhost:3000',
    });
    assert.equal(r.ok, true);
    assert.ok(r.issues.some((i) => i.code === 'ai_runtime_unconfigured_dev'));
  });

  it('fails production when AI_PROVIDER=cohere and key missing', () => {
    const r = validateEnvironmentConfig({
      NODE_ENV: 'production',
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: '',
      DATABASE_URL: 'postgresql://localhost/db',
      APP_SECRET: strongSecret,
      CREDENTIALS_MASTER_KEY: strongKey,
      WEB_ORIGIN: 'https://app.example.com',
    });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === 'ai_runtime_unconfigured' && i.severity === 'error'));
  });

  it('passes production when Cohere key is present', () => {
    const r = validateEnvironmentConfig({
      NODE_ENV: 'production',
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: 'not-a-real-key-for-tests-only',
      DATABASE_URL: 'postgresql://localhost/db',
      APP_SECRET: strongSecret,
      CREDENTIALS_MASTER_KEY: strongKey,
      WEB_ORIGIN: 'https://app.example.com',
    });
    assert.equal(r.ok, true);
  });

  it('flags web search enabled without provider keys', () => {
    const r = validateEnvironmentConfig({
      NODE_ENV: 'production',
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: 'test-key',
      WEB_SEARCH_ENABLED: 'true',
      DATABASE_URL: 'postgresql://localhost/db',
      APP_SECRET: strongSecret,
      CREDENTIALS_MASTER_KEY: strongKey,
      WEB_ORIGIN: 'https://app.example.com',
    });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === 'web_search_enabled_without_key'));
  });

  it('marks web search disabled when not enabled', () => {
    const r = validateEnvironmentConfig({
      NODE_ENV: 'development',
      WEB_SEARCH_ENABLED: 'false',
    });
    const web = r.providers.find((p) => p.name === 'web_search');
    assert.equal(web?.status, 'disabled');
  });

  it('public status never leaks secret values', () => {
    const secret = 'super-secret-cohere-value-xyz';
    const s = envValidationPublicStatus({
      NODE_ENV: 'development',
      AI_PROVIDER: 'cohere',
      COHERE_API_KEY: secret,
    });
    const json = JSON.stringify(s);
    assert.ok(!json.includes(secret));
    assert.ok(s.providers.some((p) => p.name.startsWith('ai_provider')));
  });
});
