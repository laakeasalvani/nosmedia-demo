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
