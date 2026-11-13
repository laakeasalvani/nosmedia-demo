import test from 'node:test';
import assert from 'node:assert/strict';
import { loginMessage } from '../cms/login-message.js';

test('a wrong password says the email and password did not match', () => {
  assert.match(loginMessage('auth/invalid-credential'), /didn’t match/);
});

test('a dropped connection is not blamed on the password', () => {
  const msg = loginMessage('auth/network-request-failed');
  assert.doesNotMatch(msg, /didn’t match/);
  assert.match(msg, /signal/);
});

test('too many tries says to wait', () => {
  assert.match(loginMessage('auth/too-many-requests'), /Wait a few minutes/);
});

test('an unknown error shows its code', () => {
  assert.match(loginMessage('auth/something-new'), /auth\/something-new/);
});
