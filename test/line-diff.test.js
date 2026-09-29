import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { diffLines } from '../public/js/line-diff.js';

describe('diffLines', () => {
  test('identical text is all same lines', () => {
    const result = diffLines('a\nb\nc', 'a\nb\nc');
    assert.deepEqual(
      result.map((l) => l.type),
      ['same', 'same', 'same'],
    );
  });

  test('a pure addition marks only the new line as added', () => {
    const result = diffLines('a\nb', 'a\nb\nc');
    assert.deepEqual(result, [
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
      { type: 'added', text: 'c' },
    ]);
  });

  test('a pure removal marks only the missing line as removed', () => {
    const result = diffLines('a\nb\nc', 'a\nc');
    assert.deepEqual(result, [
      { type: 'same', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'same', text: 'c' },
    ]);
  });

  test('a changed middle line shows as a removal plus an addition', () => {
    const result = diffLines('a\nb\nc', 'a\nB\nc');
    assert.deepEqual(result, [
      { type: 'same', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'B' },
      { type: 'same', text: 'c' },
    ]);
  });

  test('empty old text shows its one blank line removed and both new lines added', () => {
    // splitting '' on '\n' yields one empty-string line, not zero lines
    const result = diffLines('', 'a\nb');
    assert.deepEqual(
      result.map((l) => l.type),
      ['removed', 'added', 'added'],
    );
  });

  test('both empty is a single same blank line', () => {
    const result = diffLines('', '');
    assert.deepEqual(result, [{ type: 'same', text: '' }]);
  });
});
