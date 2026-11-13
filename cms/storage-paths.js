// Where uploads live in Cloud Storage, and which URLs we are allowed to delete.
// Pure module (tests/storage-paths.test.js).

// media/<slot>/<id>/<timestamp>-<safe name>. The timestamp means a replacement
// never overwrites the file visitors are still watching; the old one is
// deleted only after the new URL is saved.
export function storagePathFor(slot, id, filename, now) {
  const safe = String(filename).toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  return 'media/' + slot + '/' + id + '/' + now + '-' + safe;
}

// Only files this project uploaded may be deleted. The bundled media/*.mp4
// fallbacks in the repo, and anything on another bucket, are never touched.
export function isOwnedStorageUrl(url, bucket) {
  if (!url) return false;
  const prefix = 'https://firebasestorage.googleapis.com/v0/b/' + bucket + '/o/media%2F';
  return String(url).indexOf(prefix) === 0;
}
