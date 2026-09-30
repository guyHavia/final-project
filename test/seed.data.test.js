import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { CATEGORIES, STATES } from '../models/article.model.js';
import {
  ARTICLE_COUNT,
  assertSeedAllowed,
  buildArticles,
  buildComments,
  buildViewEvents,
  createRng,
} from '../seed/seedData.js';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-06-15T12:00:00Z');
const ids = () => Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
const build = (seed = 53) =>
  buildArticles({ authorIds: ids(), editorId: new mongoose.Types.ObjectId(), now: NOW, rng: createRng(seed) });

describe('seed data: articles', () => {
  const articles = build();

  test('produces 500 articles', () => {
    assert.equal(articles.length, ARTICLE_COUNT);
    assert.equal(ARTICLE_COUNT, 500);
  });

  test('guarantees at least 10 articles in every state x category cell', () => {
    for (const state of STATES) {
      for (const category of CATEGORIES) {
        const n = articles.filter((a) => a.state === state && a.category === category).length;
        assert.ok(n >= 10, `${state} / ${category} has only ${n}`);
      }
    }
  });

  test('uses realistic curated copy, never placeholders', () => {
    for (const a of articles) {
      assert.doesNotMatch(a.title, /Article Title|lorem/i);
      assert.doesNotMatch(a.body, /This is the body|lorem/i);
      assert.ok(a.title.length > 10 && a.abstract.length > 10 && a.body.length > 100);
    }
    assert.ok(articles.some((a) => /[֐-׿]/.test(a.title)), 'has Hebrew titles');
    assert.ok(articles.some((a) => /^[A-Za-z]/.test(a.title)), 'has English titles');
    assert.equal(new Set(articles.map((a) => a.title)).size, articles.length, 'titles are unique');
  });

  test('every article and published copy has an http(s) image', () => {
    for (const a of articles) {
      assert.match(a.image, /^https?:\/\//);
      if (a.published) assert.match(a.published.image, /^https?:\/\//);
    }
  });

  test('published articles are consistent: history, versions and working copy', () => {
    const published = articles.filter((a) => a.state === 'Published');
    let pending = 0;
    for (const a of published) {
      assert.equal(a.history[0].kind, 'publish');
      assert.deepEqual(a.history.slice(1).map((h) => h.kind).filter((k) => k !== 'update'), []);
      assert.equal(a.published.version, a.history.length);
      assert.equal(a.published.publishedAt.getTime(), a.history.at(-1).at.getTime());
      assert.equal(a.firstPublishedAt.getTime(), a.history[0].at.getTime());
      for (let i = 1; i < a.history.length; i++) {
        assert.ok(a.history[i].at > a.history[i - 1].at);
      }
      assert.ok(a.history.at(-1).at.getTime() < NOW);
      const differs = ['title', 'abstract', 'body', 'image', 'category'].some((f) => a[f] !== a.published[f]);
      if (differs) pending += 1;
    }
    assert.ok(pending > 0 && pending < published.length / 2, `pending revisions: ${pending}`);
  });

  test('several published articles carry multiple updates', () => {
    const multi = articles.filter((a) => a.state === 'Published' && a.history.length >= 3);
    assert.ok(multi.length >= 20, `only ${multi.length}`);
  });

  test('slugs exist exactly for articles that have a published version and are unique', () => {
    const slugs = articles.filter((a) => a.slug).map((a) => a.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const a of articles) assert.equal(Boolean(a.slug), Boolean(a.published));
  });

  test('some pending and returned articles are revisions of a published one', () => {
    for (const state of ['Pending Editor Approval', 'Returned for Corrections']) {
      assert.ok(articles.some((a) => a.state === state && a.published), state);
      assert.ok(articles.some((a) => a.state === state && !a.published), state);
    }
    for (const a of articles.filter((x) => x.state === 'Returned for Corrections')) assert.ok(a.editorNote);
    for (const a of articles.filter((x) => x.state === 'Pending Editor Approval')) assert.ok(a.submittedAt);
  });

  test('is deterministic for a given rng seed', () => {
    const a = build(7);
    const b = build(7);
    assert.deepEqual(a.map((x) => x.title), b.map((x) => x.title));
  });
});

describe('seed data: view events', () => {
  test('views jump after publish and update markers', () => {
    const articles = build().filter((a) => a.state === 'Published' && a.history.length >= 3);
    const rng = createRng(1);
    let before = 0;
    let after = 0;
    for (const a of articles) {
      const events = buildViewEvents(a, NOW, rng);
      const marker = a.history[1].at.getTime();
      before += events.filter((e) => e.at.getTime() >= marker - 3 * HOUR && e.at.getTime() < marker).length;
      after += events.filter((e) => e.at.getTime() >= marker && e.at.getTime() < marker + 3 * HOUR).length;
    }
    assert.ok(after > before * 2, `before=${before} after=${after}`);
  });

  test('events fall between first publication and now, and are dense', () => {
    const a = build().find((x) => x.state === 'Published');
    const events = buildViewEvents(a, NOW, createRng(2));
    assert.ok(events.length >= 50);
    for (const e of events) {
      assert.equal(String(e.article), String(a._id));
      assert.ok(e.at.getTime() >= a.firstPublishedAt.getTime() && e.at.getTime() <= NOW);
    }
  });
});

describe('seed data: comments', () => {
  test('are valid for the Comment schema limits and follow publication', () => {
    const a = build().find((x) => x.state === 'Published');
    for (const c of buildComments(a, NOW, createRng(3))) {
      assert.ok(c.authorName.length <= 60 && c.body.length <= 2000 && c.deviceId);
      assert.ok(c.createdAt.getTime() > a.firstPublishedAt.getTime() && c.createdAt.getTime() <= NOW);
    }
  });
});

describe('seed production guard', () => {
  test('refuses under NODE_ENV=production without --force', () => {
    assert.throws(() => assertSeedAllowed({ nodeEnv: 'production', argv: [] }), /production/);
  });
  test('allows production with --force', () => {
    assert.doesNotThrow(() => assertSeedAllowed({ nodeEnv: 'production', argv: ['--force'] }));
  });
  test('allows non-production', () => {
    assert.doesNotThrow(() => assertSeedAllowed({ nodeEnv: 'development', argv: [] }));
  });
});
