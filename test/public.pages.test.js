import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startMongo } from './support/mongo.js';
import { createApp } from '../app.js';
import { createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';

/**
 * The public site through the REAL app (createApp): the server-rendered pages
 * are mounted, and the article page counts a reader's view once per render via
 * recordArticleView.
 */

let stopMongo;
let app;
const users = {};
const cookies = {};
let live;
let draft;

const FIRST = new Date('2025-02-01T09:00:00.000Z');
const FULL_BODY = 'The rover touched down at 04:12 UTC after a seven-month cruise. '.repeat(20);

async function login(username) {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'goodpass' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.headers['set-cookie'];
}

const page = (path, who) => {
  const req = request(app).get(path);
  return who ? req.set('Cookie', cookies[who]) : req;
};
const viewsOf = async (doc) => ({
  viewCount: (await Article.findById(doc._id).lean()).viewCount,
  events: await ViewEvent.countDocuments({ article: doc._id }),
});

before(async () => {
  stopMongo = await startMongo();
  app = createApp();
  await Article.syncIndexes();
  const make = (username, role, displayName) =>
    createUser({ username, password: 'goodpass', role, displayName });
  users.reporter = await make('rina', 'reporter', 'Rina Reporter');
  users.editor = await make('eli', 'editor', 'Eli Editor');
  cookies.reporter = await login('rina');
  cookies.editor = await login('eli');
});

after(async () => {
  await stopMongo();
});

beforeEach(async () => {
  await Promise.all([Article.deleteMany({}), ViewEvent.deleteMany({})]);
  live = await Article.create({
    title: 'Mars Rover Lands', body: FULL_BODY, abstract: 'Touchdown confirmed.', category: 'science',
    author: users.reporter._id, state: 'Published', slug: 'mars-rover-lands', firstPublishedAt: FIRST,
    published: {
      title: 'Mars Rover Lands', body: FULL_BODY, abstract: 'Touchdown confirmed.',
      category: 'science', publishedAt: FIRST, version: 1,
    },
    history: [{ at: FIRST, kind: 'publish' }],
    viewCount: 0,
  });
  draft = await Article.create({
    title: 'Secret Draft Headline', body: 'Not ready', category: 'world',
    author: users.reporter._id, state: 'In Preparation',
  });
});

describe('public pages are mounted', () => {
  test('GET / renders the home feed with published articles only', async () => {
    const res = await page('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /Mars Rover Lands/);
    assert.doesNotMatch(res.text, /Secret Draft Headline/);
  });

  test('GET /article/:slug renders the article with its full text in the first HTML response (SEO)', async () => {
    const res = await page('/article/mars-rover-lands');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.text, /Mars Rover Lands/);
    assert.ok(res.text.includes('The rover touched down at 04:12 UTC'), 'the body is server-rendered');
  });

  test('the article page has a hidden alert with a retry button for when comments fail to load', async () => {
    const res = await page('/article/mars-rover-lands');
    assert.match(res.text, /id="comments-load-error"[^>]*role="alert"[^>]*hidden/);
    assert.match(res.text, /id="retry-comments"/);
  });

  test('the slug is case-insensitive', async () => {
    assert.equal((await page('/article/MARS-Rover-Lands')).status, 200);
  });

  test('an unknown or never-published article renders the 404 page', async () => {
    for (const path of ['/article/no-such-story', `/article/${draft._id}`]) {
      const res = await page(path);
      assert.equal(res.status, 404, path);
      assert.match(res.headers['content-type'], /text\/html/, path);
      assert.match(res.text, /Page Not Found/, path);
    }
  });

  test('every public page has the site header: the name links home, plus a Newsroom link', async () => {
    for (const path of ['/', '/article/mars-rover-lands', '/article/no-such-story']) {
      const res = await page(path);
      assert.match(res.text, /<header class="site-header"/, `${path}: public header`);
      assert.match(res.text, /<a class="site-name" href="\/">The Daily Web<\/a>/, `${path}: link home`);
      assert.match(res.text, /href="\/login"[^>]*>Newsroom</, `${path}: newsroom link`);
      assert.doesNotMatch(res.text, /<header class="nav">|id="burger"/, `${path}: not the newsroom chrome`);
    }
  });

  test('the newsroom pages still work alongside the public site', async () => {
    assert.equal((await page('/login')).status, 200);
    const newsroom = await page('/newsroom');
    assert.equal(newsroom.status, 302);
    assert.equal(newsroom.headers.location, '/login');
  });
});

describe('the article page counts views', () => {
  test("a reader's visit adds 1 to viewCount and records one view for analytics", async () => {
    await page('/article/mars-rover-lands');
    assert.deepEqual(await viewsOf(live), { viewCount: 1, events: 1 });
  });

  test('visits from different devices (no shared deviceId cookie) each count', async () => {
    for (let i = 0; i < 3; i += 1) await page('/article/mars-rover-lands');
    assert.deepEqual(await viewsOf(live), { viewCount: 3, events: 3 });
  });

  test('logged-in reporters and editors see the page but are not counted', async () => {
    assert.equal((await page('/article/mars-rover-lands', 'reporter')).status, 200);
    assert.equal((await page('/article/mars-rover-lands', 'editor')).status, 200);
    assert.deepEqual(await viewsOf(live), { viewCount: 0, events: 0 });
  });

  test('a 404 counts nothing', async () => {
    await page('/article/no-such-story');
    assert.equal(await ViewEvent.countDocuments(), 0);
  });

  test('reading through the JSON API or loading comments counts nothing', async () => {
    await page(`/api/articles/${live._id}`);
    await page(`/api/articles/${live._id}/comments`);
    assert.deepEqual(await viewsOf(live), { viewCount: 0, events: 0 });
  });

  test('the page shows the updated count to the next reader', async () => {
    await page('/article/mars-rover-lands');
    const second = await page('/article/mars-rover-lands');
    assert.match(second.text, /\b1 views\b/, 'the count rendered before this visit was recorded');
  });
});

describe('article text is safe, readable in any language, and images can load', () => {
  async function publish(slug, fields) {
    return Article.create({
      category: 'world', author: users.reporter._id, state: 'Published', slug, firstPublishedAt: FIRST,
      ...fields,
      published: { category: 'world', publishedAt: FIRST, version: 1, ...fields },
    });
  }

  test('HTML typed into an article body is shown as text, never inserted as markup (no stored XSS)', async () => {
    await publish('xss-attempt', {
      title: 'Harmless title',
      body: 'Hello <b>bold</b>\n<img src="https://evil.example/x.png" onerror="alert(1)"><a href="https://phish.example">click</a>',
    });
    const res = await page('/article/xss-attempt');
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.text, /<img src="https:\/\/evil\.example/);
    assert.doesNotMatch(res.text, /<a href="https:\/\/phish\.example"/);
    assert.doesNotMatch(res.text, /<b>bold<\/b>/);
    assert.match(res.text, /Hello &lt;b&gt;bold&lt;\/b&gt;/);
  });

  test('line breaks in the body become separate paragraphs', async () => {
    await publish('two-paragraphs', { title: 'Two', body: 'First paragraph.\n\nSecond paragraph.' });
    const res = await page('/article/two-paragraphs');
    assert.match(res.text, /<p dir="auto">First paragraph\.<\/p>\s*<p dir="auto">Second paragraph\.<\/p>/);
  });

  test('titles, abstracts and body text use dir="auto", so Hebrew reads right-to-left', async () => {
    await publish('hebrew-story', { title: 'כותרת בעברית', abstract: 'תקציר קצר', body: 'פסקה ראשונה.' });
    const article = await page('/article/hebrew-story');
    assert.match(article.text, /<h1 dir="auto">כותרת בעברית<\/h1>/);
    assert.match(article.text, /<p class="article-abstract" dir="auto">תקציר קצר<\/p>/);
    assert.match(article.text, /<p dir="auto">פסקה ראשונה\.<\/p>/);

    const feed = await page('/');
    assert.match(feed.text, /<h2 dir="auto"><a href="\/article\/hebrew-story">כותרת בעברית<\/a><\/h2>/);
    assert.match(feed.text, /<p class="card-abstract" dir="auto">תקציר קצר<\/p>/);
  });

  test('the security policy allows https images (article photos are links to other sites)', async () => {
    const res = await page('/');
    assert.match(res.headers['content-security-policy'], /img-src 'self' data: https:/);
  });

  test('the browser tab title is not repeated on the home page', async () => {
    assert.match((await page('/')).text, /<title>The Daily Web<\/title>/);
    assert.match((await page('/article/mars-rover-lands')).text, /<title>Mars Rover Lands - The Daily Web<\/title>/);
  });
});

describe('news-site layout: masthead, categories, sidebar, theme', () => {
  async function publishWithViews(slug, title, viewCount, category = 'world') {
    return Article.create({
      title, body: 'Body', category, author: users.reporter._id, state: 'Published', slug,
      firstPublishedAt: FIRST, viewCount,
      published: { title, body: 'Body', category, publishedAt: FIRST, version: 1 },
    });
  }

  test("the masthead shows today's date and a link per category", async () => {
    const res = await page('/');
    assert.match(res.text, /<time class="masthead-date" datetime="\d{4}-\d{2}-\d{2}">/);
    for (const category of ['politics', 'business', 'technology', 'science', 'health', 'sports', 'entertainment', 'world', 'opinion', 'culture']) {
      assert.ok(res.text.includes(`<a class="category-link cat-${category}" href="/?category=${category}"`), category);
    }
  });

  test('the selected category is marked in the category bar', async () => {
    const res = await page('/?category=science');
    assert.match(res.text, /<a class="category-link cat-science" href="\/\?category=science" aria-current="page">/);
    assert.doesNotMatch(res.text, /href="\/\?category=sports" aria-current/);
  });

  test('every public page has the dark/light toggle and loads the theme script in <head>', async () => {
    for (const path of ['/', '/article/mars-rover-lands', '/article/no-such-story']) {
      const res = await page(path);
      const head = res.text.slice(0, res.text.indexOf('</head>'));
      assert.match(head, /<script src="\/js\/theme\.js"><\/script>/, `${path}: theme script`);
      assert.match(res.text, /<button type="button" id="theme-toggle"/, `${path}: toggle button`);
    }
  });

  test('the home sidebar lists the 5 most-read stories, most viewed first', async () => {
    await publishWithViews('quiet', 'Quiet Story', 1);
    await publishWithViews('top', 'Top Story', 900);
    await publishWithViews('second', 'Second Story', 500);
    await publishWithViews('third', 'Third Story', 300);
    await publishWithViews('fourth', 'Fourth Story', 200);
    await publishWithViews('fifth', 'Fifth Story', 100);

    const res = await page('/');
    const box = res.text.slice(res.text.indexOf('id="most-read-heading"'));
    const mostRead = box.slice(0, box.indexOf('</ol>'));
    const titles = [...mostRead.matchAll(/<a href="\/article\/[^"]+">([^<]+)<\/a>/g)].map((m) => m[1]);
    assert.deepEqual(titles, ['Top Story', 'Second Story', 'Third Story', 'Fourth Story', 'Fifth Story']);
  });

  test('the weather widget sits in the sidebar of the home and article pages, not the footer', async () => {
    for (const path of ['/', '/article/mars-rover-lands']) {
      const res = await page(path);
      const sidebar = res.text.slice(res.text.indexOf('<aside class="sidebar sidebar-weather"'), res.text.indexOf('</aside>'));
      assert.match(sidebar, /id="weather-widget"/, `${path}: weather in sidebar`);
      assert.match(res.text, /<script type="module" src="\/js\/weather\.js"><\/script>/, `${path}: weather script`);
      const footer = res.text.slice(res.text.indexOf('<footer'));
      assert.doesNotMatch(footer, /weather-widget/, `${path}: not in footer`);
    }
  });

  test('on the home page the weather box comes before the stories in the page (shown first on phones)', async () => {
    const res = await page('/');
    const weather = res.text.indexOf('id="weather-widget"');
    const stories = res.text.indexOf('id="article-card-list"');
    const mostRead = res.text.indexOf('id="most-read-heading"');
    assert.ok(weather > -1 && weather < stories, 'weather before the feed');
    assert.ok(mostRead > stories, 'most read after the feed');
  });

  test('categories are chosen from the bar only (no duplicate dropdown), and the choice reaches infinite scroll', async () => {
    const res = await page('/?category=sports');
    assert.doesNotMatch(res.text, /id="feed-category"/, 'no category dropdown');
    assert.match(res.text, /id="feed-sort"/, 'the sort control stays');
    assert.match(res.text, /id="feed-bootstrap"[^>]*data-query-category="sports"/, 'feed.js loads more sports stories');
  });

  test('cards carry their category as a class, for the category color', async () => {
    const res = await page('/');
    assert.match(res.text, /<span class="card-category cat-science">science<\/span>/);
  });
});
