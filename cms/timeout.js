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
