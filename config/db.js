import mongoose from 'mongoose';
import { logger } from '../lib/logger.js';

/** Open the shared Mongoose connection. Call once at startup. */
export async function connectDb(uri) {
  mongoose.connection.on('error', (err) => {
    logger.error('db.error', { message: err.message });
  });
  mongoose.connection.once('open', () => {
    logger.info('db.connected', {});
  });

  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
