import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

let adminActive = false;
const listeners = [];

let editing = false;
const editListeners = [];

// Editing is remembered for this tab only (like the login), so moving to
// another page through the menu keeps it on instead of needing the gear again.
const EDITING_KEY = 'nosCmsEditing';
function rememberEditing(on) {
  try { if (on) sessionStorage.setItem(EDITING_KEY, '1'); else sessionStorage.removeItem(EDITING_KEY); } catch (e) {}
}
function wasEditing() {
  try { return sessionStorage.getItem(EDITING_KEY) === '1'; } catch (e) { return false; }
}

function notify() {
  listeners.forEach(function (cb) { cb(adminActive); });
}

function notifyEditing() {
  editListeners.forEach(function (cb) { cb(editing); });
}

export function onAdminChange(cb) {
  listeners.push(cb);
  cb(adminActive);
}

export function isAdmin() {
  return adminActive;
}

// Editing is a deliberate mode the owner turns on, not a side effect of being
// signed in. She stays logged in while browsing her own site normally.
export function onEditingChange(cb) {
  editListeners.push(cb);
  cb(editing);
}

export function isEditing() {
  return editing;
}

export function setEditing(on) {
  const next = !!on && adminActive;   // editing without admin is never possible
  if (next === editing) return;
  editing = next;
  rememberEditing(editing);
  notifyEditing();
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function initAuth() {
  setPersistence(auth, browserSessionPersistence).then(function () {
    onAuthStateChanged(auth, async function (user) {
      if (!user) {
        adminActive = false;
        rememberEditing(false);
        if (editing) {
          editing = false;
          notifyEditing();
        }
        notify();
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        adminActive = adminDoc.exists();
      } catch (e) {
        console.warn('[cms] admin check failed:', e.code || e.message);
        adminActive = false;
      }
      if (!adminActive && editing) {
        editing = false;
        notifyEditing();
      }
      notify();
      if (adminActive && !editing && wasEditing()) setEditing(true);
    });
  });
}
