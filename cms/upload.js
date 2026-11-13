import { storage, bucket } from './firebase.js';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';
import { isOwnedStorageUrl } from './storage-paths.js';

// Resumable rather than CaptureWithKi's uploadBytes: Carson's films are
// hundreds of MB over a phone connection, and a resumable upload survives
// hiccups, reports progress, and can be cancelled cleanly.
//
// The Blob goes up exactly as given. Nothing in this file (or anywhere in the
// CMS) re-encodes video — see the spec.
export function uploadFile(file, path, opts) {
  const onProgress = (opts && opts.onProgress) || function () {};
  const signal = opts && opts.signal;
  return new Promise(function (resolve, reject) {
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    if (signal) {
      if (signal.aborted) task.cancel();
      signal.addEventListener('abort', function () { task.cancel(); });
    }
    task.on('state_changed',
      function (snap) { if (snap.totalBytes) onProgress(snap.bytesTransferred / snap.totalBytes); },
      reject,
      function () { getDownloadURL(task.snapshot.ref).then(resolve, reject); });
  });
}

// Only ever deletes a file this project uploaded, never the bundled media/
// fallbacks. Never throws: a leftover file costs pennies, a thrown error here
// would look like the save failed when it didn't.
export async function deleteIfOwned(url) {
  if (!isOwnedStorageUrl(url, bucket)) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (e) {
    console.warn('[cms] could not delete old file:', e.code || e.message);
  }
}
