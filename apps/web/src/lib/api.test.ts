import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getApiBaseUrl } from './api';

describe('web foundation', () => {
  it('defaults API public URL for local development', () => {
    const url = getApiBaseUrl();
    assert.match(url, /http/);
  });
});
