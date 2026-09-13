import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { startMongo } from './support/mongo.js';
import { User, createUser } from '../models/user.model.js';

let stopMongo;

before(async () => {
  stopMongo = await startMongo();
  await User.syncIndexes();
});

after(async () => {
  await stopMongo();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('User model', () => {
  const valid = {
    username: 'alice',
    role: 'reporter',
    displayName: 'Alice Reporter',
    passwordHash: 'placeholder',
  };

  test('requires username', () => {
    const err = new User({ ...valid, username: undefined }).validateSync();
    assert.ok(err.errors.username);
  });

  test('requires role', () => {
    const err = new User({ ...valid, role: undefined }).validateSync();
    assert.ok(err.errors.role);
  });

  test('requires displayName', () => {
    const err = new User({ ...valid, displayName: undefined }).validateSync();
    assert.ok(err.errors.displayName);
  });

  test('rejects a role outside the enum', () => {
    const err = new User({ ...valid, role: 'admin' }).validateSync();
    assert.ok(err.errors.role);
  });

  test('accepts the reporter and editor roles', () => {
    assert.equal(new User({ ...valid, role: 'reporter' }).validateSync(), undefined);
    assert.equal(new User({ ...valid, role: 'editor' }).validateSync(), undefined);
  });

  test('rejects a duplicate username case-insensitively', async () => {
    await createUser({
      username: 'Alice',
      password: 'secret',
      role: 'reporter',
      displayName: 'Alice',
    });

    await assert.rejects(
      createUser({
        username: 'alice',
        password: 'another',
        role: 'editor',
        displayName: 'Al',
      }),
      (err) => err.code === 11000,
    );
  });

  test('omits passwordHash from a default query and includes it on select', async () => {
    await createUser({
      username: 'bob',
      password: 'secret',
      role: 'reporter',
      displayName: 'Bob',
    });

    const plain = await User.findOne({ username: 'bob' });
    assert.equal(plain.passwordHash, undefined);

    const withHash = await User.findOne({ username: 'bob' }).select('+passwordHash');
    assert.ok(withHash.passwordHash);
  });

  test('setPassword stores a bcrypt hash, never the plaintext', async () => {
    const user = new User({ ...valid });
    await user.setPassword('secret');

    assert.notEqual(user.passwordHash, 'secret');
    assert.ok(user.passwordHash.startsWith('$2'));
  });

  test('verifyPassword is true for the set password and false otherwise', async () => {
    const user = new User({ ...valid });
    await user.setPassword('secret');

    assert.equal(await user.verifyPassword('secret'), true);
    assert.equal(await user.verifyPassword('wrong'), false);
  });

  test('createUser persists a user whose verifyPassword matches the given password', async () => {
    const created = await createUser({
      username: 'carol',
      password: 'hunter2',
      role: 'editor',
      displayName: 'Carol',
    });
    assert.ok(created._id);

    const fetched = await User.findById(created._id).select('+passwordHash');
    assert.equal(await fetched.verifyPassword('hunter2'), true);
    assert.equal(await fetched.verifyPassword('nope'), false);
  });
});
