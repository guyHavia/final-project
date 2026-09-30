import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { User, createUser } from '../models/user.model.js';
import { Article } from '../models/article.model.js';
import { Comment } from '../models/comment.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import { assertSeedAllowed, buildArticles, buildComments, buildViewEvents, createRng } from './seedData.js';

const CHUNK = 5000;

async function insertInChunks(Model, docs) {
  for (let i = 0; i < docs.length; i += CHUNK) {
    await Model.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
  }
}

async function seed() {
  assertSeedAllowed({ nodeEnv: env.nodeEnv, argv: process.argv.slice(2) });

  await connectDb(env.mongoUri);
  logger.info('seed.start', { db: mongoose.connection.name });

  await Promise.all([
    User.deleteMany({}),
    Article.deleteMany({}),
    Comment.deleteMany({}),
    ViewEvent.deleteMany({}),
    // Sessions reference users that no longer exist; drop them too.
    mongoose.connection.collection('sessions').deleteMany({}),
  ]);
  logger.info('seed.cleared', {});

  // Random per-user passwords, printed once at the end.
  const logins = [];
  const makeUser = async (username, role, displayName) => {
    const password = crypto.randomBytes(8).toString('hex');
    const user = await createUser({ username, password, role, displayName });
    logins.push({ username, password, role });
    return user;
  };

  const editor = await makeUser('editor', 'editor', 'The Editor');
  const reporters = [];
  for (let i = 1; i <= 5; i++) {
    reporters.push(await makeUser(`reporter${i}`, 'reporter', `Reporter ${i}`));
  }
  logger.info('seed.users', { count: logins.length });

  const now = Date.now();
  const rng = createRng();
  const articles = buildArticles({
    authorIds: reporters.map((r) => r._id),
    editorId: editor._id,
    now,
    rng,
  });

  const comments = [];
  const viewEvents = [];
  const viewCounts = [];
  for (const article of articles.filter((a) => a.firstPublishedAt)) {
    comments.push(...buildComments(article, now, rng));
    const events = buildViewEvents(article, now, rng);
    viewEvents.push(...events);
    viewCounts.push({ updateOne: { filter: { _id: article._id }, update: { $set: { viewCount: events.length } } } });
  }

  await insertInChunks(Article, articles);
  await insertInChunks(Comment, comments);
  await insertInChunks(ViewEvent, viewEvents);
  // Denormalized counter: one round trip for every article instead of one each.
  await Article.bulkWrite(viewCounts, { ordered: false });

  logger.info('seed.done', {
    articles: articles.length,
    comments: comments.length,
    viewEvents: viewEvents.length,
  });

  /* eslint-disable no-console -- credentials must reach the operator, not the JSON log */
  console.log('Seed completed. Demo logins (save these, they are not stored anywhere):');
  for (const { role, username, password } of logins) {
    console.log(`  Role: ${role.padEnd(8)} | Username: ${username.padEnd(10)} | Password: ${password}`);
  }
  /* eslint-enable no-console */

  await disconnectDb();
}

seed().catch(async (err) => {
  logger.error('seed.failed', { message: err.message });
  await disconnectDb().catch(() => {});
  process.exit(1);
});
