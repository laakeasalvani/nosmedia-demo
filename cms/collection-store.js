import { db } from './firebase.js';
import {
  collection, doc, getDocs, addDoc, deleteDoc, updateDoc, writeBatch, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { orderForNewItem } from './collection-order.js';
import { withTimeout } from './timeout.js';

const LOAD_TIMEOUT_MS = 3000;

// Copied from CaptureWithKi's cms/collection-store.js. The ordering rule lives
// in collection-order.js so Node can test it; see the comments there.

// Strict read: throws if Firestore can't answer. Used before seeding, where
// "couldn't tell" must never be mistaken for "empty" — that would copy the
// HTML items in a second time.
export async function readCollection(name) {
  const snap = await getDocs(query(collection(db, name), orderBy('order')));
  const items = [];
  snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
  return items;
}

// Page-load read: never hangs (3s max) and never throws; [] means "keep the
// HTML items".
export function loadCollection(name) {
  return withTimeout(readCollection(name).catch(function (e) {
    console.warn('[cms] load ' + name + ' failed:', e.code || e.message);
    throw e;
  }), LOAD_TIMEOUT_MS, []);
}

export async function seedCollection(name, items) {
  const batch = writeBatch(db);
  items.forEach(function (item, index) {
    batch.set(doc(collection(db, name)), Object.assign({}, item, { order: index }));
  });
  await batch.commit();
}

export async function addCollectionItem(name, data) {
  const existing = await readCollection(name);
  const itemRef = await addDoc(collection(db, name), Object.assign({}, data, { order: orderForNewItem(existing) }));
  return itemRef.id;
}

export async function reorderCollection(name, orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach(function (id, index) { batch.update(doc(db, name, id), { order: index }); });
  await batch.commit();
}

// Renumber to a clean 0..n-1 after a delete, so a later add can't collide.
export async function normalizeOrder(name) {
  const items = await readCollection(name);
  if (items.every(function (item, i) { return item.order === i; })) return;
  await reorderCollection(name, items.map(function (item) { return item.id; }));
}

export async function deleteCollectionItem(name, id) {
  await deleteDoc(doc(db, name, id));
  await normalizeOrder(name);
}

export async function updateCollectionItem(name, id, data) {
  await updateDoc(doc(db, name, id), data);
}
