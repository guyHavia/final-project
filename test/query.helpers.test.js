import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { escapeRegex, isObjectId, clampLimit } from '../lib/query.js';
import { STATE, STATES } from '../models/article.model.js';
import { ROLE, ROLES } from '../models/user.model.js';

test('escapeRegex escapes every regex metacharacter', () => {
  assert.equal(escapeRegex('a.b*c(d)'), 'a\\.b\\*c\\(d\\)');
  assert.equal(new RegExp(escapeRegex('.*')).test('xyz'), false);
});

test('isObjectId accepts ObjectId instances and 24-hex strings only', () => {
  assert.equal(isObjectId(new mongoose.Types.ObjectId()), true);
  assert.equal(isObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(isObjectId('nope'), false);
  assert.equal(isObjectId(undefined), false);
});

test('clampLimit clamps to 1..max and falls back to the default', () => {
  const opts = { defaultLimit: 20, maxLimit: 50 };
  assert.equal(clampLimit(undefined, opts), 20);
  assert.equal(clampLimit('abc', opts), 20);
  assert.equal(clampLimit('0', opts), 1);
  assert.equal(clampLimit('-5', opts), 1);
  assert.equal(clampLimit('7', opts), 7);
  assert.equal(clampLimit('999', opts), 50);
});

test('state and role constants', () => {
  assert.deepEqual(STATES, ['In Preparation', 'Pending Editor Approval', 'Published', 'Returned for Corrections']);
  assert.equal(STATE.PENDING, 'Pending Editor Approval');
  assert.deepEqual(ROLES, ['reporter', 'editor']);
  assert.equal(ROLE.EDITOR, 'editor');
});
