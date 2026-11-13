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

import { uploadContentType, isAllowedImageType } from '../cms/storage-paths.js';

test('checked videos upload labelled video/mp4 whatever the container said', () => {
  assert.equal(uploadContentType('video', { type: 'video/quicktime' }), 'video/mp4');
  assert.equal(uploadContentType('video', { type: '' }), 'video/mp4');
  assert.equal(uploadContentType('image', { type: 'image/png' }), 'image/png');
  assert.equal(uploadContentType('poster', { type: 'image/jpeg' }), 'image/jpeg');
});

test('only web-safe photo types are allowed', () => {
  assert.equal(isAllowedImageType('image/jpeg'), true);
  assert.equal(isAllowedImageType('image/png'), true);
  assert.equal(isAllowedImageType('image/webp'), true);
  assert.equal(isAllowedImageType('image/heic'), false);
  assert.equal(isAllowedImageType('image/heif'), false);
  assert.equal(isAllowedImageType(''), false);
});
