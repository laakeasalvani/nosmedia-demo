// Loaded as a plain (non-module) script, FIRST in the <head> of every page,
// before Firebase starts. Copied from CaptureWithKi, where it was learned on a
// live gallery (2026-09-29).
//
// Firebase reads IndexedDB before it sends anything: Auth to restore a saved
// login, and every request to attach a usage "heartbeat". Safari has a
// long-standing bug where IndexedDB stops answering. When that happens nothing
// errors; the page just waits forever.
//
// On nosMedia every public page IS the CMS, so this runs for visitors and for
// Carson alike. That is safe because sign-in is per browser tab
// (browserSessionPersistence in cms/auth.js), which never touches IndexedDB:
// Carson signs in again in each new tab, exactly as Khiara does.
try {
  Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
} catch (err) { /* cannot happen in a modern browser; if it does, nothing changes */ }
