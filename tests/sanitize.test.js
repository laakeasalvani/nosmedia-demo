import test from 'node:test';
import assert from 'node:assert/strict';
import { toPlainText } from '../cms/sanitize.js';

test('toPlainText drops the reveal word wrappers', () => {
  assert.equal(toPlainText('<span class="w">Listening</span> <span class="w">is</span>'), 'Listening is');
});

test('toPlainText drops pasted styling and collapses whitespace', () => {
  assert.equal(toPlainText('<p style="color:white">Hi&nbsp;&amp;\n  bye</p>'), 'Hi & bye');
});

test('toPlainText keeps apostrophes and decodes entities', () => {
  assert.equal(toPlainText('I&#39;ll &lt;3 it &quot;now&quot;'), 'I\'ll <3 it "now"');
});
