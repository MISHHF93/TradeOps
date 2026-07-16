import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createLogger } from './index';

describe('createLogger', () => {
  it('creates a named logger at the requested level', () => {
    const logger = createLogger({ service: 'test-service', level: 'debug' });
    assert.equal(logger.level, 'debug');
    assert.equal(logger.bindings().service, 'test-service');
  });
});
