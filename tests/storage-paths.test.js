import test from 'node:test';
import assert from 'node:assert/strict';
import { storagePathFor, isOwnedStorageUrl } from '../cms/storage-paths.js';

test('storagePathFor makes a safe, timestamped path', () => {
  assert.equal(storagePathFor('slides', 'abc', 'My Clip (Final).MP4', 1700000000000), 'media/slides/abc/1700000000000-my-clip-final-.mp4');
});

test('isOwnedStorageUrl only matches our own bucket media files', () => {
  const b = 'nosmedia-1.firebasestorage.app';
  assert.equal(isOwnedStorageUrl('media/surf.mp4', b), false);
  assert.equal(isOwnedStorageUrl(`https://firebasestorage.googleapis.com/v0/b/${b}/o/media%2Fslides%2Fx.mp4?alt=media&token=t`, b), true);
  assert.equal(isOwnedStorageUrl(`https://firebasestorage.googleapis.com/v0/b/other/o/media%2Fx.mp4`, b), false);
  assert.equal(isOwnedStorageUrl('', b), false);
  assert.equal(isOwnedStorageUrl(null, b), false);
});
