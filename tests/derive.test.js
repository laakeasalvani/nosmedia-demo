import test from 'node:test';
import assert from 'node:assert/strict';
import { instagramHandle, mailtoHref, mergeSettings, serviceOptions } from '../cms/derive.js';

test('instagramHandle reads the handle from the profile URL', () => {
  assert.equal(instagramHandle('https://www.instagram.com/n0smedia/'), '@n0smedia');
  assert.equal(instagramHandle('https://instagram.com/n0smedia?igsh=abc'), '@n0smedia');
  assert.equal(instagramHandle(''), '');
});

test('mailtoHref encodes the subject', () => {
  assert.equal(mailtoHref('a@b.co'), 'mailto:a@b.co');
  assert.equal(mailtoHref('a@b.co', "I'd like to book a call"), "mailto:a@b.co?subject=I'd%20like%20to%20book%20a%20call");
});

test('mergeSettings lets non-empty overrides win', () => {
  const merged = mergeSettings({ email: 'old@x.co', vslUrl: '', calendarUrl: 'c' }, { email: 'new@x.co', calendarUrl: '  ', vslUrl: 'v' });
  assert.deepEqual(merged, { email: 'new@x.co', vslUrl: 'v', calendarUrl: 'c' });
});

test('serviceOptions uses short labels, drops blanks and dupes, ends with Not sure yet', () => {
  assert.deepEqual(serviceOptions([{ title: 'Brand films', shortLabel: 'Brand film' }, { title: 'Events' }]), ['Brand film', 'Events', 'Not sure yet']);
  assert.deepEqual(serviceOptions([{ title: 'Not sure yet' }]), ['Not sure yet']);
  assert.deepEqual(serviceOptions([{ title: ' ' }, { title: 'Events' }, { title: 'Events ' }]), ['Events', 'Not sure yet']);
});

import { embedUrl } from '../cms/derive.js';

test('embedUrl turns YouTube and Vimeo links into player URLs', () => {
  assert.equal(embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(embedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(embedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(embedUrl('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(embedUrl('https://player.vimeo.com/video/76979871'), 'https://player.vimeo.com/video/76979871');
});

test('embedUrl rejects anything else', () => {
  assert.equal(embedUrl('https://example.com/video'), '');
  assert.equal(embedUrl('javascript:alert(1)'), '');
  assert.equal(embedUrl(''), '');
});

import { isIOSDevice } from '../cms/derive.js';

test('isIOSDevice spots iPhones and iPads (including iPadOS posing as a Mac)', () => {
  assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 }), true);
  assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), true);
  assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }), false);
  assert.equal(isIOSDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', maxTouchPoints: 5 }), false);
});
