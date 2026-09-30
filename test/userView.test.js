import { test } from 'node:test';
import assert from 'node:assert/strict';

import { publicUser, toUserView } from '../lib/userView.js';
import { toActor } from '../services/articleState.service.js';
import { CONTENT_FIELDS, CONTENT_LIMITS } from '../models/article.model.js';

const user = {
  id: 'abc',
  _id: 'abc',
  username: 'rina',
  role: 'reporter',
  displayName: 'Rina',
  active: true,
  passwordHash: 'secret',
  createdAt: new Date(0),
  updatedAt: new Date(1),
};

test('publicUser exposes only the safe identity fields', () => {
  assert.deepEqual(publicUser(user), { id: 'abc', username: 'rina', role: 'reporter', displayName: 'Rina' });
});

test('toUserView adds account status and timestamps, still never the hash', () => {
  assert.deepEqual(toUserView(user), {
    id: 'abc',
    username: 'rina',
    role: 'reporter',
    displayName: 'Rina',
    active: true,
    createdAt: new Date(0),
    updatedAt: new Date(1),
  });
});

test('toActor reduces a user to the id and role the state machine needs', () => {
  assert.deepEqual(toActor(user), { id: 'abc', role: 'reporter' });
});

test('CONTENT_FIELDS is derived from CONTENT_LIMITS', () => {
  assert.deepEqual(CONTENT_FIELDS, Object.keys(CONTENT_LIMITS));
  assert.deepEqual(CONTENT_FIELDS, ['title', 'abstract', 'body', 'image', 'category']);
});
