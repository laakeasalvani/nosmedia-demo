import test from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../cms/timeout.js';

test('withTimeout resolves with the value when the promise is quick', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50, 'late'), 7);
});

test('withTimeout resolves with the fallback when the promise hangs', async () => {
  const t0 = Date.now();
  assert.equal(await withTimeout(new Promise(() => {}), 30, 'late'), 'late');
  assert.ok(Date.now() - t0 < 500);
});

test('withTimeout resolves with the fallback when the promise rejects', async () => {
  assert.equal(await withTimeout(Promise.reject(new Error('x')), 50, 'oops'), 'oops');
});
