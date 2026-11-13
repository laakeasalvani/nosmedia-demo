import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { withTimeout } from './timeout.js';

// Two documents: content/site holds every editable text and media slot by key
// (shared.* and <page>.*); content/settings holds the config.js overrides.
//
// A slow or unreachable Firestore must never leave the page blank: after
// LOAD_TIMEOUT_MS we give up and the HTML fallbacks stay.
const LOAD_TIMEOUT_MS = 3000;

let site = {};
let loaded = false;

function loadDoc(id) {
  const read = getDoc(doc(db, 'content', id)).then(function (snap) { return snap.exists() ? snap.data() : {}; });
  read.catch(function (e) { console.warn('[cms] load ' + id + ' failed:', e.code || e.message); });
  return withTimeout(read, LOAD_TIMEOUT_MS, null).then(function (data) {
    if (data === null) console.warn('[cms] load ' + id + ' gave no answer; showing the built-in text');
    return data || {};
  });
}

export async function loadSiteContent() {
  site = await loadDoc('site');
  loaded = true;
  return site;
}

export function getField(key, fallback) {
  if (!loaded) return fallback;
  return Object.prototype.hasOwnProperty.call(site, key) ? site[key] : fallback;
}

export async function setField(key, value) {
  site[key] = value;
  await setDoc(doc(db, 'content', 'site'), { [key]: value }, { merge: true });
}

export function loadSettings() {
  return loadDoc('settings');
}

export async function setSetting(key, value) {
  await setDoc(doc(db, 'content', 'settings'), { [key]: value }, { merge: true });
}
