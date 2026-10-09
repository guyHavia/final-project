import { test, describe, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser, User } from '../models/user.model.js';

/**
 * Seam 1 from issue #6: page rendering and the session-presence redirect
 * gate. This is a session-presence check, not role authorization - the
 * authoritative checks live on the /api guards. Real login provides the
 * session cookie, same pattern as test/auth.routes.test.js.
 */

let stopMongo;
let app;

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await User.deleteMany({});
  await mongoose.connection.collection('sessions').deleteMany({}).catch(() => {});
  await createUser({ username: 'rep1', password: 'goodpass', role: 'reporter', displayName: 'Rep One' });
  await createUser({ username: 'ed1', password: 'goodpass', role: 'editor', displayName: 'Ed One' });
});

async function cookieFor(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  return res.headers['set-cookie'];
}

describe('GET /login', () => {
  test('renders the login form', async () => {
    const res = await request(app).get('/login');
    assert.equal(res.status, 200);
    assert.match(res.text, /id="login-form"/);
  });

  test('redirects a signed-in reporter to /newsroom', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/login').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom');
  });

  test('redirects a signed-in editor to /newsroom/review', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/login').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom/review');
  });
});

describe('newsroom page routes - no session', () => {
  for (const path of ['/newsroom', '/newsroom/review', '/newsroom/analytics']) {
    test(`GET ${path} redirects to /login`, async () => {
      const res = await request(app).get(path);
      assert.equal(res.status, 302);
      assert.equal(res.headers.location, '/login');
    });
  }
});

describe('GET /newsroom', () => {
  test('renders the reporter shell for a reporter session', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/newsroom').set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.match(res.text, /data-screen="newsroom-reporter"/);
  });

  test('redirects an editor session to /newsroom/review', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom/review');
  });
});

describe('GET /newsroom/review', () => {
  test('renders the editor shell for an editor session', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom/review').set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.match(res.text, /data-screen="newsroom-editor"/);
  });

  test('redirects a reporter session to /newsroom', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/newsroom/review').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom');
  });
});

describe('review panel comment moderation (#56)', () => {
  test('review shell has a comments section with list, status and load-more', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom/review').set('Cookie', cookie);
    assert.match(res.text, /id="comments-section"/);
    assert.match(res.text, /id="comments-list"/);
    assert.match(res.text, /id="comments-status"[^>]*aria-live="polite"/);
    assert.match(res.text, /id="comments-more"/);
  });

  test('newsroom-comments.js is served, uses the comment endpoints, and never writes HTML', async () => {
    const res = await request(app).get('/js/newsroom-comments.js');
    assert.equal(res.status, 200);
    assert.match(res.text, /\/comments\?/);
    assert.match(res.text, /\/comments\/\$\{[^}]+\}`,\s*\{\s*method: 'DELETE'/);
    assert.match(res.text, /confirm\(/);
    assert.match(res.text, /textContent/);
    assert.doesNotMatch(res.text, /innerHTML|insertAdjacentHTML|outerHTML/);
  });

  test('editor.js hooks the comments module into the review panel', async () => {
    const res = await request(app).get('/js/newsroom-editor.js');
    assert.match(res.text, /from '\.\/newsroom-comments\.js'/);
  });
});

describe('GET /newsroom/analytics', () => {
  test('renders the analytics shell for an editor session', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom/analytics').set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.match(res.text, /data-screen="newsroom-analytics"/);
  });

  test('redirects a reporter session to /newsroom', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/newsroom/analytics').set('Cookie', cookie);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/newsroom');
  });
});

describe('links between the newsroom and the public site', () => {
  test('the login page links back to the public site', async () => {
    const res = await request(app).get('/login');
    assert.match(res.text, /<a class="login-back" href="\/">← Back to The Daily Web<\/a>/);
  });

  for (const [who, path] of [['rep1', '/newsroom'], ['ed1', '/newsroom/review'], ['ed1', '/newsroom/analytics']]) {
    test(`${path} has a "View site" link in the top bar and in the side menu`, async () => {
      const res = await request(app).get(path).set('Cookie', await cookieFor(who));
      assert.match(res.text, /<a class="nav-site-link" href="\/">/);
      assert.match(res.text, /<a class="sidenav-site-link" href="\/">/);
    });
  }

  test('logging out returns to the public home page, not the login page', () => {
    const shell = readFileSync('public/js/shell.js', 'utf8');
    const onLogout = shell.slice(shell.indexOf("'logout-button'"));
    assert.match(onLogout, /window\.location\.href = '\/';/);
    assert.doesNotMatch(onLogout.split('});')[0], /'\/login'/);
  });
});

describe('shared newsroom header', () => {
  test('editor pages get the side menu with Queue and Impact Analytics, current page marked', async () => {
    const cookie = await cookieFor('ed1');
    const res = await request(app).get('/newsroom/analytics').set('Cookie', cookie);
    assert.match(res.text, /id="burger"/);
    assert.match(res.text, /href="\/newsroom\/review"/);
    assert.match(res.text, /href="\/newsroom\/analytics" aria-current="page"/);
    assert.match(res.text, /id="logout-button"/);
  });

  test('reporter page menu links only to My articles', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/newsroom').set('Cookie', cookie);
    assert.match(res.text, /href="\/newsroom" aria-current="page"/);
    assert.doesNotMatch(res.text, /Impact Analytics/);
  });
});

// `/` is the public home feed, open to everyone - it no longer redirects to
// /login. Staff reach their area through the header's "Newsroom" link (/login).
describe('GET /', () => {
  test('shows the public home feed to a signed-out visitor', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /<header class="site-header"/);
  });

  test('shows a signed-in reporter the public feed too, with a link to the newsroom', async () => {
    const cookie = await cookieFor('rep1');
    const res = await request(app).get('/').set('Cookie', cookie);
    assert.equal(res.status, 200);
    assert.match(res.text, /href="\/login"[^>]*>Newsroom</);

    const viaNewsroomLink = await request(app).get('/login').set('Cookie', cookie);
    assert.equal(viaNewsroomLink.status, 302);
    assert.equal(viaNewsroomLink.headers.location, '/newsroom');
  });
});
