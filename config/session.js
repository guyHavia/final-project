import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { env } from './env.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

/**
 * A session store that builds its connect-mongo store on the first session
 * operation instead of at construction time. This lets `sessionMiddleware()`
 * be mounted in `app.js` before the Mongoose connection is open: requests that
 * carry no session (health checks, the skeleton test suite) never trigger a
 * store operation, so they never need Mongo. The first real session read/write
 * happens well after `server.js` has connected.
 */
class LazyMongoStore extends session.Store {
  #store;

  #resolve() {
    if (!this.#store) {
      this.#store = MongoStore.create({
        // Reuse the app's Mongoose connection — never open a second one (ADR 0001).
        client: mongoose.connection.getClient(),
        collectionName: 'sessions',
        ttl: SEVEN_DAYS_S,
      });
    }
    return this.#store;
  }

  get(sid, cb) {
    this.#resolve().get(sid, cb);
  }

  set(sid, sess, cb) {
    this.#resolve().set(sid, sess, cb);
  }

  destroy(sid, cb) {
    this.#resolve().destroy(sid, cb);
  }

  touch(sid, sess, cb) {
    this.#resolve().touch(sid, sess, cb);
  }

  all(cb) {
    this.#resolve().all(cb);
  }

  length(cb) {
    this.#resolve().length(cb);
  }

  clear(cb) {
    this.#resolve().clear(cb);
  }
}

/**
 * express-session persisted to MongoDB via connect-mongo, reusing the app's
 * existing Mongoose connection (ADR 0001). Because the session lives in the
 * `sessions` collection and not in process memory, a logged-in user survives a
 * server restart.
 */
export function sessionMiddleware() {
  return session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new LazyMongoStore(),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: SEVEN_DAYS_MS,
    },
  });
}
