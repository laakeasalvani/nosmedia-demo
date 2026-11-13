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

import { raceTimeout, once } from '../cms/timeout.js';

test('raceTimeout reports ok, error and timeout distinctly', async () => {
  assert.deepEqual(await raceTimeout(Promise.resolve(3), 50), { status: 'ok', value: 3 });
  const err = new Error('denied');
  assert.deepEqual(await raceTimeout(Promise.reject(err), 50), { status: 'error', error: err });
  assert.deepEqual(await raceTimeout(new Promise(() => {}), 20), { status: 'timeout' });
});

test('once shares one in-flight run, and allows a retry after failure', async () => {
  let runs = 0;
  let release;
  const f = once(() => { runs++; return new Promise((r) => { release = r; }); });
  const a = f(); const b = f();
  release('done');
  assert.equal(await a, 'done'); assert.equal(await b, 'done');
  assert.equal(runs, 1);
  await f();
  assert.equal(runs, 1, 'a finished run is not repeated');

  let tries = 0;
  const g = once(async () => { tries++; if (tries === 1) throw new Error('flaky'); return 'ok'; });
  await assert.rejects(g());
  assert.equal(await g(), 'ok');
  assert.equal(tries, 2);
});
