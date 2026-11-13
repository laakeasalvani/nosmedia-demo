// Firestore waits silently for a backend it can't reach. Every read the page
// needs before it can show itself goes through this, so a slow or blocked
// connection costs at most `ms` and the built-in HTML stays. Pure module
// (tests/timeout.test.js).
export function withTimeout(promise, ms, fallback) {
  return new Promise(function (resolve) {
    const timer = setTimeout(function () { resolve(fallback); }, ms);
    Promise.resolve(promise).then(
      function (v) { clearTimeout(timer); resolve(v); },
      function () { clearTimeout(timer); resolve(fallback); }
    );
  });
}

// For WRITES. Firestore keeps a write pending while offline instead of
// failing it, so "await setDoc" can wait forever with Carson none the wiser.
// This tells the three outcomes apart: saved, refused (permission, bad data),
// or still waiting. A timeout is NOT a failure: the write may still land, so
// callers must not delete a new upload on 'timeout', only on 'error'.
export function raceTimeout(promise, ms) {
  return new Promise(function (resolve) {
    const timer = setTimeout(function () { resolve({ status: 'timeout' }); }, ms);
    Promise.resolve(promise).then(
      function (value) { clearTimeout(timer); resolve({ status: 'ok', value: value }); },
      function (error) { clearTimeout(timer); resolve({ status: 'error', error: error }); }
    );
  });
}

// Runs fn once. Calls made while it is in flight share that run; after it
// succeeds the result is reused; after it fails the next call tries again.
// Used for seeding a list, which must never happen twice.
export function once(fn) {
  let pending = null;
  return function () {
    if (!pending) {
      pending = new Promise(function (resolve) { resolve(fn()); });
      pending.catch(function () { pending = null; });
    }
    return pending;
  };
}
