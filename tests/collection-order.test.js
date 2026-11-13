import test from 'node:test';
import assert from 'node:assert/strict';
import { orderForNewItem } from '../cms/collection-order.js';

test('orderForNewItem goes after the highest order, even with gaps', () => {
  assert.equal(orderForNewItem([{ order: 0 }, { order: 2 }]), 3);
  assert.equal(orderForNewItem([]), 0);
  assert.equal(orderForNewItem([{}, { order: 1 }]), 2);
});

import { listView } from '../cms/collection-order.js';

test('listView keeps the HTML only for a list that was never saved', () => {
  assert.equal(listView([], false), 'html');
  assert.equal(listView([], true), 'items', 'emptied on purpose stays empty');
  assert.equal(listView([{ id: 'a' }], false), 'items');
  assert.equal(listView([{ id: 'a' }], true), 'items');
});
