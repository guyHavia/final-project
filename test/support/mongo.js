import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Start an in-memory MongoDB and connect Mongoose to it for the lifetime of one
 * test file. Call from a `before` hook; invoke the returned function from `after`.
 *
 *   let stopMongo;
 *   before(async () => { stopMongo = await startMongo(); });
 *   after(async () => { await stopMongo(); });
 */
export async function startMongo() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  return async () => {
    await mongoose.disconnect();
    await mongod.stop();
  };
}
