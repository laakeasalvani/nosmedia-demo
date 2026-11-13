import { raceTimeout } from './timeout.js';
import { showToast } from './toast.js';

// Every save goes through here so Carson always hears what happened.
// Firestore doesn't fail a write while offline; it waits. After SLOW_MS we
// say so ("Still saving…") and report the real outcome when it arrives.
//
// Returns 'ok', 'error' (definitely not saved) or 'timeout' (may still save).
// Only 'error' justifies cleaning up a new upload.
const SLOW_MS = 15000;

export async function saveWithFeedback(promise, okMessage) {
  const r = await raceTimeout(promise, SLOW_MS);
  if (r.status === 'ok') { showToast(okMessage || 'Saved'); return 'ok'; }
  if (r.status === 'error') {
    console.warn('[cms] save failed:', r.error && (r.error.code || r.error.message));
    showToast('Not saved — check your connection', 4000);
    return 'error';
  }
  showToast('Still saving… keep this tab open', 0);
  Promise.resolve(promise).then(
    function () { showToast(okMessage || 'Saved'); },
    function () { showToast('Not saved — check your connection', 4000); }
  );
  return 'timeout';
}
