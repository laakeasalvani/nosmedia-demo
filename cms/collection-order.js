// Copied from CaptureWithKi (cms/collection-store.js), where it was learned
// the hard way. Pure, so Node can test it (tests/collection-order.test.js).
//
// `order` must be unique within a collection. A duplicate makes Firestore fall
// back to sorting by document id, so the item lands somewhere nobody chose.
// Using `items.length` as the next order only holds while the numbers run
// 0..n-1 with no gaps; one deletion breaks it. CaptureWithKi's live data had
// reached orders {2,2,2,3} exactly this way. So: one past the highest.
export function orderForNewItem(items) {
  let max = -1;
  items.forEach(function (item) {
    if (typeof item.order === 'number' && item.order > max) max = item.order;
  });
  return max + 1;
}
